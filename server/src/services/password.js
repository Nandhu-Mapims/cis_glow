import crypto from 'crypto';

const ENCRYPTION_KEY = 'igrapixkey1';
const IV = '1234567891011121';

function getKey() {
  const keyBuffer = Buffer.alloc(16, 0);
  Buffer.from(ENCRYPTION_KEY).copy(keyBuffer);
  return keyBuffer;
}

export function encrypt(dataInput) {
  const cipher = crypto.createCipheriv('aes-128-ctr', getKey(), Buffer.from(IV));
  let encrypted = cipher.update(String(dataInput), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

export function decrypt(encoded) {
  if (!encoded) return '';
  try {
    const decipher = crypto.createDecipheriv('aes-128-ctr', getKey(), Buffer.from(IV));
    let decrypted = decipher.update(String(encoded), 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    try {
      const decipher = crypto.createDecipheriv('aes-128-ctr', getKey(), Buffer.from(IV));
      let decrypted = decipher.update(String(encoded), 'utf8', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }
}

export function normalizeUsername(username) {
  return String(username || '').trim().toUpperCase();
}
