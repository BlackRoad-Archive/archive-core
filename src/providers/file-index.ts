/**
 * File system based index provider using JSON
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type {
  IndexProvider,
  ArchiveRecord,
  ArchiveId,
  ListOptions,
  ListResult,
} from '../types/index.js';

export interface FileIndexOptions {
  /** Path to the index file */
  indexPath: string;
  /** Create parent directories if they don't exist */
  createIfMissing?: boolean;
}

interface IndexData {
  version: number;
  records: Record<ArchiveId, ArchiveRecord>;
}

/**
 * Index provider that stores metadata in a JSON file
 */
export class FileIndexProvider implements IndexProvider {
  readonly name = 'file';
  private readonly indexPath: string;
  private readonly createIfMissing: boolean;
  private cache: IndexData | null = null;
  private dirty = false;

  constructor(options: FileIndexOptions) {
    this.indexPath = options.indexPath;
    this.createIfMissing = options.createIfMissing ?? true;
  }

  private async load(): Promise<IndexData> {
    if (this.cache) return this.cache;

    try {
      await access(this.indexPath);
      const content = await readFile(this.indexPath, 'utf-8');
      this.cache = JSON.parse(content, (key, value) => {
        // Revive Date objects
        if (key === 'archivedAt' || key === 'lastAccessedAt' || key === 'verifiedAt') {
          return value ? new Date(value) : value;
        }
        return value;
      }) as IndexData;
    } catch {
      this.cache = { version: 1, records: {} };
    }

    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache || !this.dirty) return;

    if (this.createIfMissing) {
      await mkdir(dirname(this.indexPath), { recursive: true });
    }

    await writeFile(
      this.indexPath,
      JSON.stringify(this.cache, null, 2),
      'utf-8'
    );
    this.dirty = false;
  }

  async put(record: ArchiveRecord): Promise<void> {
    const data = await this.load();
    data.records[record.id] = record;
    this.dirty = true;
    await this.save();
  }

  async get(id: ArchiveId): Promise<ArchiveRecord | null> {
    const data = await this.load();
    return data.records[id] ?? null;
  }

  async delete(id: ArchiveId): Promise<void> {
    const data = await this.load();
    delete data.records[id];
    this.dirty = true;
    await this.save();
  }

  async list(options: ListOptions): Promise<ListResult> {
    const data = await this.load();
    let records = Object.values(data.records);

    // Apply filters
    if (options.tags && options.tags.length > 0) {
      records = records.filter((r) =>
        options.tags!.every((tag) => r.metadata.tags.includes(tag))
      );
    }

    if (options.mimeTypePrefix) {
      records = records.filter((r) =>
        r.metadata.mimeType.startsWith(options.mimeTypePrefix!)
      );
    }

    if (options.archivedAfter) {
      records = records.filter(
        (r) => r.metadata.archivedAt >= options.archivedAfter!
      );
    }

    if (options.archivedBefore) {
      records = records.filter(
        (r) => r.metadata.archivedAt <= options.archivedBefore!
      );
    }

    // Sort by archived date (newest first)
    records.sort(
      (a, b) =>
        b.metadata.archivedAt.getTime() - a.metadata.archivedAt.getTime()
    );

    const total = records.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? records.length;

    const items = records.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
    };
  }

  async allIds(): Promise<ArchiveId[]> {
    const data = await this.load();
    return Object.keys(data.records);
  }
}
