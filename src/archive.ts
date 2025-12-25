/**
 * Main Archive class - the primary interface for the archival system
 */

import type {
  ArchiveConfig,
  ArchiveId,
  ArchiveRecord,
  StoreOptions,
  RetrieveOptions,
  ListOptions,
  ListResult,
  VerificationResult,
  HashAlgorithm,
} from './types/index.js';
import { createIntegrityInfo, verifyIntegrity, generateArchiveId } from './utils/integrity.js';
import { detectMimeType } from './utils/mime.js';

/**
 * Core Archive class for storing and retrieving data with integrity verification
 */
export class Archive {
  private readonly config: ArchiveConfig;
  private readonly defaultHashAlgorithm: HashAlgorithm;

  constructor(config: ArchiveConfig) {
    this.config = config;
    this.defaultHashAlgorithm = config.defaultHashAlgorithm ?? 'sha256';
  }

  /**
   * Store data in the archive
   */
  async store(data: Buffer, options: StoreOptions = {}): Promise<ArchiveRecord> {
    const id = generateArchiveId();
    const algorithm = options.hashAlgorithm ?? this.defaultHashAlgorithm;

    // Create integrity info
    const integrity = createIntegrityInfo(data, algorithm);

    // Use hash as storage key for deduplication potential
    const storageKey = `${integrity.hash.substring(0, 16)}-${id}`;

    // Detect MIME type if not provided
    const mimeType = options.mimeType ?? (options.filename ? detectMimeType(options.filename) : 'application/octet-stream');

    // Create the record
    const record: ArchiveRecord = {
      id,
      metadata: {
        filename: options.filename ?? 'untitled',
        mimeType,
        size: data.length,
        archivedAt: new Date(),
        tags: options.tags ?? [],
        properties: options.properties ?? {},
      },
      integrity,
      storageKey,
    };

    // Store the data
    await this.config.storage.write(storageKey, data);

    // Index the record
    await this.config.index.put(record);

    return record;
  }

  /**
   * Store data from a string
   */
  async storeText(text: string, options: StoreOptions = {}): Promise<ArchiveRecord> {
    const data = Buffer.from(text, 'utf-8');
    return this.store(data, {
      ...options,
      mimeType: options.mimeType ?? 'text/plain',
    });
  }

  /**
   * Retrieve data from the archive
   */
  async retrieve(id: ArchiveId, options: RetrieveOptions = {}): Promise<Buffer> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    const data = await this.config.storage.read(record.storageKey);

    // Verify integrity if requested
    if (options.verifyIntegrity) {
      const result = verifyIntegrity(data, record.integrity);
      if (!result.valid) {
        throw new Error(
          `Integrity verification failed for ${id}: expected ${result.expected}, got ${result.actual}`
        );
      }
    }

    // Update access time if requested
    if (options.updateAccessTime) {
      record.metadata.lastAccessedAt = new Date();
      await this.config.index.put(record);
    }

    return data;
  }

  /**
   * Retrieve data as a string
   */
  async retrieveText(id: ArchiveId, options: RetrieveOptions = {}): Promise<string> {
    const data = await this.retrieve(id, options);
    return data.toString('utf-8');
  }

  /**
   * Get metadata for an archived item without retrieving the data
   */
  async getRecord(id: ArchiveId): Promise<ArchiveRecord | null> {
    return this.config.index.get(id);
  }

  /**
   * Delete an item from the archive
   */
  async delete(id: ArchiveId): Promise<void> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    await this.config.storage.delete(record.storageKey);
    await this.config.index.delete(id);
  }

  /**
   * List archived items
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    return this.config.index.list(options);
  }

  /**
   * Verify the integrity of an archived item
   */
  async verify(id: ArchiveId): Promise<VerificationResult> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    const data = await this.config.storage.read(record.storageKey);
    const result = verifyIntegrity(data, record.integrity);

    // Update verification timestamp
    if (result.valid) {
      record.integrity.verifiedAt = new Date();
      await this.config.index.put(record);
    }

    return result;
  }

  /**
   * Verify integrity of all items in the archive
   */
  async verifyAll(): Promise<Map<ArchiveId, VerificationResult>> {
    const results = new Map<ArchiveId, VerificationResult>();
    const ids = await this.config.index.allIds();

    for (const id of ids) {
      try {
        const result = await this.verify(id);
        results.set(id, result);
      } catch (error) {
        results.set(id, {
          valid: false,
          expected: '',
          actual: '',
          algorithm: 'sha256',
        });
      }
    }

    return results;
  }

  /**
   * Update tags for an archived item
   */
  async updateTags(id: ArchiveId, tags: string[]): Promise<ArchiveRecord> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    record.metadata.tags = tags;
    await this.config.index.put(record);
    return record;
  }

  /**
   * Add tags to an archived item
   */
  async addTags(id: ArchiveId, tags: string[]): Promise<ArchiveRecord> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    const existingTags = new Set(record.metadata.tags);
    for (const tag of tags) {
      existingTags.add(tag);
    }
    record.metadata.tags = Array.from(existingTags);
    await this.config.index.put(record);
    return record;
  }

  /**
   * Update custom properties for an archived item
   */
  async updateProperties(
    id: ArchiveId,
    properties: Record<string, unknown>
  ): Promise<ArchiveRecord> {
    const record = await this.config.index.get(id);
    if (!record) {
      throw new Error(`Archive item not found: ${id}`);
    }

    record.metadata.properties = { ...record.metadata.properties, ...properties };
    await this.config.index.put(record);
    return record;
  }

  /**
   * Get statistics about the archive
   */
  async stats(): Promise<{
    totalItems: number;
    totalSize: number;
    oldestItem: Date | null;
    newestItem: Date | null;
  }> {
    const { items, total } = await this.list({ limit: 1000000 });

    let totalSize = 0;
    let oldestItem: Date | null = null;
    let newestItem: Date | null = null;

    for (const item of items) {
      totalSize += item.metadata.size;

      if (!oldestItem || item.metadata.archivedAt < oldestItem) {
        oldestItem = item.metadata.archivedAt;
      }
      if (!newestItem || item.metadata.archivedAt > newestItem) {
        newestItem = item.metadata.archivedAt;
      }
    }

    return {
      totalItems: total,
      totalSize,
      oldestItem,
      newestItem,
    };
  }
}
