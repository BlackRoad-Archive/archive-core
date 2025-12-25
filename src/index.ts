/**
 * archive-core - Core archival system for long-term data preservation
 *
 * @packageDocumentation
 */

// Main Archive class
export { Archive } from './archive.js';

// Types
export type {
  ArchiveId,
  HashAlgorithm,
  ArchiveMetadata,
  IntegrityInfo,
  ArchiveRecord,
  StoreOptions,
  RetrieveOptions,
  ListOptions,
  ListResult,
  VerificationResult,
  StorageProvider,
  IndexProvider,
  ArchiveConfig,
} from './types/index.js';

// Providers
export {
  FileStorageProvider,
  type FileStorageOptions,
  FileIndexProvider,
  type FileIndexOptions,
} from './providers/index.js';

// Utilities
export {
  computeHash,
  createIntegrityInfo,
  verifyIntegrity,
  generateArchiveId,
} from './utils/integrity.js';

export {
  detectMimeType,
  getExtensionForMime,
  isTextMime,
} from './utils/mime.js';
