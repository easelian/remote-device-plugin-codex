import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject { [key: string]: Json }
export type Files = Map<string, Buffer>;
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const ICON_BYTE_LIMIT = 10_000;
export function object(value: unknown, label = 'JSON object'): JsonObject {
  if (!isJsonObject(value)) throw new Error(`Expected ${label}`);
  return value;
}
function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isJson);
}
function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === 'object' && Object.values(value).every(isJson);
}
export function text(value: unknown, label = 'string'): string {
  if (typeof value !== 'string') throw new Error(`Expected ${label}`);
  return value;
}
export function fullMatch(pattern: RegExp, value: string): boolean {
  return pattern.exec(value)?.[0] === value;
}
export function parseJson(data: Buffer | string): JsonObject {
  const value: unknown = JSON.parse(typeof data === 'string' ? data : utf8(data));
  return object(value);
}
export function utf8(data: Buffer): string { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
export function canonicalJson(value: Json): Buffer { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`); }
export function digest(data: Buffer): string { return createHash('sha256').update(data).digest('hex'); }
export function sortedFiles(files: Files): [string, Buffer][] {
  return [...files].sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
export function hashes(files: Files): JsonObject { return Object.fromEntries(sortedFiles(files).map(([name, data]) => [name, digest(data)])); }
export function fingerprint(files: Files): string { return digest(canonicalJson(hashes(files))); }
export function requiredFile(files: Files, name: string): Buffer {
  const data = files.get(name);
  if (data === undefined) throw new Error(`Missing component: ${name}`);
  return data;
}
export function immutableWrite(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  // lstat also finds dangling symlinks, which must never be followed.
  if (existsSync(path) || isSymlink(path)) {
    if (isSymlink(path) || !readFileSync(path).equals(data)) throw new Error(`Refusing to replace ${path}; increase the plugin version`);
    return;
  }
  writeFileSync(path, data, { flag: 'wx' });
}
export function isSymlink(path: string): boolean {
  try { return lstatSync(path).isSymbolicLink(); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
export function localPath(reference: unknown): string {
  if (typeof reference !== 'string' || !reference.startsWith('./')) throw new Error('Component paths must begin with ./');
  const raw = reference.slice(2);
  if (!raw || isAbsolute(raw) || raw.split('/').includes('..') || raw.includes('\\')) throw new Error('Asset reference escapes the plugin');
  const normalized = raw.split('/').filter(part => part && part !== '.').join('/');
  if (!normalized) throw new Error('Asset reference escapes the plugin');
  return normalized;
}
export function privatePath(name: string): boolean {
  return name.split('/').some(part => ['.venv', '.build', 'state', 'workspace', 'node_modules', '__pycache__'].includes(part) || part.includes('.local.') || part.startsWith('.env'));
}
export function isContainedRelativePath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return !isAbsolute(path) && !win32.isAbsolute(path) && normalized !== '..' && !normalized.startsWith('../');
}
export function containedFile(base: string, reference: unknown): [string, Buffer] {
  const name = localPath(reference);
  if (privatePath(name)) throw new Error('Unsafe or private component path');
  let current = base;
  for (const part of name.split('/')) {
    current = join(current, part);
    if (isSymlink(current)) throw new Error('Referenced assets may not be symlinks');
  }
  if (!lstatSync(current).isFile()) throw new Error(`Missing component: ${String(reference)}`);
  return [name, readFileSync(current)];
}
export function validatePng(key: string, data: Buffer, minimum = 48): void {
  if (data.length >= ICON_BYTE_LIMIT) throw new Error(`PNG icon must be below ${ICON_BYTE_LIMIT} bytes: ${key}`);
  if (data.length < 24 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error(`Invalid PNG icon: ${key}`);
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  if (width !== height || width < minimum || width > 4096) throw new Error(`Invalid icon dimensions: ${key}`);
}
export function httpsUrl(value: unknown): URL {
  if (typeof value !== 'string' || [...value].length > 1024) throw new Error('Expected an HTTPS URL of at most 1024 characters');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Expected a credential-free HTTPS URL');
  return url;
}
export function isMain(url: string): boolean { return process.argv[1] !== undefined && fileURLToPath(url) === process.argv[1]; }
