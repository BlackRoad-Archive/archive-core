/**
 * Tests for MIME type utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectMimeType, getExtensionForMime, isTextMime } from './mime.js';

describe('MIME utilities', () => {
  describe('detectMimeType', () => {
    it('should detect common text types', () => {
      assert.strictEqual(detectMimeType('file.txt'), 'text/plain');
      assert.strictEqual(detectMimeType('page.html'), 'text/html');
      assert.strictEqual(detectMimeType('style.css'), 'text/css');
    });

    it('should detect JavaScript/TypeScript types', () => {
      assert.strictEqual(detectMimeType('app.js'), 'application/javascript');
      assert.strictEqual(detectMimeType('module.mjs'), 'application/javascript');
      assert.strictEqual(detectMimeType('index.ts'), 'application/typescript');
    });

    it('should detect data formats', () => {
      assert.strictEqual(detectMimeType('config.json'), 'application/json');
      assert.strictEqual(detectMimeType('settings.yaml'), 'application/yaml');
    });

    it('should detect image types', () => {
      assert.strictEqual(detectMimeType('photo.jpg'), 'image/jpeg');
      assert.strictEqual(detectMimeType('image.png'), 'image/png');
      assert.strictEqual(detectMimeType('animation.gif'), 'image/gif');
    });

    it('should detect archive types', () => {
      assert.strictEqual(detectMimeType('files.zip'), 'application/zip');
      assert.strictEqual(detectMimeType('backup.tar'), 'application/x-tar');
    });

    it('should return octet-stream for unknown types', () => {
      assert.strictEqual(detectMimeType('file.xyz'), 'application/octet-stream');
      assert.strictEqual(detectMimeType('unknown'), 'application/octet-stream');
    });

    it('should handle uppercase extensions', () => {
      assert.strictEqual(detectMimeType('FILE.TXT'), 'text/plain');
      assert.strictEqual(detectMimeType('IMAGE.PNG'), 'image/png');
    });
  });

  describe('getExtensionForMime', () => {
    it('should return extension for known MIME types', () => {
      assert.strictEqual(getExtensionForMime('text/plain'), '.txt');
      assert.strictEqual(getExtensionForMime('application/json'), '.json');
      assert.strictEqual(getExtensionForMime('image/png'), '.png');
    });

    it('should return null for unknown MIME types', () => {
      assert.strictEqual(getExtensionForMime('application/unknown'), null);
    });
  });

  describe('isTextMime', () => {
    it('should identify text types', () => {
      assert.strictEqual(isTextMime('text/plain'), true);
      assert.strictEqual(isTextMime('text/html'), true);
      assert.strictEqual(isTextMime('text/css'), true);
    });

    it('should identify text-like application types', () => {
      assert.strictEqual(isTextMime('application/json'), true);
      assert.strictEqual(isTextMime('application/javascript'), true);
      assert.strictEqual(isTextMime('application/xml'), true);
    });

    it('should not identify binary types', () => {
      assert.strictEqual(isTextMime('image/png'), false);
      assert.strictEqual(isTextMime('application/octet-stream'), false);
      assert.strictEqual(isTextMime('application/pdf'), false);
    });
  });
});
