import { isJsonObject, object, parseJson, type JsonObject } from './common.js';

export type PluginInterface = JsonObject & {
  shortDescription: string;
};

export type OpenAIExtension = JsonObject & {
  interface: PluginInterface;
};

export type PluginManifest = JsonObject & {
  name: string;
  version: string;
  extensions: JsonObject & { 'com.openai': OpenAIExtension };
};

export function openai(manifest: PluginManifest): OpenAIExtension;
export function openai(manifest: JsonObject): JsonObject;
export function openai(manifest: JsonObject): JsonObject {
  return object(object(manifest.extensions)['com.openai']);
}

// Preserve all declared metadata; parsing never reconstructs the manifest.
export function readPluginManifest(data: Buffer | string): PluginManifest {
  const value = parseJson(data);
  const ext = openai(value);
  if (
    value.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json' ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'string' ||
    !isJsonObject(ext.interface) ||
    typeof ext.interface.shortDescription !== 'string'
  ) {
    throw new Error('Invalid plugin manifest fields');
  }
  return value as PluginManifest;
}
