import { FileDataSource } from './FileDataSource.js';
import type { FileDataSourceConfig } from './types.js';

export { FileDataSource } from './FileDataSource.js';
export type {
  FileType,
  FileDataSourceConfig,
  FileDataSourceConfigBase,
  CsvLikeConfig,
  MarkdownConfig,
} from './types.js';

/**
 * Factory for {@link FileDataSource}. Preferred entry point for hosts; the
 * class export remains available as an escape hatch for advanced subclassing.
 */
export function fileDataSource(config: FileDataSourceConfig): FileDataSource {
  return new FileDataSource(config);
}
