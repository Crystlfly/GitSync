import crypto from 'crypto';

/**
 * Validates a GitHub x-hub-signature-256 HMAC signature.
 * 
 * @param {string|Buffer} rawBody - The raw request body payload.
 * @param {string} signature - The signature header from the request.
 * @param {string} secret - The webhook secret string.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
export function verifySignature(rawBody, signature, secret) {
  if (rawBody === undefined || rawBody === null || !signature || !secret) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const computedDigest = 'sha256=' + hmac.update(bodyStr).digest('hex');

    const clientSigBuffer = Buffer.from(signature);
    const serverSigBuffer = Buffer.from(computedDigest);

    if (clientSigBuffer.length !== serverSigBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(clientSigBuffer, serverSigBuffer);
  } catch (error) {
    return false;
  }
}
