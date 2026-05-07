import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from '@inferagraph/core/data';
import {
  FileDataSource,
  fileDataSource,
} from '../src/index.js';

const FIXTURES = join(__dirname, 'fixtures');

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { name: string };

describe('package rename', () => {
  it('package.json name is @inferagraph/file', () => {
    expect(pkg.name).toBe('@inferagraph/file');
  });
});

describe('FileDataSource (renamed class)', () => {
  it('is exported and constructable (escape hatch)', async () => {
    const ds = new FileDataSource({
      type: 'csv',
      path: join(FIXTURES, 'nodes-with-header.csv'),
      edges: [],
    });
    expect(ds).toBeInstanceOf(DataSource);
    expect(ds.name).toBe('file');
    await ds.connect();
    expect(ds.isConnected()).toBe(true);
    await ds.disconnect();
  });
});

describe('fileDataSource factory', () => {
  it('returns a DataSource-shaped instance (extends DataSource)', () => {
    const ds = fileDataSource({
      type: 'csv',
      path: join(FIXTURES, 'nodes-with-header.csv'),
      edges: [],
    });
    expect(ds).toBeInstanceOf(DataSource);
  });

  it('factory result behaves like the class (connect + getInitialView)', async () => {
    const ds = fileDataSource({
      type: 'csv',
      path: join(FIXTURES, 'nodes-with-header.csv'),
      edges: [],
    });
    await ds.connect();
    const view = await ds.getInitialView();
    expect(view.nodes).toHaveLength(3);
    await ds.disconnect();
  });
});
