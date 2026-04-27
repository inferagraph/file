import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export interface ParseCsvOptions {
  /** ',' for csv, '\\t' for tsv */
  delimiter: ',' | '\t';
  /** Whether the first parsed row is a header */
  hasHeader: boolean;
  /** When hasHeader=false, the host-supplied column names. */
  columns?: string[];
}

export interface ParsedCsv {
  /** Resolved column names in order */
  columns: string[];
  /** Each row as a column-keyed record */
  rows: Record<string, string>[];
}

/**
 * Read and parse a delimited file (CSV/TSV) into columns + rows.
 * Throws if columns are required but missing or mismatched.
 */
export async function parseCsvFile(
  path: string,
  options: ParseCsvOptions,
): Promise<ParsedCsv> {
  const raw = await readFile(path, 'utf8');

  // First parse as raw arrays so we can validate column counts before naming.
  const records: string[][] = parse(raw, {
    delimiter: options.delimiter,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  if (records.length === 0) {
    if (!options.hasHeader && (!options.columns || options.columns.length === 0)) {
      throw new Error(
        'FileDatasource: hasHeader=false requires non-empty `columns` configuration.',
      );
    }
    return { columns: options.hasHeader ? [] : (options.columns ?? []), rows: [] };
  }

  let columns: string[];
  let dataRows: string[][];

  if (options.hasHeader) {
    columns = records[0];
    dataRows = records.slice(1);
  } else {
    if (!options.columns || options.columns.length === 0) {
      throw new Error(
        'FileDatasource: hasHeader=false requires non-empty `columns` configuration.',
      );
    }
    if (options.columns.length !== records[0].length) {
      throw new Error(
        `FileDatasource: \`columns\` length (${options.columns.length}) does not match the parsed first row's field count (${records[0].length}).`,
      );
    }
    columns = options.columns;
    dataRows = records;
  }

  const rows: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i] ?? '';
    }
    return obj;
  });

  return { columns, rows };
}
