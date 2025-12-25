/**
 * Tests for integrity utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeHash,
  createIntegrityInfo,
  verifyIntegrity,
  generateArchiveId,
} from './integrity.js';

describe('integrity utilities', () => {
  describe('computeHash', () => {
    it('should compute SHA-256 hash', () => {
      const data = Buffer.from('Hello, World!');
      const hash = computeHash(data, 'sha256');

      assert.strictEqual(
        hash,
        'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
      );
    });

    it('should compute SHA-512 hash', () => {
      const data = Buffer.from('Hello, World!');
      const hash = computeHash(data, 'sha512');

      assert.ok(hash.length === 128); // SHA-512 produces 128 hex chars
    });

    it('should compute MD5 hash', () => {
      const data = Buffer.from('Hello, World!');
      const hash = computeHash(data, 'md5');

      assert.strictEqual(hash, '65a8e27d8879283831b664bd8b7f0ad4');
    });

    it('should produce different hashes for different data', () => {
      const hash1 = computeHash(Buffer.from('abc'), 'sha256');
      const hash2 = computeHash(Buffer.from('xyz'), 'sha256');

      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('createIntegrityInfo', () => {
    it('should create integrity info with default algorithm', () => {
      const data = Buffer.from('test data');
      const info = createIntegrityInfo(data);

      assert.strictEqual(info.algorithm, 'sha256');
      assert.ok(info.hash.length === 64); // SHA-256 produces 64 hex chars
      assert.ok(info.verifiedAt instanceof Date);
    });

    it('should create integrity info with custom algorithm', () => {
      const data = Buffer.from('test data');
      const info = createIntegrityInfo(data, 'sha512');

      assert.strictEqual(info.algorithm, 'sha512');
      assert.ok(info.hash.length === 128);
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify valid data', () => {
      const data = Buffer.from('test data');
      const info = createIntegrityInfo(data);
      const result = verifyIntegrity(data, info);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.expected, result.actual);
    });

    it('should detect corrupted data', () => {
      const original = Buffer.from('original data');
      const info = createIntegrityInfo(original);
      const corrupted = Buffer.from('corrupted data');
      const result = verifyIntegrity(corrupted, info);

      assert.strictEqual(result.valid, false);
      assert.notStrictEqual(result.expected, result.actual);
    });
  });

  describe('generateArchiveId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateArchiveId();
      const id2 = generateArchiveId();

      assert.notStrictEqual(id1, id2);
    });

    it('should generate IDs in expected format', () => {
      const id = generateArchiveId();

      assert.ok(id.includes('-'));
      assert.ok(id.length > 10);
    });
  });
});
