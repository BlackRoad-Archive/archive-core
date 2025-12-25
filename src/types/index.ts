/**
 * Core types for the archive system
 */

/** Unique identifier for archived items */
export type ArchiveId = string;

/** Supported hash algorithms for integrity verification */
export type HashAlgorithm = 'sha256' | 'sha512' | 'md5';

/** Metadata associated with an archived item */
export interface ArchiveMetadata {
  /** Original filename */
  filename: string;
  /** MIME type of the content */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** When the item was archived */
  archivedAt: Date;
  /** When the item was last accessed */
  lastAccessedAt?: Date;
  /** Custom user-defined tags */
  tags: string[];
  /** Custom user-defined properties */
  properties: Record<string, unknown>;
}

/** Integrity information for verification */
export interface IntegrityInfo {
  /** Hash algorithm used */
  algorithm: HashAlgorithm;
  /** Hash value as hex string */
  hash: string;
  /** When the integrity was last verified */
  verifiedAt?: Date;
}

/** Complete record of an archived item */
export interface ArchiveRecord {
  /** Unique identifier */
  id: ArchiveId;
  /** Item metadata */
  metadata: ArchiveMetadata;
  /** Integrity information */
  integrity: IntegrityInfo;
  /** Storage location reference */
  storageKey: string;
}

/** Options for storing content */
export interface StoreOptions {
  /** Original filename */
  filename?: string;
  /** MIME type (will be detected if not provided) */
  mimeType?: string;
  /** Tags to associate with the item */
  tags?: string[];
  /** Custom properties */
  properties?: Record<string, unknown>;
  /** Hash algorithm to use for integrity */
  hashAlgorithm?: HashAlgorithm;
}

/** Options for retrieving content */
export interface RetrieveOptions {
  /** Whether to verify integrity before returning */
  verifyIntegrity?: boolean;
  /** Update last accessed timestamp */
  updateAccessTime?: boolean;
}

/** Options for listing archived items */
export interface ListOptions {
  /** Filter by tags (items must have all specified tags) */
  tags?: string[];
  /** Filter by MIME type prefix (e.g., 'image/' for all images) */
  mimeTypePrefix?: string;
  /** Filter by archived date range */
  archivedAfter?: Date;
  archivedBefore?: Date;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Result of a list operation */
export interface ListResult {
  /** Matching records */
  items: ArchiveRecord[];
  /** Total count of matching items */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/** Result of an integrity verification */
export interface VerificationResult {
  /** Whether the verification passed */
  valid: boolean;
  /** Expected hash */
  expected: string;
  /** Actual computed hash */
  actual: string;
  /** Algorithm used */
  algorithm: HashAlgorithm;
}

/** Storage provider interface - implement this for custom storage backends */
export interface StorageProvider {
  /** Provider name for identification */
  readonly name: string;

  /** Store raw data and return a storage key */
  write(key: string, data: Buffer): Promise<void>;

  /** Retrieve raw data by storage key */
  read(key: string): Promise<Buffer>;

  /** Check if a key exists */
  exists(key: string): Promise<boolean>;

  /** Delete data by storage key */
  delete(key: string): Promise<void>;

  /** List all storage keys */
  listKeys(): Promise<string[]>;
}

/** Index provider interface - implement this for custom indexing backends */
export interface IndexProvider {
  /** Provider name for identification */
  readonly name: string;

  /** Store a record in the index */
  put(record: ArchiveRecord): Promise<void>;

  /** Get a record by ID */
  get(id: ArchiveId): Promise<ArchiveRecord | null>;

  /** Delete a record from the index */
  delete(id: ArchiveId): Promise<void>;

  /** List records matching options */
  list(options: ListOptions): Promise<ListResult>;

  /** Get all record IDs */
  allIds(): Promise<ArchiveId[]>;
}

/** Archive configuration options */
export interface ArchiveConfig {
  /** Storage provider to use */
  storage: StorageProvider;
  /** Index provider to use */
  index: IndexProvider;
  /** Default hash algorithm */
  defaultHashAlgorithm?: HashAlgorithm;
}
