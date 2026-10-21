import { isJsonObject, parseJson, type Json, type JsonObject } from './common.js';

export type Profile = 'standalone' | 'connected';
export type Stage = 'prepared' | 'uploaded' | 'published' | 'verified' | 'failed';
export type CheckResult = 'passed' | 'failed' | 'unverified';

// Intersections preserve unconsumed manifest fields and their serialization order.
// Optional fields stay absent when absent in the source; parsing never rebuilds JSON.
export type PluginInterface = JsonObject & {
  shortDescription: string;
  displayName?: string;
  longDescription?: string;
  composerIcon?: string;
  composerIconDark?: string;
  logo?: string;
  logoDark?: string;
};

export type OpenAIExtension = JsonObject & {
  interface: PluginInterface;
  apps?: string;
  requires_local_executor?: boolean;
};

export type PluginManifest = JsonObject & {
  name: string;
  version: string;
  extensions: JsonObject & { 'com.openai': OpenAIExtension };
};

export type CompatibilityManifest = JsonObject & {
  name: string;
  version: string;
  interface: PluginInterface;
  apps?: string;
  requires_local_executor?: boolean;
};

export interface SourceState extends JsonObject {
  git_commit: string | null;
  git_tree: string | null;
  working_tree: string;
  sha256: string;
  files: Record<string, string>;
}

export type BuildMetadata = JsonObject & {
  builder: string;
  builder_sha256: string;
  profile: Profile;
  python?: string;
  node?: string;
  builder_files?: Record<string, string>;
};

export interface ArtifactMetadata extends JsonObject {
  path: string;
  sha256: string;
  bytes: number;
}

export interface Evidence extends JsonObject {
  path: string;
  sha256: string;
}

export type ReleaseEvent = JsonObject & {
  stage: Stage;
  at: string;
  host?: string;
  checks?: Record<string, CheckResult>;
  evidence?: Evidence[];
  note?: string;
};

export interface ReleaseRecord extends JsonObject {
  schema_version: 2;
  component: 'plugin';
  channel: string;
  version: string;
  created_at: string;
  stage: Stage;
  source: SourceState;
  build: BuildMetadata;
  artifact: ArtifactMetadata;
  identities: JsonObject;
  checks: Record<string, CheckResult>;
  events: ReleaseEvent[];
}

function optionalString(value: Json | undefined): boolean {
  return value === undefined || typeof value === 'string';
}

function isStringMap(value: unknown): value is Record<string, string> {
  return isJsonObject(value) && Object.values(value).every((item) => typeof item === 'string');
}

export function isStage(value: unknown): value is Stage {
  return (
    value === 'prepared' ||
    value === 'uploaded' ||
    value === 'published' ||
    value === 'verified' ||
    value === 'failed'
  );
}

export function isCheckResult(value: unknown): value is CheckResult {
  return value === 'passed' || value === 'failed' || value === 'unverified';
}

function isChecks(value: unknown): value is Record<string, CheckResult> {
  return isJsonObject(value) && Object.values(value).every(isCheckResult);
}

function isPluginInterface(value: unknown): value is PluginInterface {
  return (
    isJsonObject(value) &&
    typeof value.shortDescription === 'string' &&
    [
      'displayName',
      'longDescription',
      'composerIcon',
      'composerIconDark',
      'logo',
      'logoDark',
    ].every((key) => optionalString(value[key]))
  );
}

function isOpenAIExtension(value: unknown): value is OpenAIExtension {
  return (
    isJsonObject(value) &&
    isPluginInterface(value.interface) &&
    optionalString(value.apps) &&
    (value.requires_local_executor === undefined ||
      typeof value.requires_local_executor === 'boolean')
  );
}

function isPluginManifest(value: unknown): value is PluginManifest {
  return (
    isJsonObject(value) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    isJsonObject(value.extensions) &&
    isOpenAIExtension(value.extensions['com.openai'])
  );
}

function isCompatibilityManifest(value: unknown): value is CompatibilityManifest {
  return (
    isJsonObject(value) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    isPluginInterface(value.interface) &&
    optionalString(value.apps) &&
    (value.requires_local_executor === undefined ||
      typeof value.requires_local_executor === 'boolean')
  );
}

function isSourceState(value: unknown): value is SourceState {
  return (
    isJsonObject(value) &&
    (value.git_commit === null || typeof value.git_commit === 'string') &&
    (value.git_tree === null || typeof value.git_tree === 'string') &&
    typeof value.working_tree === 'string' &&
    typeof value.sha256 === 'string' &&
    isStringMap(value.files)
  );
}

function isBuildMetadata(value: unknown): value is BuildMetadata {
  return (
    isJsonObject(value) &&
    typeof value.builder === 'string' &&
    typeof value.builder_sha256 === 'string' &&
    (value.profile === 'standalone' || value.profile === 'connected') &&
    optionalString(value.python) &&
    optionalString(value.node) &&
    (value.builder_files === undefined || isStringMap(value.builder_files))
  );
}

function isArtifactMetadata(value: unknown): value is ArtifactMetadata {
  return (
    isJsonObject(value) &&
    typeof value.path === 'string' &&
    typeof value.sha256 === 'string' &&
    typeof value.bytes === 'number' &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes >= 0
  );
}

function isEvidence(value: unknown): value is Evidence {
  return isJsonObject(value) && typeof value.path === 'string' && typeof value.sha256 === 'string';
}

function isReleaseEvent(value: unknown): value is ReleaseEvent {
  return (
    isJsonObject(value) &&
    isStage(value.stage) &&
    typeof value.at === 'string' &&
    optionalString(value.host) &&
    optionalString(value.note) &&
    (value.checks === undefined || isChecks(value.checks)) &&
    (value.evidence === undefined ||
      (Array.isArray(value.evidence) && value.evidence.every(isEvidence)))
  );
}

function isReleaseRecord(value: unknown): value is ReleaseRecord {
  return (
    isJsonObject(value) &&
    value.schema_version === 2 &&
    value.component === 'plugin' &&
    typeof value.channel === 'string' &&
    typeof value.version === 'string' &&
    typeof value.created_at === 'string' &&
    isStage(value.stage) &&
    isSourceState(value.source) &&
    isBuildMetadata(value.build) &&
    isArtifactMetadata(value.artifact) &&
    isJsonObject(value.identities) &&
    isChecks(value.checks) &&
    Array.isArray(value.events) &&
    value.events.every(isReleaseEvent)
  );
}

export function readPluginManifest(data: Buffer | string): PluginManifest {
  const value = parseJson(data);
  if (!isPluginManifest(value)) {
    throw new Error('Invalid plugin manifest fields');
  }
  return value;
}

export function readCompatibilityManifest(data: Buffer | string): CompatibilityManifest {
  const value = parseJson(data);
  if (!isCompatibilityManifest(value)) {
    throw new Error('Invalid compatibility manifest fields');
  }
  return value;
}

export function readReleaseRecord(data: Buffer | string): ReleaseRecord {
  const value = parseJson(data);
  if (!isReleaseRecord(value)) {
    throw new Error('Invalid release record fields');
  }
  return value;
}
