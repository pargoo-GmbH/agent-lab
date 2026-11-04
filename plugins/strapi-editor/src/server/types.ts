import type { Profile, ProfileInput } from '../shared/types.ts';

export type Fields = Record<string, unknown>;
export type Credentials = {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  redact<T>(value: T): T;
};
export type FilePicker = {
  chooseFile(): Promise<{ path?: string; name?: string; cancelled?: boolean; ok?: boolean }>;
};
export type StoredProfile = Omit<Profile, 'separateUploadToken' | 'uploadTokenConfigured'> & {
  mcpUrl: string;
  mcpCredential: string;
  uploadCredential: string;
  createdAt: string;
  updatedAt: string;
};
export type ProfileSettings = Omit<ProfileInput, 'separateUploadToken' | 'maxFileSizeMb'> & {
  separateUploadToken?: boolean;
  maxFileSizeMb?: number;
};
export type Tokens = { mcp?: string; upload?: string };
export type ConnectionCheck = {
  revision: string;
  checkedAt: string;
  status: 'connected' | 'needs_attention';
  message: string;
};
export type Context = {
  id: string;
  uiNonce: string;
  createdAt: string;
  selection: { profileId: string; fingerprint: string; confirmedAt: string } | null;
  checks?: Record<string, ConnectionCheck>;
};
export type CallInput = {
  contextId: string;
  toolName: string;
  arguments?: Fields;
  requestId?: string;
};
export type UploadInput = {
  file: string;
  requestId: string;
  expectedCmsUrl?: string;
  folderId?: number;
  name?: string;
  alt?: string;
  caption?: string;
};
export type UploadConfig = {
  cmsUrl: string;
  adminToken: string;
  stateDir: string;
  maxFileSizeMb?: number;
  timeoutMs?: number;
  profile?: string | null;
};
export type OperationInput = Partial<UploadInput> & {
  contextId: string;
  requestId?: string;
  kind: 'mcp' | 'upload';
  toolName?: string;
  arguments?: Fields;
};
export type Operation = {
  id: string;
  digest: string;
  input: OperationInput;
  profileId: string;
  revision: string;
  state: 'awaiting_confirmation' | 'running' | 'complete' | 'failed' | 'result_unknown';
  needsApproval: boolean;
  createdAt: string;
  result?: Fields;
  error?: { code: string; message: string; resultUnknown?: boolean };
};
export type UiRequest = { contextId: string; uiNonce?: string } & (
  | { action: 'create_project'; project: { name: string } }
  | { action: 'remove_project'; projectId: string }
  | { action: 'save_profile'; profile: ProfileSettings; tokens?: Tokens; projectId?: string }
  | { action: 'remove_profile' | 'select_profile'; profileId: string; revision: string }
  | { action: 'check_profile'; profileId: string }
  | { action: 'retry_credential_cleanup' | 'state' }
  | { action: 'execute_operation'; operationId: string }
);
export type RpcResponse = {
  id: number;
  error?: unknown;
  result: Fields;
};
export type PendingRequest<T> = {
  resolve(value: T): void;
  reject(reason: Error): void;
  timer: ReturnType<typeof setTimeout>;
};
