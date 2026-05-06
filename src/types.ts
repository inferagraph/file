import type { EdgeData } from '@inferagraph/core';

export type FileType = 'csv' | 'tsv' | 'markdown';

export interface FileDataSourceConfigBase {
  /** Which file format to load */
  type: FileType;
  /** File path (csv/tsv) or folder path (markdown) */
  path: string;
  /** Host-supplied relationships */
  edges: EdgeData[];
  /** Column / frontmatter key for the node id (default 'id') */
  idField?: string;
}

export interface CsvLikeConfig extends FileDataSourceConfigBase {
  type: 'csv' | 'tsv';
  /** First row contains column names (default true) */
  hasHeader?: boolean;
  /** Required when hasHeader=false; length must equal first row's field count */
  columns?: string[];
  /** Host-chosen columns exposed via getContent for template injection */
  contentFields?: string[];
}

export interface MarkdownConfig extends FileDataSourceConfigBase {
  type: 'markdown';
  /** Required keys; each .md file must contain EXACTLY these keys (no more, no less) */
  frontmatter: string[];
}

export type FileDataSourceConfig = CsvLikeConfig | MarkdownConfig;
