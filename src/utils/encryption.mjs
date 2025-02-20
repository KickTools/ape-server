import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Constants for encryption
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_SECRET;
const IV_LENGTH = 16; // For CBC mode, IV length should be equal to block size (16 bytes)

// Validate encryption secret on startup
if (!SECRET_KEY) {
  throw new Error('ENCRYPTION_SECRET is not defined in the environment variables');
}

if (Buffer.from(SECRET_KEY).length !== 32) {
  throw new Error('ENCRYPTION_SECRET must be exactly 32 bytes long');
}

/**
 * Encrypts text using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text in format: iv:encryptedData
 */
export const encrypt = (text) => {
  try {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty');
    }

    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM, 
      Buffer.from(SECRET_KEY), 
      iv
    );
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted data concatenated
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypts text using AES-256-CBC
 * @param {string} encryptedData - Text to decrypt in format: iv:encryptedData
 * @returns {string} Decrypted text
 */
export const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) {
      throw new Error('Encrypted data cannot be empty');
    }

    // Split IV and encrypted data
    const [ivHex, encryptedText] = encryptedData.split(':');
    
    if (!ivHex || !encryptedText) {
      throw new Error('Invalid encrypted data format');
    }

    // Convert hex to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedText, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      Buffer.from(SECRET_KEY), 
      iv
    );
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// Optional: Add a function to validate the encryption setup
export const validateEncryptionSetup = () => {
  try {
    const testText = 'Test encryption setup';
    const encrypted = encrypt(testText);
    const decrypted = decrypt(encrypted);
    
    if (decrypted !== testText) {
      throw new Error('Encryption/decryption test failed');
    }
    
    return true;
  } catch (error) {
    throw new Error(`Encryption setup validation failed: ${error.message}`);
  }
};