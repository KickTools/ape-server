import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Ensure the encryption key is 32 bytes
const algorithm = 'aes-256-cbc';
const secretKey = process.env.ENCRYPTION_SECRET;

if (!secretKey) {
  throw new Error('ENCRYPTION_SECRET is not defined in the environment variables');
}

if (secretKey.length !== 32) {
  throw new Error('ENCRYPTION_SECRET must be exactly 32 bytes long');
}

// Function to encrypt data
export const encrypt = (text) => {
  const iv = crypto.randomBytes(16); // Generate a random IV for each encryption
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
  decrypted = Buffer.concat([decrypted, cipher.final()]);
  return decrypted.toString();
};