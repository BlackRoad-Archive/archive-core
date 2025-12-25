/**
 * Integrity verification utilities using cryptographic hashes
 */

import { createHash } from 'node:crypto';
import type { HashAlgorithm, IntegrityInfo, VerificationResult } from '../types/index.js';

/**
 * Compute a hash of the given data
 */
export function computeHash(data: Buffer, algorithm: HashAlgorithm): string {
  return createHash(algorithm).update(data).digest('hex');
}

/**
 * Create integrity info for the given data
 */
export function createIntegrityInfo(
  data: Buffer,
  algorithm: HashAlgorithm = 'sha256'
): IntegrityInfo {
  return {
    algorithm,
    hash: computeHash(data, algorithm),
    verifiedAt: new Date(),
  };
}

/**
 * Verify the integrity of data against expected integrity info
 */
export function verifyIntegrity(
  data: Buffer,
  expected: IntegrityInfo
): VerificationResult {
  const actual = computeHash(data, expected.algorithm);
  return {
    valid: actual === expected.hash,
    expected: expected.hash,
    actual,
    algorithm: expected.algorithm,
  };
}

/**
 * Generate a unique ID based on content hash and timestamp
 */
export function generateArchiveId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
