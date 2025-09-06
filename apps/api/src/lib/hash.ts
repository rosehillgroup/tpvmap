import { createHash } from 'crypto';

export function generateHash(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function generateJobId(fileHash: string): string {
  const timestamp = Date.now();
  const shortHash = fileHash.slice(0, 8);
  return `${timestamp}-${shortHash}`;
}