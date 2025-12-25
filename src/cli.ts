#!/usr/bin/env node
/**
 * Command-line interface for archive-core
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { Archive } from './archive.js';
import { FileStorageProvider } from './providers/file-storage.js';
import { FileIndexProvider } from './providers/file-index.js';
import type { ListOptions } from './types/index.js';

const DEFAULT_ARCHIVE_DIR = join(homedir(), '.archive-core');

function createArchive(archiveDir: string): Archive {
  return new Archive({
    storage: new FileStorageProvider({
      basePath: join(archiveDir, 'data'),
    }),
    index: new FileIndexProvider({
      indexPath: join(archiveDir, 'index.json'),
    }),
  });
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      dir: { type: 'string', short: 'd', default: DEFAULT_ARCHIVE_DIR },
      tags: { type: 'string', short: 't' },
      output: { type: 'string', short: 'o' },
      verify: { type: 'boolean', short: 'v' },
      limit: { type: 'string', short: 'l' },
      json: { type: 'boolean', short: 'j' },
    },
  });

  const command = positionals[0];
  const archive = createArchive(values.dir!);

  if (values.help || !command) {
    console.log(`
archive-core - Core archival system for long-term data preservation

Usage: archive <command> [options] [arguments]

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
  -h, --help             Show this help message
`);
    return;
  }

  try {
    switch (command) {
      case 'store': {
        const filePath = positionals[1];
        if (!filePath) {
          console.error('Error: No file path provided');
          process.exit(1);
        }

        const data = await readFile(filePath);
        const filename = filePath.split('/').pop() ?? 'untitled';
        const tags = values.tags ? values.tags.split(',').map((t) => t.trim()) : [];

        const record = await archive.store(data, { filename, tags });

        if (values.json) {
          console.log(JSON.stringify(record, null, 2));
        } else {
          console.log(`Stored: ${record.id}`);
          console.log(`  Filename: ${record.metadata.filename}`);
          console.log(`  Size: ${formatSize(record.metadata.size)}`);
          console.log(`  Hash: ${record.integrity.hash.substring(0, 16)}...`);
          if (tags.length > 0) {
            console.log(`  Tags: ${tags.join(', ')}`);
          }
        }
        break;
      }

      case 'retrieve': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: No archive ID provided');
          process.exit(1);
        }

        const data = await archive.retrieve(id, {
          verifyIntegrity: values.verify ?? false,
        });

        if (values.output) {
          await writeFile(values.output, data);
          console.log(`Written to: ${values.output}`);
        } else {
          process.stdout.write(data);
        }
        break;
      }

      case 'get': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: No archive ID provided');
          process.exit(1);
        }

        const record = await archive.getRecord(id);
        if (!record) {
          console.error(`Error: Item not found: ${id}`);
          process.exit(1);
        }

        if (values.json) {
          console.log(JSON.stringify(record, null, 2));
        } else {
          console.log(`ID: ${record.id}`);
          console.log(`Filename: ${record.metadata.filename}`);
          console.log(`MIME Type: ${record.metadata.mimeType}`);
          console.log(`Size: ${formatSize(record.metadata.size)}`);
          console.log(`Archived: ${formatDate(record.metadata.archivedAt)}`);
          console.log(`Hash (${record.integrity.algorithm}): ${record.integrity.hash}`);
          if (record.metadata.tags.length > 0) {
            console.log(`Tags: ${record.metadata.tags.join(', ')}`);
          }
        }
        break;
      }

      case 'list': {
        const options: ListOptions = {};
        if (values.tags) {
          options.tags = values.tags.split(',').map((t) => t.trim());
        }
        if (values.limit) {
          options.limit = parseInt(values.limit, 10);
        }

        const result = await archive.list(options);

        if (values.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (result.items.length === 0) {
            console.log('No items in archive');
          } else {
            console.log(`Showing ${result.items.length} of ${result.total} items:\n`);
            for (const item of result.items) {
              const tags = item.metadata.tags.length > 0 ? ` [${item.metadata.tags.join(', ')}]` : '';
              console.log(`${item.id}  ${item.metadata.filename}  ${formatSize(item.metadata.size)}${tags}`);
            }
          }
        }
        break;
      }

      case 'delete': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: No archive ID provided');
          process.exit(1);
        }

        await archive.delete(id);
        console.log(`Deleted: ${id}`);
        break;
      }

      case 'verify': {
        const id = positionals[1];

        if (id) {
          const result = await archive.verify(id);
          if (values.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`${id}: ${result.valid ? 'VALID' : 'INVALID'}`);
            if (!result.valid) {
              console.log(`  Expected: ${result.expected}`);
              console.log(`  Actual: ${result.actual}`);
            }
          }
        } else {
          const results = await archive.verifyAll();
          let valid = 0;
          let invalid = 0;

          for (const [itemId, result] of results) {
            if (result.valid) {
              valid++;
            } else {
              invalid++;
              console.log(`INVALID: ${itemId}`);
            }
          }

          console.log(`\nVerification complete: ${valid} valid, ${invalid} invalid`);
        }
        break;
      }

      case 'tag': {
        const id = positionals[1];
        const tags = positionals.slice(2);

        if (!id) {
          console.error('Error: No archive ID provided');
          process.exit(1);
        }
        if (tags.length === 0) {
          console.error('Error: No tags provided');
          process.exit(1);
        }

        const record = await archive.addTags(id, tags);
        console.log(`Tags updated: ${record.metadata.tags.join(', ')}`);
        break;
      }

      case 'stats': {
        const stats = await archive.stats();

        if (values.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log('Archive Statistics:');
          console.log(`  Total items: ${stats.totalItems}`);
          console.log(`  Total size: ${formatSize(stats.totalSize)}`);
          if (stats.oldestItem) {
            console.log(`  Oldest item: ${formatDate(stats.oldestItem)}`);
          }
          if (stats.newestItem) {
            console.log(`  Newest item: ${formatDate(stats.newestItem)}`);
          }
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "archive --help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
