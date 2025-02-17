import crypto from 'crypto';

// Ensure the encryption key is 32 bytes
const algorithm = 'aes-256-cbc';
let secretKey = process.env.ENCRYPTION_SECRET;

if (secretKey.length !== 32) {
  throw new Error('ENCRYPTION_SECRET must be exactly 32 bytes long');
}

const iv = crypto.randomBytes(16);

// Function to encrypt data
export const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Function to decrypt data
export const decrypt = (text) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};