import {
  fullMatch,
  object,
  parseJson,
  requiredFile,
  text,
  type Files,
  type JsonObject,
} from './common.js';
import { openai } from './models.js';
import { validateContent } from './plugin_source.js';

// The registered App owns tools and OAuth. There is no direct-MCP fallback.
export function validateAppBinding(binding: JsonObject): string {
  const apps = object(binding.apps);
  if (
    Object.keys(binding).length !== 1 ||
    Object.keys(apps).length !== 1 ||
    !Object.hasOwn(apps, 'remote-device-hub')
  ) {
    throw new Error('Expected exactly one remote-device-hub App binding');
  }
  const app = object(apps['remote-device-hub']);
  if (
    Object.keys(app).some((key) => !['id', 'required'].includes(key)) ||
    app.required !== true ||
    !fullMatch(/(?:asdk_app_|connector_|templated_apps_)[a-zA-Z0-9_-]+/, text(app.id))
  ) {
    throw new Error(
      'App binding requires a registered id and required: true; credentials are forbidden',
    );
  }
  return text(app.id);
}

export function validatePlugin(files: Files) {
  const result = validateContent(files, ['.app.json']);
  const manifest = result[0];
  const extension = openai(manifest);
  if (
    extension.apps !== './.app.json' ||
    'mcpServers' in extension ||
    'mcpServers' in manifest ||
    'apps' in manifest ||
    'hooks' in extension
  ) {
    throw new Error(
      'Plugin must declare only its required App dependency in extensions.com.openai.apps',
    );
  }
  validateAppBinding(parseJson(requiredFile(files, '.app.json')));
  return result;
}
