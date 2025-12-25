/**
 * Tests for the Archive class
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Archive } from './archive.js';
import { FileStorageProvider } from './providers/file-storage.js';
import { FileIndexProvider } from './providers/file-index.js';

describe('Archive', () => {
  let archive: Archive;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `archive-test-${Date.now()}`);
    archive = new Archive({
      storage: new FileStorageProvider({
        basePath: join(testDir, 'data'),
      }),
      index: new FileIndexProvider({
        indexPath: join(testDir, 'index.json'),
      }),
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('store and retrieve', () => {
    it('should store and retrieve binary data', async () => {
      const data = Buffer.from('Hello, World!');
      const record = await archive.store(data, { filename: 'test.txt' });

      assert.ok(record.id);
      assert.strictEqual(record.metadata.filename, 'test.txt');
      assert.strictEqual(record.metadata.size, data.length);
      assert.strictEqual(record.metadata.mimeType, 'text/plain');

      const retrieved = await archive.retrieve(record.id);
      assert.deepStrictEqual(retrieved, data);
    });

    it('should store and retrieve text data', async () => {
      const text = 'Test content for archival';
      const record = await archive.storeText(text, { filename: 'note.txt' });

      const retrieved = await archive.retrieveText(record.id);
      assert.strictEqual(retrieved, text);
    });

    it('should detect MIME type from filename', async () => {
      const data = Buffer.from('{}');
      const record = await archive.store(data, { filename: 'config.json' });

      assert.strictEqual(record.metadata.mimeType, 'application/json');
    });

    it('should store with custom tags', async () => {
      const data = Buffer.from('Tagged content');
      const record = await archive.store(data, {
        filename: 'tagged.txt',
        tags: ['important', 'backup'],
      });

      assert.deepStrictEqual(record.metadata.tags, ['important', 'backup']);
    });

    it('should verify integrity on retrieve', async () => {
      const data = Buffer.from('Verified content');
      const record = await archive.store(data);

      const retrieved = await archive.retrieve(record.id, {
        verifyIntegrity: true,
      });
      assert.deepStrictEqual(retrieved, data);
    });
  });

  describe('getRecord', () => {
    it('should return record metadata without data', async () => {
      const data = Buffer.from('Metadata test');
      const stored = await archive.store(data, {
        filename: 'meta.txt',
        tags: ['test'],
      });

      const record = await archive.getRecord(stored.id);
      assert.ok(record);
      assert.strictEqual(record.id, stored.id);
      assert.strictEqual(record.metadata.filename, 'meta.txt');
    });

    it('should return null for non-existent ID', async () => {
      const record = await archive.getRecord('non-existent-id');
      assert.strictEqual(record, null);
    });
  });

  describe('delete', () => {
    it('should delete stored items', async () => {
      const data = Buffer.from('Delete me');
      const record = await archive.store(data);

      await archive.delete(record.id);

      const retrieved = await archive.getRecord(record.id);
      assert.strictEqual(retrieved, null);
    });

    it('should throw for non-existent ID', async () => {
      await assert.rejects(
        () => archive.delete('non-existent-id'),
        /not found/
      );
    });
  });

  describe('list', () => {
    it('should list all items', async () => {
      await archive.store(Buffer.from('Item 1'), { filename: 'one.txt' });
      await archive.store(Buffer.from('Item 2'), { filename: 'two.txt' });
      await archive.store(Buffer.from('Item 3'), { filename: 'three.txt' });

      const result = await archive.list();
      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.items.length, 3);
    });

    it('should filter by tags', async () => {
      await archive.store(Buffer.from('A'), { tags: ['foo'] });
      await archive.store(Buffer.from('B'), { tags: ['bar'] });
      await archive.store(Buffer.from('C'), { tags: ['foo', 'bar'] });

      const result = await archive.list({ tags: ['foo'] });
      assert.strictEqual(result.total, 2);
    });

    it('should filter by MIME type prefix', async () => {
      await archive.store(Buffer.from('{}'), { filename: 'data.json' });
      await archive.store(Buffer.from('text'), { filename: 'doc.txt' });
      await archive.store(Buffer.from('<xml>'), { filename: 'doc.xml' });

      const result = await archive.list({ mimeTypePrefix: 'text/' });
      assert.strictEqual(result.total, 2);
    });

    it('should respect limit', async () => {
      await archive.store(Buffer.from('1'));
      await archive.store(Buffer.from('2'));
      await archive.store(Buffer.from('3'));

      const result = await archive.list({ limit: 2 });
      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.hasMore, true);
    });
  });

  describe('verify', () => {
    it('should verify valid data', async () => {
      const data = Buffer.from('Verify me');
      const record = await archive.store(data);

      const result = await archive.verify(record.id);
      assert.strictEqual(result.valid, true);
    });

    it('should verify all items', async () => {
      await archive.store(Buffer.from('One'));
      await archive.store(Buffer.from('Two'));
      await archive.store(Buffer.from('Three'));

      const results = await archive.verifyAll();
      assert.strictEqual(results.size, 3);

      for (const result of results.values()) {
        assert.strictEqual(result.valid, true);
      }
    });
  });

  describe('tags', () => {
    it('should add tags to existing item', async () => {
      const record = await archive.store(Buffer.from('Tagged'), {
        tags: ['initial'],
      });

      const updated = await archive.addTags(record.id, ['new', 'tags']);
      assert.deepStrictEqual(updated.metadata.tags, ['initial', 'new', 'tags']);
    });

    it('should update all tags', async () => {
      const record = await archive.store(Buffer.from('Tagged'), {
        tags: ['old'],
      });

      const updated = await archive.updateTags(record.id, ['new']);
      assert.deepStrictEqual(updated.metadata.tags, ['new']);
    });
  });

  describe('properties', () => {
    it('should update custom properties', async () => {
      const record = await archive.store(Buffer.from('Props'), {
        properties: { key1: 'value1' },
      });

      const updated = await archive.updateProperties(record.id, {
        key2: 'value2',
      });

      assert.strictEqual(updated.metadata.properties.key1, 'value1');
      assert.strictEqual(updated.metadata.properties.key2, 'value2');
    });
  });

  describe('stats', () => {
    it('should return archive statistics', async () => {
      await archive.store(Buffer.from('First'));
      await archive.store(Buffer.from('Second'));

      const stats = await archive.stats();
      assert.strictEqual(stats.totalItems, 2);
      assert.strictEqual(stats.totalSize, 11); // 5 + 6 bytes
      assert.ok(stats.oldestItem);
      assert.ok(stats.newestItem);
    });

    it('should handle empty archive', async () => {
      const stats = await archive.stats();
      assert.strictEqual(stats.totalItems, 0);
      assert.strictEqual(stats.totalSize, 0);
      assert.strictEqual(stats.oldestItem, null);
      assert.strictEqual(stats.newestItem, null);
    });
  });
});
