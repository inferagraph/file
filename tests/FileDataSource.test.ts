import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EdgeData } from '@inferagraph/core';
import { FileDataSource } from '../src/FileDataSource.js';

const FIXTURES = join(__dirname, 'fixtures');

const sampleEdges: EdgeData[] = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', attributes: { type: 'related_to' } },
  { id: 'e2', sourceId: 'n2', targetId: 'n3', attributes: { type: 'lives_in' } },
];

describe('FileDataSource', () => {
  // --- Basic Properties ---

  describe('basic', () => {
    it('should have name "file"', () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      expect(ds.name).toBe('file');
    });
  });

  // --- Lifecycle ---

  describe('lifecycle', () => {
    it('should not be connected before connect()', () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      expect(ds.isConnected()).toBe(false);
    });

    it('should be connected after connect()', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      await ds.connect();
      expect(ds.isConnected()).toBe(true);
    });

    it('should not be connected after disconnect()', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      await ds.connect();
      await ds.disconnect();
      expect(ds.isConnected()).toBe(false);
    });

    it('should handle disconnect() without prior connect()', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      await ds.disconnect();
      expect(ds.isConnected()).toBe(false);
    });
  });

  // --- ensureConnected ---

  describe('ensureConnected', () => {
    let ds: FileDataSource;

    beforeEach(() => {
      ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
    });

    it('throws on getInitialView before connect', async () => {
      await expect(ds.getInitialView()).rejects.toThrow(
        'FileDataSource is not connected. Call connect() first.',
      );
    });

    it('throws on getNode before connect', async () => {
      await expect(ds.getNode('n1')).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws on getNeighbors before connect', async () => {
      await expect(ds.getNeighbors('n1')).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws on findPath before connect', async () => {
      await expect(ds.findPath('n1', 'n2')).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws on search before connect', async () => {
      await expect(ds.search('Adam')).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws on filter before connect', async () => {
      await expect(ds.filter({})).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws on getContent before connect', async () => {
      await expect(ds.getContent('n1')).rejects.toThrow('FileDataSource is not connected');
    });

    it('throws after disconnect()', async () => {
      await ds.connect();
      await ds.disconnect();
      await expect(ds.getInitialView()).rejects.toThrow('FileDataSource is not connected');
    });
  });

  // --- CSV with header ---

  describe('CSV with header', () => {
    it('parses nodes with column names from header', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: sampleEdges,
      });
      await ds.connect();

      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(3);
      expect(view.edges).toHaveLength(2);
      expect(view.nodes[0]).toEqual({
        id: 'n1',
        attributes: { id: 'n1', name: 'Adam', type: 'person', summary: 'The first man' },
      });
      expect(view.nodes[1].id).toBe('n2');
      expect(view.nodes[2].attributes.type).toBe('place');
    });

    it('respects a custom idField', async () => {
      // Build a CSV in a tmp dir where node id is in 'slug'
      const tmp = mkdtempSync(join(tmpdir(), 'iagf-'));
      const filePath = join(tmp, 'nodes.csv');
      writeFileSync(filePath, 'slug,name\nadam,Adam\neve,Eve\n');

      const ds = new FileDataSource({
        type: 'csv',
        path: filePath,
        idField: 'slug',
        edges: [],
      });
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes[0].id).toBe('adam');
      expect(view.nodes[1].id).toBe('eve');

      rmSync(tmp, { recursive: true, force: true });
    });
  });

  // --- CSV without header ---

  describe('CSV without header', () => {
    it('parses nodes with supplied column names', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-no-header.csv'),
        hasHeader: false,
        columns: ['id', 'name', 'type', 'summary'],
        edges: [],
      });
      await ds.connect();

      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(3);
      expect(view.nodes[0].attributes.name).toBe('Adam');
      expect(view.nodes[0].attributes.summary).toBe('The first man');
    });

    it('throws when columns mismatch the parsed first row', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-no-header.csv'),
        hasHeader: false,
        columns: ['id', 'name', 'type'], // 3 supplied, file has 4 fields
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow(/columns/i);
    });

    it('throws when hasHeader=false but no columns supplied', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-no-header.csv'),
        hasHeader: false,
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow(/columns/i);
    });
  });

  // --- TSV ---

  describe('TSV with header', () => {
    it('parses tab-delimited nodes', async () => {
      const ds = new FileDataSource({
        type: 'tsv',
        path: join(FIXTURES, 'nodes.tsv'),
        edges: [],
      });
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(3);
      expect(view.nodes[0].attributes.name).toBe('Adam');
      expect(view.nodes[1].attributes.summary).toBe('The first woman');
    });
  });

  // --- Markdown ---

  describe('Markdown folder', () => {
    it('happy path: each .md becomes a node with frontmatter attributes; body via getContent', async () => {
      const ds = new FileDataSource({
        type: 'markdown',
        path: join(FIXTURES, 'markdown-good'),
        frontmatter: ['id', 'name', 'type'],
        edges: sampleEdges,
      });
      await ds.connect();

      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(2);

      const adam = view.nodes.find((n) => n.id === 'n1');
      expect(adam).toBeDefined();
      expect(adam!.attributes.name).toBe('Adam');
      expect(adam!.attributes.type).toBe('person');

      const content = await ds.getContent('n1');
      expect(content).toBeDefined();
      expect(content!.contentType).toBe('markdown');
      expect(content!.content).toContain('# Adam');
      expect(content!.content).toContain('The first man');
      expect(content!.nodeId).toBe('n1');
    });

    it('returns undefined getContent for unknown node', async () => {
      const ds = new FileDataSource({
        type: 'markdown',
        path: join(FIXTURES, 'markdown-good'),
        frontmatter: ['id', 'name', 'type'],
        edges: [],
      });
      await ds.connect();
      const content = await ds.getContent('does-not-exist');
      expect(content).toBeUndefined();
    });

    it('throws when a file has extra frontmatter keys', async () => {
      const ds = new FileDataSource({
        type: 'markdown',
        path: join(FIXTURES, 'markdown-extra-key'),
        frontmatter: ['id', 'name', 'type'],
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow(/frontmatter/i);
    });

    it('throws when a file is missing required frontmatter keys', async () => {
      const ds = new FileDataSource({
        type: 'markdown',
        path: join(FIXTURES, 'markdown-missing-key'),
        frontmatter: ['id', 'name', 'type'],
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow(/frontmatter/i);
    });

    it('ignores non-.md files in the folder', async () => {
      const tmp = mkdtempSync(join(tmpdir(), 'iagf-md-'));
      writeFileSync(
        join(tmp, 'a.md'),
        '---\nid: a\nname: A\n---\nbody A\n',
      );
      writeFileSync(join(tmp, 'README.txt'), 'not markdown');

      const ds = new FileDataSource({
        type: 'markdown',
        path: tmp,
        frontmatter: ['id', 'name'],
        edges: [],
      });
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(1);
      expect(view.nodes[0].id).toBe('a');

      rmSync(tmp, { recursive: true, force: true });
    });

    it('respects custom idField for markdown', async () => {
      const tmp = mkdtempSync(join(tmpdir(), 'iagf-md-id-'));
      writeFileSync(
        join(tmp, 'a.md'),
        '---\nslug: alpha\nname: Alpha\n---\nbody\n',
      );
      const ds = new FileDataSource({
        type: 'markdown',
        path: tmp,
        idField: 'slug',
        frontmatter: ['slug', 'name'],
        edges: [],
      });
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes[0].id).toBe('alpha');

      rmSync(tmp, { recursive: true, force: true });
    });
  });

  // --- Edges ---

  describe('edges supplied via config', () => {
    it('wires edges into the graph (verified via getNeighbors)', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: sampleEdges,
      });
      await ds.connect();

      const result = await ds.getNeighbors('n1');
      const neighborIds = result.nodes.map((n) => n.id).sort();
      expect(neighborIds).toEqual(['n1', 'n2']);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].id).toBe('e1');
    });

    it('findPath finds shortest path through supplied edges', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: sampleEdges,
      });
      await ds.connect();

      const result = await ds.findPath('n1', 'n3');
      expect(result.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
      expect(result.edges).toHaveLength(2);
    });
  });

  // --- DataAdapter delegation ---

  describe('DataAdapter delegation', () => {
    let ds: FileDataSource;
    beforeEach(async () => {
      ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: sampleEdges,
      });
      await ds.connect();
    });

    it('getInitialView returns all nodes and edges', async () => {
      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(3);
      expect(view.edges).toHaveLength(2);
    });

    it('getNode returns node by id', async () => {
      const node = await ds.getNode('n2');
      expect(node).toBeDefined();
      expect(node!.attributes.name).toBe('Eve');
    });

    it('getNode returns undefined for missing id', async () => {
      const node = await ds.getNode('missing');
      expect(node).toBeUndefined();
    });

    it('search finds matching nodes', async () => {
      const result = await ds.search('Adam');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('n1');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('search supports pagination', async () => {
      const result = await ds.search('the', { offset: 0, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('filter by types works', async () => {
      const result = await ds.filter({ types: ['person'] });
      expect(result.items).toHaveLength(2);
    });

    it('filter by attributes works', async () => {
      const result = await ds.filter({ attributes: { name: 'Eve' } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('n2');
    });
  });

  // --- contentFields for CSV/TSV ---

  describe('CSV getContent via contentFields', () => {
    it('returns undefined when contentFields is not set', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      await ds.connect();
      const content = await ds.getContent('n1');
      expect(content).toBeUndefined();
    });

    it('returns ContentData with metadata when contentFields is set', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        contentFields: ['summary', 'name'],
        edges: [],
      });
      await ds.connect();
      const content = await ds.getContent('n1');
      expect(content).toBeDefined();
      expect(content!.nodeId).toBe('n1');
      expect(content!.content).toBe('');
      expect(content!.contentType).toBe('fields');
      expect(content!.metadata).toEqual({ summary: 'The first man', name: 'Adam' });
    });

    it('throws on connect when contentFields references unknown column', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        contentFields: ['nope'],
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow(/contentFields|column/i);
    });

    it('returns undefined for unknown node id even with contentFields set', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        contentFields: ['summary'],
        edges: [],
      });
      await ds.connect();
      const content = await ds.getContent('nope');
      expect(content).toBeUndefined();
    });
  });

  // --- Cleanup of state on disconnect ---

  describe('disconnect clears parsed state', () => {
    it('forces re-connect after disconnect', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: join(FIXTURES, 'nodes-with-header.csv'),
        edges: [],
      });
      await ds.connect();
      await ds.disconnect();
      // Should re-parse fresh
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(3);
    });
  });

  // --- Error: nonexistent file ---

  describe('error cases', () => {
    it('throws when CSV file does not exist', async () => {
      const ds = new FileDataSource({
        type: 'csv',
        path: '/nonexistent/path/to/file.csv',
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow();
    });

    it('throws when markdown folder does not exist', async () => {
      const ds = new FileDataSource({
        type: 'markdown',
        path: '/nonexistent/folder',
        frontmatter: ['id'],
        edges: [],
      });
      await expect(ds.connect()).rejects.toThrow();
    });

    it('handles markdown folder with no .md files', async () => {
      const tmp = mkdtempSync(join(tmpdir(), 'iagf-empty-'));
      const ds = new FileDataSource({
        type: 'markdown',
        path: tmp,
        frontmatter: ['id'],
        edges: [],
      });
      await ds.connect();
      const view = await ds.getInitialView();
      expect(view.nodes).toHaveLength(0);

      rmSync(tmp, { recursive: true, force: true });
    });
  });

});
