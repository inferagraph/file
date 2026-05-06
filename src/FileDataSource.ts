import { Datasource, StaticDataAdapter } from '@inferagraph/core';
import type {
  DataAdapterConfig,
  GraphData,
  NodeId,
  NodeData,
  ContentData,
  PaginationOptions,
  PaginatedResult,
  DataFilter,
} from '@inferagraph/core';
import type { FileDataSourceConfig, CsvLikeConfig, MarkdownConfig } from './types.js';
import { parseCsvFile } from './parsers/csv.js';
import { parseMarkdownFolder } from './parsers/markdown.js';

/**
 * Datasource that loads nodes from delimited files (CSV/TSV) or a folder
 * of Markdown files with frontmatter. Edges are host-supplied via config.
 *
 * After parsing, an internal {@link StaticDataAdapter} handles all graph
 * traversal/search/filter operations. `getContent` is handled directly:
 *
 * - markdown: returns the body of the source .md file with `contentType: 'markdown'`
 * - csv/tsv with `contentFields`: returns selected columns as `metadata` with
 *   `content: ''` and `contentType: 'fields'`
 * - csv/tsv without `contentFields`: returns `undefined`
 */
export class FileDataSource extends Datasource {
  readonly name = 'file';

  private readonly config: FileDataSourceConfig;
  private readonly idField: string;

  private adapter: StaticDataAdapter | null = null;
  private connected = false;

  // Markdown body lookup
  private contentByNodeId: Map<string, string> = new Map();
  // CSV/TSV row lookup for getContent metadata
  private csvRowsById: Map<string, Record<string, string>> = new Map();

  constructor(config: FileDataSourceConfig) {
    super();
    this.config = config;
    this.idField = config.idField ?? 'id';
  }

  // --- Lifecycle ---

  async connect(): Promise<void> {
    let graphData: GraphData;

    if (this.config.type === 'markdown') {
      graphData = await this.loadMarkdown(this.config);
    } else {
      graphData = await this.loadCsvLike(this.config);
    }

    this.adapter = new StaticDataAdapter(graphData);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.adapter = null;
    this.connected = false;
    this.contentByNodeId = new Map();
    this.csvRowsById = new Map();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // --- DataAdapter delegation ---

  async getInitialView(config?: DataAdapterConfig): Promise<GraphData> {
    return this.requireAdapter().getInitialView(config);
  }

  async getNode(id: NodeId): Promise<NodeData | undefined> {
    return this.requireAdapter().getNode(id);
  }

  async getNeighbors(nodeId: NodeId, depth: number = 1): Promise<GraphData> {
    return this.requireAdapter().getNeighbors(nodeId, depth);
  }

  async findPath(fromId: NodeId, toId: NodeId): Promise<GraphData> {
    return this.requireAdapter().findPath(fromId, toId);
  }

  async search(
    query: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<NodeData>> {
    return this.requireAdapter().search(query, pagination);
  }

  async filter(
    filter: DataFilter,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<NodeData>> {
    return this.requireAdapter().filter(filter, pagination);
  }

  async getContent(nodeId: NodeId): Promise<ContentData | undefined> {
    this.ensureConnected();

    if (this.config.type === 'markdown') {
      const body = this.contentByNodeId.get(nodeId);
      if (body === undefined) return undefined;
      return {
        nodeId,
        content: body,
        contentType: 'markdown',
      };
    }

    // csv/tsv
    const fields = this.config.contentFields;
    if (!fields || fields.length === 0) return undefined;

    const row = this.csvRowsById.get(nodeId);
    if (!row) return undefined;

    const metadata: Record<string, unknown> = {};
    for (const f of fields) {
      metadata[f] = row[f];
    }
    return {
      nodeId,
      content: '',
      contentType: 'fields',
      metadata,
    };
  }

  // --- Loaders ---

  private async loadCsvLike(config: CsvLikeConfig): Promise<GraphData> {
    const delimiter: ',' | '\t' = config.type === 'tsv' ? '\t' : ',';
    const hasHeader = config.hasHeader ?? true;

    const parsed = await parseCsvFile(config.path, {
      delimiter,
      hasHeader,
      columns: config.columns,
    });

    // Validate contentFields against parsed columns up-front
    if (config.contentFields && config.contentFields.length > 0) {
      const colSet = new Set(parsed.columns);
      const missing = config.contentFields.filter((c) => !colSet.has(c));
      if (missing.length > 0) {
        throw new Error(
          `FileDataSource: \`contentFields\` references unknown column(s): [${missing.join(', ')}]. Available columns: [${parsed.columns.join(', ')}].`,
        );
      }
    }

    const nodes: NodeData[] = parsed.rows.map((row) => {
      const idValue = row[this.idField];
      if (idValue === undefined || idValue === '') {
        throw new Error(
          `FileDataSource: row is missing a value for idField '${this.idField}'.`,
        );
      }
      const id = String(idValue);
      this.csvRowsById.set(id, row);
      return { id, attributes: { ...row } };
    });

    return { nodes, edges: config.edges };
  }

  private async loadMarkdown(config: MarkdownConfig): Promise<GraphData> {
    const parsed = await parseMarkdownFolder(config.path, {
      frontmatter: config.frontmatter,
      idField: this.idField,
    });

    this.contentByNodeId = parsed.contentByNodeId;

    return { nodes: parsed.nodes, edges: config.edges };
  }

  // --- Helpers ---

  private requireAdapter(): StaticDataAdapter {
    this.ensureConnected();
    return this.adapter!;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.adapter) {
      throw new Error('FileDataSource is not connected. Call connect() first.');
    }
  }
}
