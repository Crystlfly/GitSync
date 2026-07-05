import { verifySignature } from '../src/utils/signatureValidator.js';
import crypto from 'crypto';

describe('verifySignature', () => {
  const secret = 'test-webhook-secret';
  const payload = JSON.stringify({ event: 'ping', zen: 'Keep it simple.' });

  test('should pass with a valid HMAC-SHA256 signature', () => {
    // Compute valid signature
    const hmac = crypto.createHmac('sha256', secret);
    const validSignature = 'sha256=' + hmac.update(payload).digest('hex');

    const result = verifySignature(payload, validSignature, secret);
    expect(result).toBe(true);
  });

  test('should fail with an invalid signature', () => {
    const invalidSignature = 'sha256=invalidhashvalue1234567890abcdef';

    const result = verifySignature(payload, invalidSignature, secret);
    expect(result).toBe(false);
  });

  test('should fail if inputs are missing', () => {
    expect(verifySignature(null, 'sha256=abc', secret)).toBe(false);
    expect(verifySignature(payload, null, secret)).toBe(false);
    expect(verifySignature(payload, 'sha256=abc', null)).toBe(false);
  });
});
