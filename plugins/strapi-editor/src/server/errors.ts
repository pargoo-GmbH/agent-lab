import type { StoredProfile } from './types.ts';
import { UploadError } from './strapi/media-upload.ts';

export class EditorError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function publicError(error: unknown): {
  ok: false;
  code: string;
  message: string;
  resultUnknown?: boolean;
} {
  if (error instanceof EditorError) {
    return { ok: false, code: error.code, message: error.message, ...error.details };
  }

  if (error instanceof UploadError) {
    return error.toJSON();
  }

  return {
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'The operation could not be completed. Check the connection and try again.',
  };
}

export function requireValue(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new EditorError(code, message);
  }
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

export function publicProfile(profile: StoredProfile) {
  const { mcpCredential, uploadCredential, ...safe } = profile;

  return {
    ...safe,
    mcpTokenConfigured: Boolean(mcpCredential),
    uploadTokenConfigured: Boolean(uploadCredential),
    separateUploadToken: uploadCredential !== mcpCredential,
  };
}
