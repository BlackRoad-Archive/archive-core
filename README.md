# archive-core

Core archival system for long-term data preservation with integrity verification.

## Features

- **Data Integrity**: SHA-256/SHA-512 checksums for all stored content
- **Metadata Indexing**: Fast search by tags, MIME types, and dates
- **Pluggable Storage**: Built-in filesystem provider, extensible for custom backends
- **CLI & API**: Use programmatically or from the command line
- **Type-Safe**: Written in TypeScript with full type definitions

## Installation

```bash
npm install @blackroad-archive/core
```

## Quick Start

### CLI Usage

```bash
# Store a file
archive store document.pdf --tags backup,important

# List all items
archive list

# Retrieve a file
archive retrieve <id> --output restored.pdf

# Verify integrity
archive verify

# Get archive statistics
archive stats
```

### Programmatic Usage

```typescript
import { Archive, FileStorageProvider, FileIndexProvider } from '@blackroad-archive/core';

// Create an archive instance
const archive = new Archive({
  storage: new FileStorageProvider({
    basePath: './my-archive/data',
  }),
  index: new FileIndexProvider({
    indexPath: './my-archive/index.json',
  }),
});

// Store data
const record = await archive.store(Buffer.from('Hello, World!'), {
  filename: 'greeting.txt',
  tags: ['example', 'text'],
});

console.log(`Stored with ID: ${record.id}`);

// Retrieve data
const data = await archive.retrieve(record.id, { verifyIntegrity: true });
console.log(data.toString()); // "Hello, World!"

// List items
const { items } = await archive.list({ tags: ['example'] });
console.log(`Found ${items.length} items`);

// Verify all items
const results = await archive.verifyAll();
for (const [id, result] of results) {
  console.log(`${id}: ${result.valid ? 'OK' : 'CORRUPTED'}`);
}
```

## API Reference

### Archive Class

The main interface for the archival system.

#### `store(data: Buffer, options?: StoreOptions): Promise<ArchiveRecord>`

Store binary data in the archive.

```typescript
const record = await archive.store(fileBuffer, {
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  tags: ['reports', '2025'],
  properties: { author: 'Jane Doe' },
});
```

#### `storeText(text: string, options?: StoreOptions): Promise<ArchiveRecord>`

Store text content in the archive.

#### `retrieve(id: string, options?: RetrieveOptions): Promise<Buffer>`

Retrieve stored data by ID.

```typescript
const data = await archive.retrieve(id, {
  verifyIntegrity: true,  // Verify checksum before returning
  updateAccessTime: true, // Update last accessed timestamp
});
```

#### `list(options?: ListOptions): Promise<ListResult>`

List archived items with optional filtering.

```typescript
const result = await archive.list({
  tags: ['important'],
  mimeTypePrefix: 'image/',
  archivedAfter: new Date('2025-01-01'),
  limit: 50,
  offset: 0,
});
```

#### `verify(id: string): Promise<VerificationResult>`

Verify the integrity of a specific item.

#### `verifyAll(): Promise<Map<string, VerificationResult>>`

Verify integrity of all items in the archive.

#### `delete(id: string): Promise<void>`

Delete an item from the archive.

#### `stats(): Promise<ArchiveStats>`

Get statistics about the archive.

### Custom Storage Providers

Implement the `StorageProvider` interface for custom backends:

```typescript
import type { StorageProvider } from '@blackroad-archive/core';

class S3StorageProvider implements StorageProvider {
  readonly name = 's3';

  async write(key: string, data: Buffer): Promise<void> {
    // Upload to S3
  }

  async read(key: string): Promise<Buffer> {
    // Download from S3
  }

  async exists(key: string): Promise<boolean> {
    // Check if object exists
  }

  async delete(key: string): Promise<void> {
    // Delete from S3
  }

  async listKeys(): Promise<string[]> {
    // List all objects
  }
}
```

## CLI Reference

```
archive <command> [options] [arguments]

Commands:
  store <file>           Store a file in the archive
  retrieve <id>          Retrieve a file from the archive
  get <id>               Get metadata for an archived item
  list                   List all archived items
  delete <id>            Delete an item from the archive
  verify [id]            Verify integrity of item(s)
  tag <id> <tags...>     Add tags to an item
  stats                  Show archive statistics

Options:
  -d, --dir <path>       Archive directory (default: ~/.archive-core)
  -t, --tags <tags>      Comma-separated tags (for store command)
  -o, --output <path>    Output file path (for retrieve command)
  -v, --verify           Verify integrity when retrieving
  -l, --limit <n>        Limit number of results (for list command)
  -j, --json             Output in JSON format
  -h, --help             Show help message
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Contributing

This project is part of the BlackRoad-Archive organization in the BlackRoad ecosystem.

## License

MIT

---

<div align="center">
  <sub>Part of <a href="https://github.com/BlackRoad-Archive">BlackRoad-Archive</a> in the BlackRoad Ecosystem</sub>
</div>
