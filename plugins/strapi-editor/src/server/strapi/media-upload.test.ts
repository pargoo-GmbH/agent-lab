import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadImage } from './media-upload.ts';
import { harness } from '../fixtures.ts';

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
test('upload receipts reuse successful uploads, reject changed inputs and block concurrent duplicates', async (t) => {
  const { directory } = await harness(t);
  const file = join(directory, 'test.png');
  await writeFile(file, png);
  const config = {
    cmsUrl: 'https://cms.example.com',
    profile: randomUUID(),
    adminToken: 'synthetic-token',
    stateDir: join(directory, 'uploads'),
  };
  let posts = 0;
  const fetchImpl = async () => {
    posts++;
    await new Promise((r) => setTimeout(r, 30));

    return new Response(JSON.stringify([{ id: 42, url: '/test.png', mime: 'image/png' }]), {
      status: 200,
    });
  };
  const input = { file, requestId: randomUUID() };
  const results = await Promise.allSettled([
    uploadImage(input, config, { fetchImpl }),
    uploadImage(input, config, { fetchImpl }),
  ]);
  assert.equal(posts, 1);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const again = await uploadImage(input, config, { fetchImpl });
  assert.equal(again.reusedReceipt, true);
  assert.equal(posts, 1);
  await assert.rejects(uploadImage({ ...input, alt: 'Changed' }, config, { fetchImpl }), {
    code: 'REQUEST_ID_CONFLICT',
  });
});

test('a lost upload response remains unresolved and cannot be bypassed with the same request ID', async (t) => {
  const { directory } = await harness(t);
  const file = join(directory, 'test.png');
  await writeFile(file, png);
  const config = {
    cmsUrl: 'https://cms.example.com',
    profile: randomUUID(),
    adminToken: 'synthetic-token',
    stateDir: join(directory, 'uploads'),
  };
  let posts = 0;
  const fetchImpl = async () => {
    posts++;
    throw new Error('lost response');
  };
  const input = { file, requestId: randomUUID() };
  await assert.rejects(uploadImage(input, config, { fetchImpl }), {
    code: 'UPLOAD_RESULT_UNKNOWN',
  });
  await assert.rejects(uploadImage(input, config, { fetchImpl }), {
    code: 'UPLOAD_RESULT_UNKNOWN',
  });
  assert.equal(posts, 1);
});

test('target, image signature and size are validated before sending', async (t) => {
  const { directory } = await harness(t);
  const file = join(directory, 'test.png');
  await writeFile(file, Buffer.from('not an image'));
  const config = {
    cmsUrl: 'https://cms.example.com',
    profile: randomUUID(),
    adminToken: 'synthetic-token',
    stateDir: join(directory, 'uploads'),
  };
  let posts = 0;
  const fetchImpl = async () => {
    posts++;
  };
  await assert.rejects(
    uploadImage(
      { file, requestId: randomUUID(), expectedCmsUrl: 'https://other.example.com' },
      config,
      { fetchImpl },
    ),
    { code: 'TARGET_MISMATCH' },
  );
  await assert.rejects(uploadImage({ file, requestId: randomUUID() }, config, { fetchImpl }), {
    code: 'UNSUPPORTED_IMAGE',
  });
  await writeFile(file, png);
  await assert.rejects(
    uploadImage(
      { file, requestId: randomUUID() },
      { ...config, maxFileSizeMb: 0.000001 },
      { fetchImpl },
    ),
    { code: 'FILE_TOO_LARGE' },
  );
  assert.equal(posts, 0);
});
