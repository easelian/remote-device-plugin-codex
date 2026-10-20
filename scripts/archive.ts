import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { type Files, sortedFiles } from './common.js';

const PREFIX = 'remote-device-hub/';
export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Deliberately bounded ZIP32: only regular stored/deflated files, no encryption,
// descriptors or ZIP64. This is the format produced by the prior Python builder.
export function createArchive(files: Files): Buffer {
  if (files.size > 65535) throw new Error('Too many ZIP entries');
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of sortedFiles(files)) {
    const filename = Buffer.from(PREFIX + name), compressed = deflateRawSync(data), crc = crc32(data);
    const flags = filename.some(byte => byte > 127) ? 0x800 : 0;
    if (filename.length > 65535) throw new Error('ZIP filename is too long');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(788, 4); entry.writeUInt16LE(20, 6);
    header.copy(entry, 8, 6, 30);
    entry.writeUInt32LE((0o100644 * 65536) >>> 0, 38); entry.writeUInt32LE(offset, 42);
    local.push(header, filename, compressed); central.push(entry, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export function archiveContents(data: Buffer): Files {
  // Locate EOCD, accounting for an optional ZIP comment.
  let end = data.length - 22;
  while (end >= Math.max(0, data.length - 65557)) {
    if (data.readUInt32LE(end) === 0x06054b50 && end + 22 + data.readUInt16LE(end + 20) === data.length) break;
    end--;
  }
  if (end < Math.max(0, data.length - 65557) || end < 0) throw new Error('Invalid ZIP end record');
  const count = data.readUInt16LE(end + 10), size = data.readUInt32LE(end + 12), start = data.readUInt32LE(end + 16);
  if (data.readUInt32LE(end + 4) !== 0 || data.readUInt16LE(end + 8) !== count || start + size !== end) throw new Error('Unsupported ZIP directory');
  let cursor = start;
  const result: Files = new Map();
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory entry');
    const flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10);
    const crc = data.readUInt32LE(cursor + 16), compressedSize = data.readUInt32LE(cursor + 20), rawSize = data.readUInt32LE(cursor + 24);
    const length = data.readUInt16LE(cursor + 28), extra = data.readUInt16LE(cursor + 30), comment = data.readUInt16LE(cursor + 32);
    const offset = data.readUInt32LE(cursor + 42);
    if ((flags & ~0x800) !== 0 || ![0, 8].includes(method) || cursor + 46 + length + extra + comment > end) throw new Error('Unsupported ZIP entry');
    const filename = data.subarray(cursor + 46, cursor + 46 + length);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(filename);
    if (!name.startsWith(PREFIX) || name.endsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('Unexpected plugin archive entry');
    const normalized = name.slice(PREFIX.length);
    if (!normalized || normalized.startsWith('/') || normalized.split('/').some(part => part === '.' || !part)) throw new Error('Unexpected plugin archive entry');
    if (result.has(normalized)) throw new Error('Duplicate plugin archive entry');
    if (offset + 30 > start || data.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP local header');
    const localLength = data.readUInt16LE(offset + 26), localExtra = data.readUInt16LE(offset + 28);
    const body = offset + 30 + localLength + localExtra;
    if (body + compressedSize > start || data.readUInt16LE(offset + 6) !== flags || data.readUInt16LE(offset + 8) !== method ||
        data.readUInt32LE(offset + 14) !== crc || data.readUInt32LE(offset + 18) !== compressedSize || data.readUInt32LE(offset + 22) !== rawSize ||
        !data.subarray(offset + 30, offset + 30 + localLength).equals(filename)) throw new Error('ZIP local header mismatch');
    const compressed = data.subarray(body, body + compressedSize);
    const contents = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(rawSize, 1) });
    if (contents.length !== rawSize || crc32(contents) !== crc) throw new Error('Plugin archive checksum/readback failed');
    result.set(normalized, contents);
    cursor += 46 + length + extra + comment;
  }
  if (cursor !== end) throw new Error('Invalid ZIP directory size');
  return result;
}
export function sameFiles(left: Files, right: Files): boolean {
  return left.size === right.size && [...left].every(([name, value]) => right.get(name)?.equals(value));
}
