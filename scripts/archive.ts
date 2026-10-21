import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { type Files, sortedFiles } from './common.js';

const PREFIX = 'remote-device-hub/';

const MAX_ZIP16 = 0xffff;
const ZIP_VERSION = 20;
const PYTHON_UNIX_CREATOR_VERSION = 788;
const UTF8_FILENAME_FLAG = 0x800;
const STORED = 0;
const DEFLATED = 8;
const DOS_EPOCH_DATE = 33; // January 1, 1980; time is midnight.
const UNIX_REGULAR_FILE_MODE = 0o100644;

const LOCAL_HEADER = {
  bytes: 30,
  signature: 0x04034b50,
  version: 4,
  flags: 6,
  method: 8,
  modifiedDate: 12,
  crc: 14,
  compressedSize: 18,
  rawSize: 22,
  nameLength: 26,
  extraLength: 28,
} as const;

const CENTRAL_HEADER = {
  bytes: 46,
  signature: 0x02014b50,
  creatorVersion: 4,
  version: 6,
  flags: 8,
  method: 10,
  crc: 16,
  compressedSize: 20,
  rawSize: 24,
  nameLength: 28,
  extraLength: 30,
  commentLength: 32,
  externalAttributes: 38,
  localOffset: 42,
} as const;

const END_RECORD = {
  bytes: 22,
  signature: 0x06054b50,
  diskNumbers: 4,
  entriesOnDisk: 8,
  entries: 10,
  directorySize: 12,
  directoryOffset: 16,
  commentLength: 20,
} as const;

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Deliberately bounded ZIP32: only regular stored/deflated files, no encryption,
// descriptors or ZIP64. This is the format produced by the prior Python builder.
export function createArchive(files: Files): Buffer {
  if (files.size > MAX_ZIP16) {
    throw new Error('Too many ZIP entries');
  }
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of sortedFiles(files)) {
    const filename = Buffer.from(PREFIX + name);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const flags = filename.some((byte) => byte > 127) ? UTF8_FILENAME_FLAG : 0;
    if (filename.length > MAX_ZIP16) {
      throw new Error('ZIP filename is too long');
    }
    const header = Buffer.alloc(LOCAL_HEADER.bytes);
    header.writeUInt32LE(LOCAL_HEADER.signature);
    header.writeUInt16LE(ZIP_VERSION, LOCAL_HEADER.version);
    header.writeUInt16LE(flags, LOCAL_HEADER.flags);
    header.writeUInt16LE(DEFLATED, LOCAL_HEADER.method);
    header.writeUInt16LE(DOS_EPOCH_DATE, LOCAL_HEADER.modifiedDate);
    header.writeUInt32LE(crc, LOCAL_HEADER.crc);
    header.writeUInt32LE(compressed.length, LOCAL_HEADER.compressedSize);
    header.writeUInt32LE(data.length, LOCAL_HEADER.rawSize);
    header.writeUInt16LE(filename.length, LOCAL_HEADER.nameLength);
    const entry = Buffer.alloc(CENTRAL_HEADER.bytes);
    entry.writeUInt32LE(CENTRAL_HEADER.signature);
    entry.writeUInt16LE(PYTHON_UNIX_CREATOR_VERSION, CENTRAL_HEADER.creatorVersion);
    entry.writeUInt16LE(ZIP_VERSION, CENTRAL_HEADER.version);
    header.copy(entry, CENTRAL_HEADER.flags, LOCAL_HEADER.flags, LOCAL_HEADER.bytes);
    entry.writeUInt32LE((UNIX_REGULAR_FILE_MODE * 65536) >>> 0, CENTRAL_HEADER.externalAttributes);
    entry.writeUInt32LE(offset, CENTRAL_HEADER.localOffset);
    local.push(header, filename, compressed);
    central.push(entry, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(END_RECORD.bytes);
  end.writeUInt32LE(END_RECORD.signature);
  end.writeUInt16LE(files.size, END_RECORD.entriesOnDisk);
  end.writeUInt16LE(files.size, END_RECORD.entries);
  end.writeUInt32LE(directory.length, END_RECORD.directorySize);
  end.writeUInt32LE(offset, END_RECORD.directoryOffset);
  return Buffer.concat([...local, directory, end]);
}
export function archiveContents(data: Buffer): Files {
  // Locate EOCD, accounting for an optional ZIP comment.
  let end = data.length - END_RECORD.bytes;
  while (end >= Math.max(0, data.length - END_RECORD.bytes - MAX_ZIP16)) {
    if (
      data.readUInt32LE(end) === END_RECORD.signature &&
      end + END_RECORD.bytes + data.readUInt16LE(end + END_RECORD.commentLength) === data.length
    ) {
      break;
    }
    end--;
  }
  if (end < Math.max(0, data.length - END_RECORD.bytes - MAX_ZIP16) || end < 0) {
    throw new Error('Invalid ZIP end record');
  }
  const count = data.readUInt16LE(end + END_RECORD.entries);
  const size = data.readUInt32LE(end + END_RECORD.directorySize);
  const start = data.readUInt32LE(end + END_RECORD.directoryOffset);
  if (
    data.readUInt32LE(end + END_RECORD.diskNumbers) !== 0 ||
    data.readUInt16LE(end + END_RECORD.entriesOnDisk) !== count ||
    start + size !== end
  ) {
    throw new Error('Unsupported ZIP directory');
  }
  let cursor = start;
  const result: Files = new Map();
  for (let index = 0; index < count; index++) {
    if (
      cursor + CENTRAL_HEADER.bytes > end ||
      data.readUInt32LE(cursor) !== CENTRAL_HEADER.signature
    ) {
      throw new Error('Invalid ZIP directory entry');
    }
    const flags = data.readUInt16LE(cursor + CENTRAL_HEADER.flags);
    const method = data.readUInt16LE(cursor + CENTRAL_HEADER.method);
    const crc = data.readUInt32LE(cursor + CENTRAL_HEADER.crc);
    const compressedSize = data.readUInt32LE(cursor + CENTRAL_HEADER.compressedSize);
    const rawSize = data.readUInt32LE(cursor + CENTRAL_HEADER.rawSize);
    const length = data.readUInt16LE(cursor + CENTRAL_HEADER.nameLength);
    const extra = data.readUInt16LE(cursor + CENTRAL_HEADER.extraLength);
    const comment = data.readUInt16LE(cursor + CENTRAL_HEADER.commentLength);
    const offset = data.readUInt32LE(cursor + CENTRAL_HEADER.localOffset);
    if (
      (flags & ~UTF8_FILENAME_FLAG) !== 0 ||
      ![STORED, DEFLATED].includes(method) ||
      cursor + CENTRAL_HEADER.bytes + length + extra + comment > end
    ) {
      throw new Error('Unsupported ZIP entry');
    }
    const filename = data.subarray(
      cursor + CENTRAL_HEADER.bytes,
      cursor + CENTRAL_HEADER.bytes + length,
    );
    const name = new TextDecoder('utf-8', { fatal: true }).decode(filename);
    if (
      !name.startsWith(PREFIX) ||
      name.endsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..')
    ) {
      throw new Error('Unexpected plugin archive entry');
    }
    const normalized = name.slice(PREFIX.length);
    if (
      !normalized ||
      normalized.startsWith('/') ||
      normalized.split('/').some((part) => part === '.' || !part)
    ) {
      throw new Error('Unexpected plugin archive entry');
    }
    if (result.has(normalized)) {
      throw new Error('Duplicate plugin archive entry');
    }
    if (
      offset + LOCAL_HEADER.bytes > start ||
      data.readUInt32LE(offset) !== LOCAL_HEADER.signature
    ) {
      throw new Error('Invalid ZIP local header');
    }
    const localLength = data.readUInt16LE(offset + LOCAL_HEADER.nameLength);
    const localExtra = data.readUInt16LE(offset + LOCAL_HEADER.extraLength);
    const body = offset + LOCAL_HEADER.bytes + localLength + localExtra;
    if (
      body + compressedSize > start ||
      data.readUInt16LE(offset + LOCAL_HEADER.flags) !== flags ||
      data.readUInt16LE(offset + LOCAL_HEADER.method) !== method ||
      data.readUInt32LE(offset + LOCAL_HEADER.crc) !== crc ||
      data.readUInt32LE(offset + LOCAL_HEADER.compressedSize) !== compressedSize ||
      data.readUInt32LE(offset + LOCAL_HEADER.rawSize) !== rawSize ||
      !data
        .subarray(offset + LOCAL_HEADER.bytes, offset + LOCAL_HEADER.bytes + localLength)
        .equals(filename)
    ) {
      throw new Error('ZIP local header mismatch');
    }
    const compressed = data.subarray(body, body + compressedSize);
    const contents =
      method === STORED
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: Math.max(rawSize, 1) });
    if (contents.length !== rawSize || crc32(contents) !== crc) {
      throw new Error('Plugin archive checksum/readback failed');
    }
    result.set(normalized, contents);
    cursor += CENTRAL_HEADER.bytes + length + extra + comment;
  }
  if (cursor !== end) {
    throw new Error('Invalid ZIP directory size');
  }
  return result;
}
export function sameFiles(left: Files, right: Files): boolean {
  return (
    left.size === right.size && [...left].every(([name, value]) => right.get(name)?.equals(value))
  );
}
