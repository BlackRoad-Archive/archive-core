/**
 * File system based storage provider
 */

import { mkdir, readFile, writeFile, unlink, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { StorageProvider } from '../types/index.js';

export interface FileStorageOptions {
  /** Base directory for storage */
  basePath: string;
  /** Create base directory if it doesn't exist */
  createIfMissing?: boolean;
}

/**
 * Storage provider that uses the local filesystem
 */
export class FileStorageProvider implements StorageProvider {
  readonly name = 'file';
  private readonly basePath: string;
  private readonly createIfMissing: boolean;
  private initialized = false;

  constructor(options: FileStorageOptions) {
    this.basePath = options.basePath;
    this.createIfMissing = options.createIfMissing ?? true;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (this.createIfMissing) {
      await mkdir(this.basePath, { recursive: true });
    }
    this.initialized = true;
  }

  private getFilePath(key: string): string {
    // Use first 2 chars of key for subdirectory to avoid too many files in one dir
    const subdir = key.substring(0, 2);
    return join(this.basePath, subdir, key);
  }

  async write(key: string, data: Buffer): Promise<void> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async read(key: string): Promise<Buffer> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(key);
    return readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(key);
    await unlink(filePath);
  }

  async listKeys(): Promise<string[]> {
    await this.ensureInitialized();
    const keys: string[] = [];

    try {
      const subdirs = await readdir(this.basePath);
      for (const subdir of subdirs) {
        if (subdir.length === 2) {
          const subdirPath = join(this.basePath, subdir);
          try {
            const files = await readdir(subdirPath);
            keys.push(...files);
          } catch {
            // Subdirectory might not exist or be accessible
          }
        }
      }
    } catch {
      // Base directory might not exist yet
    }

    return keys;
  }
}
