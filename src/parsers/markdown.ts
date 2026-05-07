import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { NodeData } from '@inferagraph/core/data';

export interface ParseMarkdownOptions {
  /** Required frontmatter keys; each file must contain EXACTLY this set */
  frontmatter: string[];
  /** Frontmatter key that holds the node id (default 'id') */
  idField: string;
}

export interface ParsedMarkdown {
  nodes: NodeData[];
  /** Map from node id to body content (everything after frontmatter) */
  contentByNodeId: Map<string, string>;
}

/**
 * Read every .md file in a folder (flat, no recursion), validate frontmatter,
 * and return nodes plus a body lookup map.
 */
export async function parseMarkdownFolder(
  folderPath: string,
  options: ParseMarkdownOptions,
): Promise<ParsedMarkdown> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const mdFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort();

  const requiredKeys = new Set(options.frontmatter);
  const nodes: NodeData[] = [];
  const contentByNodeId = new Map<string, string>();

  for (const fileName of mdFiles) {
    const fullPath = join(folderPath, fileName);
    const raw = await readFile(fullPath, 'utf8');
    const parsed = matter(raw);
    const fmRecord = (parsed.data ?? {}) as Record<string, unknown>;

    const fileKeys = Object.keys(fmRecord);
    const fileKeySet = new Set(fileKeys);

    // Strict equality of key sets
    const missing = options.frontmatter.filter((k) => !fileKeySet.has(k));
    const extra = fileKeys.filter((k) => !requiredKeys.has(k));

    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing: [${missing.join(', ')}]`);
      if (extra.length > 0) parts.push(`extra: [${extra.join(', ')}]`);
      throw new Error(
        `FileDataSource: frontmatter mismatch in ${fileName} — ${parts.join('; ')}.`,
      );
    }

    const idValue = fmRecord[options.idField];
    if (idValue === undefined || idValue === null || idValue === '') {
      throw new Error(
        `FileDataSource: file ${fileName} has no value for idField '${options.idField}'.`,
      );
    }

    const id = String(idValue);
    nodes.push({ id, attributes: { ...fmRecord } });
    contentByNodeId.set(id, parsed.content);
  }

  return { nodes, contentByNodeId };
}
