import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type TestClient } from './utils/client';
import { validEvent } from './utils/payload';

// Mirrors the bounds declared by the app's arktype schema.
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEM_LENGTH = 128;

const REQUIRED_FIELDS = [
  'installationId',
  'version',
  'command',
  'runtimeName',
  'runtimeVersion',
  'os',
  'arch',
] as const;

describe('POST /events — validation', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await createClient();
  }, 180_000);

  afterAll(async () => {
    await client.close();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send('{"installationId":');
    expect(res.status).toBe(400);
  });

  it('rejects an empty body with 400', async () => {
    const res = await client.post('/events').set('content-type', 'application/json').send('');
    expect(res.status).toBe(400);
  });

  it('rejects a JSON array instead of an object with 400', async () => {
    const res = await client.post('/events').set('content-type', 'application/json').send('[]');
    expect(res.status).toBe(400);
  });

  it('rejects an empty required string with 400', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent({ command: '' }));
    expect(res.status).toBe(400);
  });

  for (const field of REQUIRED_FIELDS) {
    it(`rejects a payload missing ${field} with 400`, async () => {
      const payload = validEvent();
      delete (payload as Record<string, unknown>)[field];
      const res = await client
        .post('/events')
        .set('content-type', 'application/json')
        .send(payload);
      expect(res.status).toBe(400);
    });
  }

  it('rejects strings beyond the schema bound with 400', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent({ command: 'x'.repeat(MAX_STRING_LENGTH + 1) }));
    expect(res.status).toBe(400);
  });

  it('rejects array items beyond the schema bound with 400', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent({ flags: ['f'.repeat(MAX_ARRAY_ITEM_LENGTH + 1)] }));
    expect(res.status).toBe(400);
  });

  it('describes the validation failure in the error body', async () => {
    const res = await client
      .post('/events')
      .set('content-type', 'application/json')
      .send(validEvent({ command: '' }));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });
});
