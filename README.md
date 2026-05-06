# @inferagraph/file

File-based datasource plugin for [@inferagraph/core](https://github.com/inferagraph/core). Loads nodes from delimited files (CSV/TSV) or a folder of Markdown files with frontmatter.

## Migration from `@inferagraph/file-datasource`

```bash
pnpm remove @inferagraph/file-datasource
pnpm add @inferagraph/file
```

The class was also renamed `FileDatasource` → `FileDataSource`. Most hosts can switch to the new factory:

```typescript
import { fileDataSource } from '@inferagraph/file';
```

## Installation

```bash
pnpm add @inferagraph/file @inferagraph/core
```

## Usage

### CSV / TSV

```typescript
import { fileDataSource } from '@inferagraph/file';

const datasource = fileDataSource({
  type: 'csv',
  path: './data/nodes.csv',
  hasHeader: true,           // first row contains column names
  contentFields: ['summary'], // optional: surface columns via getContent
  edges: [
    {
      id: 'e1',
      sourceId: 'n1',
      targetId: 'n2',
      attributes: { type: 'related_to' },
    },
  ],
});

await datasource.connect();

const view = await datasource.getInitialView();
const node = await datasource.getNode('n1');
const neighbors = await datasource.getNeighbors('n1');
const results = await datasource.search('keyword');

await datasource.disconnect();
```

### Markdown folder

```typescript
import { fileDataSource } from '@inferagraph/file';

const datasource = fileDataSource({
  type: 'markdown',
  path: './data/nodes',                          // folder containing .md files
  frontmatter: ['id', 'name', 'type'],           // required keys per file (exact match)
  edges: [],
});

await datasource.connect();

// Each .md file becomes a node with frontmatter as attributes;
// the body is exposed via getContent.
const content = await datasource.getContent('n1');
// { nodeId: 'n1', content: '<body markdown>', contentType: 'markdown' }
```

### Class escape hatch

The factory is the preferred entry point, but the class is exported for hosts that need to subclass:

```typescript
import { FileDataSource } from '@inferagraph/file';

class MyFileDataSource extends FileDataSource {
  // ...
}
```

## Configuration

### Common options

| Option | Type | Description |
|---|---|---|
| `type` | `'csv' \| 'tsv' \| 'markdown'` | File format |
| `path` | `string` | File path (csv/tsv) or folder path (markdown) |
| `edges` | `EdgeData[]` | Host-supplied relationships |
| `idField` | `string` | Column / frontmatter key for the node id (default: `'id'`) |

### CSV / TSV options

| Option | Type | Description |
|---|---|---|
| `hasHeader` | `boolean` | First row is column names (default: `true`) |
| `columns` | `string[]` | Required when `hasHeader=false`. Length must match the parsed first row. |
| `contentFields` | `string[]` | Columns surfaced via `getContent` as `metadata`. When unset, `getContent` returns `undefined`. |

### Markdown options

| Option | Type | Description |
|---|---|---|
| `frontmatter` | `string[]` | Required keys. Each `.md` file must contain EXACTLY this set (extras and missing keys throw). |

## Behavior

- `connect()` reads and parses every file up-front (deterministic, fail-fast).
- `disconnect()` clears the parsed state.
- All seven `DataAdapter` methods (`getInitialView`, `getNode`, `getNeighbors`, `findPath`, `search`, `filter`, `getContent`) require an active connection.
- Edges supplied in `config.edges` are stored as-is and used for graph traversal.

## License

MIT
