import { httpsUrl, object, type JsonObject } from './common.js';

// Codex 0.163/0.164 rejects per-server extensions before OAuth discovery.
// Keep portal authentication metadata in public/, and let Codex discover OAuth
// from the Hub's WWW-Authenticate challenge and protected-resource metadata.
export function validateCodexHubMcp(data: JsonObject): void {
  const servers = object(data.mcpServers);
  if (Object.keys(servers).length !== 1 || !Object.hasOwn(servers, 'remote-device-hub')) {
    throw new Error('Expected exactly one remote-device-hub MCP server');
  }
  const server = object(servers['remote-device-hub']);
  const url = httpsUrl(server.url);
  if (server.type !== 'streamable-http' || url.search || url.hash) {
    throw new Error('Expected credential-free HTTPS Streamable HTTP');
  }
  if (Object.keys(server).some((key) => !['type', 'url'].includes(key))) {
    throw new Error(
      'Codex Hub MCP accepts only type and url; extensions, headers and credentials are forbidden',
    );
  }
}

// This is the Hub's packaged connection contract. OAuth credentials belong to
// the host's connection store, never to the distributable archive.
export function validateHubMcp(data: JsonObject): void {
  const servers = object(data.mcpServers);
  if (Object.keys(servers).length !== 1 || !Object.hasOwn(servers, 'remote-device-hub')) {
    throw new Error('Expected exactly one remote-device-hub MCP server');
  }
  const server = object(servers['remote-device-hub']);
  const url = httpsUrl(server.url);
  if (server.type !== 'streamable-http' || url.search || url.hash) {
    throw new Error('Expected credential-free HTTPS Streamable HTTP');
  }
  const expected = {
    type: 'oauth',
    client: { mode: 'dcr' },
    baseScopes: ['devices:control'],
  };
  const extensions = object(server.extensions);
  const extension = object(extensions['com.openai']);
  const auth = object(extension.auth);
  const client = object(auth.client);
  if (
    Object.keys(server).some((key) => !['type', 'url', 'extensions'].includes(key)) ||
    Object.keys(extensions).some((key) => key !== 'com.openai') ||
    Object.keys(extension).some((key) => key !== 'auth') ||
    Object.keys(auth).some((key) => !['type', 'client', 'baseScopes'].includes(key)) ||
    Object.keys(client).some((key) => key !== 'mode') ||
    auth.type !== expected.type ||
    client.mode !== expected.client.mode ||
    !Array.isArray(auth.baseScopes) ||
    auth.baseScopes.length !== 1 ||
    auth.baseScopes[0] !== expected.baseScopes[0]
  ) {
    throw new Error(
      'Hub MCP requires OAuth DCR and devices:control; credentials and headers are forbidden',
    );
  }
}
