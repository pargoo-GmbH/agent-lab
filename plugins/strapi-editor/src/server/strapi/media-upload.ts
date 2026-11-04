import type { BinaryLike } from 'node:crypto';
import type { UploadConfig, UploadInput } from '../types.ts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join } from 'node:path';

type UploadResult = {
  ok: boolean;
  cmsUrl: string;
  profile: string | null;
  requestId: string;
  asset: Record<string, unknown>;
  reusedReceipt: boolean;
  receiptSaved: boolean;
};
type Receipt = {
  fingerprint: string;
  cmsUrl: string;
  profile: string | null;
  requestId: string;
  folderId: number | null;
  state: string;
  result?: UploadResult;
};
// Adapted from the existing Strapi Media 0.1.1 uploader. Receipts and upload semantics are preserved.

const MIB = 1024 * 1024;
const IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export class UploadError extends Error {
  code: string;
  details: Record<string, unknown> & { resultUnknown?: boolean };
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> & { resultUnknown?: boolean } = {},
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      resultUnknown: false,
      ...this.details,
    };
  }
}

const hash = (value: BinaryLike) => createHash('sha256').update(value).digest('hex');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[\x21-\x7e]+$/.test(value) && !value.startsWith('REPLACE_WITH_');
const isProfileName = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value);

export function normalizeCmsUrl(value: string) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UploadError(
      'CONFIG_ERROR',
      'Enter a valid Strapi base URL in the environment settings.',
    );
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new UploadError(
      'CONFIG_ERROR',
      'CMS URL must use HTTPS without credentials, query or fragment; HTTP is allowed only for loopback development.',
    );
  }

  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function validateConfig(input: UploadConfig) {
  if (!isRecord(input)) {
    throw new UploadError('CONFIG_ERROR', 'Configuration must be an object.');
  }

  const cmsUrl = normalizeCmsUrl(input.cmsUrl);

  if (!isToken(input.adminToken)) {
    throw new UploadError(
      'CONFIG_ERROR',
      'Configure an Admin token locally with Media Library Read and Create.',
    );
  }

  const maxFileSizeMb = input.maxFileSizeMb ?? 10;
  const timeoutMs = input.timeoutMs ?? 120_000;

  if (
    !Number.isFinite(maxFileSizeMb) ||
    maxFileSizeMb <= 0 ||
    !Number.isSafeInteger(Math.floor(maxFileSizeMb * MIB)) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2_147_483_647 ||
    typeof input.stateDir !== 'string' ||
    !isAbsolute(input.stateDir)
  ) {
    throw new UploadError(
      'CONFIG_ERROR',
      'Use positive maxFileSizeMb/timeoutMs values and an absolute stateDir.',
    );
  }

  const profile = input.profile ?? null;

  if (profile !== null && !isProfileName(profile)) {
    throw new UploadError('CONFIG_ERROR', 'Use a valid profile name.');
  }

  return {
    cmsUrl,
    profile,
    adminToken: input.adminToken,
    maxFileSizeMb,
    timeoutMs,
    stateDir: input.stateDir,
  };
}

function checkTarget(config: Required<UploadConfig>, expectedCmsUrl?: string) {
  if (expectedCmsUrl !== undefined && config.cmsUrl !== normalizeCmsUrl(expectedCmsUrl)) {
    throw new UploadError(
      'TARGET_MISMATCH',
      'The selected upload target differs from the expected CMS; nothing was sent.',
      { cmsUrl: config.cmsUrl, profile: config.profile },
    );
  }
}

function detectMime(bytes: Buffer) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  throw new UploadError(
    'UNSUPPORTED_IMAGE',
    'Use a JPEG, PNG or WebP file with a matching image signature.',
  );
}

async function readImage(file: string, maxBytes: number) {
  let handle;
  try {
    handle = await open(file, 'r');
  } catch {
    throw new UploadError('FILE_ERROR', 'The original image file is not readable.');
  }
  try {
    const info = await handle.stat();

    if (!info.isFile() || info.size === 0) {
      throw new UploadError('FILE_ERROR', 'Select a non-empty regular image file.');
    }

    if (info.size > maxBytes) {
      throw new UploadError(
        'FILE_TOO_LARGE',
        'The image exceeds the configured upload size limit.',
      );
    }

    // Read no more than the limit even if the file grows while it is being read.
    const chunks: Buffer[] = [];
    let size = 0;

    while (true) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes - size + 1));
      const { bytesRead } = await handle.read(chunk);

      if (!bytesRead) {
        break;
      }

      size += bytesRead;

      if (size > maxBytes) {
        throw new UploadError(
          'FILE_TOO_LARGE',
          'The image exceeds the configured upload size limit.',
        );
      }

      chunks.push(chunk.subarray(0, bytesRead));
    }

    const bytes = Buffer.concat(chunks);
    const mime = detectMime(bytes);
    const extension = extname(file).toLowerCase();

    if (extension && !IMAGE_TYPES[mime].includes(extension)) {
      throw new UploadError(
        'IMAGE_EXTENSION_MISMATCH',
        'The image extension does not match its contents.',
      );
    }

    return { bytes, mime, fileName: basename(file) + (extension ? '' : IMAGE_TYPES[mime][0]) };
  } finally {
    await handle.close();
  }
}

function validateOptions(input: UploadInput) {
  if (
    typeof input.file !== 'string' ||
    !input.file ||
    typeof input.requestId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(input.requestId)
  ) {
    throw new UploadError(
      'ARGUMENT_ERROR',
      'Provide the original image file and a unique requestId (letters, digits, underscores or hyphens).',
    );
  }

  if (
    input.folderId !== undefined &&
    (!Number.isSafeInteger(input.folderId) || input.folderId <= 0)
  ) {
    throw new UploadError(
      'ARGUMENT_ERROR',
      'Use a positive numeric folderId, or omit it for the Media Library root.',
    );
  }

  for (const field of ['name', 'alt', 'caption'] as const) {
    if (
      input[field] !== undefined &&
      (typeof input[field] !== 'string' || /[\u0000-\u001f]/.test(input[field]))
    ) {
      throw new UploadError(
        'ARGUMENT_ERROR',
        'Image metadata must be text without control characters.',
      );
    }
  }

  if (input.name !== undefined && (!input.name.trim() || /[/\\]/.test(input.name))) {
    throw new UploadError(
      'ARGUMENT_ERROR',
      'The media name must be non-empty and contain no path separators.',
    );
  }
}

function sanitizeAsset(value: unknown, folderId: number | null) {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.url !== 'string' ||
    !value.url ||
    typeof value.mime !== 'string' ||
    !Object.hasOwn(IMAGE_TYPES, value.mime)
  ) {
    throw new UploadError(
      'INVALID_UPLOAD_RESPONSE',
      'Strapi did not return a usable image asset ID.',
      { resultUnknown: true },
    );
  }

  const asset: Record<string, unknown> = { id: value.id, folderId };

  for (const key of [
    'name',
    'alternativeText',
    'caption',
    'url',
    'mime',
    'size',
    'width',
    'height',
  ]) {
    if (
      value[key] !== undefined &&
      (value[key] === null || ['string', 'number'].includes(typeof value[key]))
    ) {
      asset[key] = value[key];
    }
  }

  return asset;
}

async function claimReceipt(path: string, pending: Receipt) {
  let handle;
  try {
    handle = await open(path, 'wx', 0o600);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw new UploadError('STATE_ERROR', 'Cannot create an upload receipt; nothing was sent.');
    }

    let existing: Receipt;
    try {
      existing = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      throw new UploadError(
        'UPLOAD_RESULT_UNKNOWN',
        'An existing upload receipt is unresolved; check Media Library before another upload.',
        { resultUnknown: true },
      );
    }

    if (!isRecord(existing) || typeof existing.fingerprint !== 'string') {
      throw new UploadError(
        'UPLOAD_RESULT_UNKNOWN',
        'An existing upload receipt is unusable; check Media Library before another upload.',
        { resultUnknown: true },
      );
    }

    if (existing.fingerprint !== pending.fingerprint) {
      throw new UploadError(
        'REQUEST_ID_CONFLICT',
        'This request ID already belongs to different upload inputs.',
      );
    }

    if (
      existing.state !== 'complete' ||
      !existing.result ||
      existing.result.cmsUrl !== pending.cmsUrl ||
      existing.result.profile !== pending.profile
    ) {
      throw new UploadError(
        'UPLOAD_RESULT_UNKNOWN',
        'This upload may already have been sent; check Media Library before another upload.',
        { resultUnknown: true },
      );
    }

    return {
      ...existing.result,
      asset: sanitizeAsset(existing.result.asset, pending.folderId),
      reusedReceipt: true,
    };
  }
  try {
    await handle.writeFile(JSON.stringify(pending));
    await handle.sync();
  } catch {
    throw new UploadError('STATE_ERROR', 'Cannot save an upload receipt; nothing was sent.');
  } finally {
    await handle.close();
  }

  return null;
}

async function completeReceipt(path: string, pending: Receipt, result: UploadResult) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify({ ...pending, state: 'complete', result }), {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, path);

    return true;
  } catch {
    await unlink(temporary).catch(() => {});

    return false;
  }
}

export async function uploadImage(
  input: UploadInput,
  rawConfig: UploadConfig,
  { fetchImpl = globalThis.fetch } = {},
) {
  validateOptions(input);
  const config = validateConfig(rawConfig);
  checkTarget(config, input.expectedCmsUrl);
  const image = await readImage(input.file, Math.floor(config.maxFileSizeMb * MIB));
  const folderId = input.folderId ?? null;
  const fileInfo = {
    name: input.name ?? image.fileName,
    alternativeText: input.alt ?? null,
    caption: input.caption ?? null,
    folder: folderId,
  };
  const context = {
    cmsUrl: config.cmsUrl,
    profile: config.profile,
    requestId: input.requestId,
    name: fileInfo.name,
    folderId,
  };
  const pending = {
    version: 2,
    state: 'pending',
    ...context,
    createdAt: new Date().toISOString(),
    fingerprint: hash(
      JSON.stringify([config.cmsUrl, config.profile, hash(image.bytes), image.fileName, fileInfo]),
    ),
  };
  try {
    await mkdir(config.stateDir, { recursive: true, mode: 0o700 });
  } catch {
    throw new UploadError(
      'STATE_ERROR',
      'Cannot create the upload receipt directory; nothing was sent.',
    );
  }
  const receiptPath = join(
    config.stateDir,
    hash(JSON.stringify([config.cmsUrl, config.profile, input.requestId])) + '.json',
  );
  let previous;
  try {
    previous = await claimReceipt(receiptPath, pending);
  } catch (error) {
    if (error instanceof UploadError) {
      error.details = { ...context, ...error.details };
    }

    throw error;
  }

  if (previous) {
    return previous;
  }

  const form = new FormData();
  form.append('files', new Blob([image.bytes], { type: image.mime }), image.fileName);
  form.append('fileInfo', JSON.stringify(fileInfo));
  let result: UploadResult;
  try {
    const response = await fetchImpl(config.cmsUrl + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.adminToken },
      body: form,
      redirect: 'manual',
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      const uncertain = response.status >= 500 || response.status === 408;

      if (!uncertain) {
        await unlink(receiptPath);
      }

      const message =
        response.status === 401
          ? 'The configured Admin token is invalid or expired.'
          : response.status === 403
            ? 'The Admin token needs Media Library Read and Create.'
            : response.status === 413
              ? 'Strapi rejected the image size.'
              : response.status >= 300 && response.status < 400
                ? 'Upload redirects are disabled; verify the configured CMS base URL.'
                : 'Strapi rejected the upload; check the image, folder and CMS limits.';
      throw new UploadError('UPLOAD_HTTP_ERROR', message, {
        ...context,
        status: response.status,
        resultUnknown: uncertain,
      });
    }

    const body = await response.json();

    // POST /upload returns an array, even for one file.
    if (!Array.isArray(body) || body.length !== 1) {
      throw new UploadError('INVALID_UPLOAD_RESPONSE', 'Expected one Strapi image asset.', {
        resultUnknown: true,
      });
    }

    result = {
      ok: true,
      cmsUrl: config.cmsUrl,
      profile: config.profile,
      requestId: input.requestId,
      asset: sanitizeAsset(body[0], folderId),
      reusedReceipt: false,
      receiptSaved: true,
    };
  } catch (error) {
    if (error instanceof UploadError) {
      error.details = { ...context, ...error.details };
      throw error;
    }

    throw new UploadError(
      'UPLOAD_RESULT_UNKNOWN',
      'The upload response was interrupted; check Media Library before another upload.',
      { ...context, resultUnknown: true },
    );
  }
  result.receiptSaved = await completeReceipt(receiptPath, pending, result);

  return result;
}
