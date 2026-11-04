export type Environment = 'dev' | 'production';
export type Project = { id: string; name: string };
export type Profile = {
  id: string;
  revision: string;
  project: string;
  name: string;
  environment: Environment;
  cmsUrl: string;
  maxFileSizeMb: number;
  separateUploadToken: boolean;
  uploadTokenConfigured: boolean;
};
export type PendingOperation = {
  operationId: string;
  profile: Profile;
  operation: {
    kind: string;
    toolName?: string;
    arguments?: Record<string, unknown>;
    file?: string;
    name?: string;
    alt?: string;
    caption?: string;
    folderId?: number;
  };
};
export type EditorState = {
  ok: boolean;
  contextId: string;
  projects: Project[];
  profiles: Profile[];
  selected: Profile | null;
  checks: Record<string, { status: string; checkedAt: string; message?: string }>;
  pendingOperations: PendingOperation[];
  credentialCleanupPending: boolean;
};
export type ProfileInput = Omit<Profile, 'id' | 'revision' | 'uploadTokenConfigured'> & {
  id?: string;
  revision?: string;
};
