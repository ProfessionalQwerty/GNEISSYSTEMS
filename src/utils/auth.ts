import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import * as crypto from 'crypto';

const TOKEN_FILE = path.join(os.homedir(), '.gneiss', 'auth.json');
const API_BASE_URL = process.env.GNEISS_API_URL || 'https://gneiss-systems.vercel.app';
const ENCRYPTION_KEY = process.env.GNEISS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  encrypted: boolean;
}

export async function initiateGitHubAuth(): Promise<string> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/auth/github/cli`, {
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.data || !response.data.auth_url) {
      throw new Error('Invalid response from authentication server');
    }
    
    return response.data.auth_url;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Authentication request timed out. Please check your connection.');
      }
      if (error.response?.status === 503) {
        throw new Error('Authentication service temporarily unavailable. Please try again later.');
      }
    }
    throw new Error('Failed to initiate GitHub authentication. Please check your connection.');
  }
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  if (!code || code.trim().length === 0) {
    throw new Error('Invalid authorization code');
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/github/exchange`, {
      code: code.trim()
    }, {
      timeout: 15000 // 15 second timeout
    });

    if (!response.data || !response.data.access_token) {
      throw new Error('Invalid response from authentication server');
    }

    const expiresInSeconds = response.data.expires_in || 3600; // Default to 1 hour
    
    const authData: AuthData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (expiresInSeconds * 1000),
      encrypted: true
    };

    await saveAuthData(authData);
    return authData.accessToken;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Authentication request timed out. Please check your connection.');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid or expired authorization code. Please try again.');
      }
      if (error.response?.status === 503) {
        throw new Error('Authentication service temporarily unavailable. Please try again later.');
      }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
    }
    throw new Error('Failed to exchange authorization code for token. Please check your connection.');
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const authData = loadAuthData();
    
    if (!authData) {
      return null;
    }

    // Check if token is expired
    if (authData.expiresAt && Date.now() > authData.expiresAt) {
      // Attempt to refresh token if refresh token is available
      if (authData.refreshToken) {
        try {
          const newToken = await refreshAccessToken(authData.refreshToken);
          return newToken;
        } catch (error) {
          // If refresh fails, clear auth data and return null
          clearAuthData();
          return null;
        }
      }
      return null;
    }

    return authData.accessToken;
  } catch (error) {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/github/refresh`, {
      refresh_token: refreshToken
    }, {
      timeout: 10000
    });

    if (!response.data || !response.data.access_token) {
      throw new Error('Invalid refresh response');
    }

    const authData: AuthData = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
      encrypted: true
    };

    await saveAuthData(authData);
    return authData.accessToken;
  } catch (error) {
    throw new Error('Failed to refresh access token');
  }
}

async function saveAuthData(authData: AuthData): Promise<void> {
  const authDir = path.dirname(TOKEN_FILE);
  
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  }

  // Encrypt sensitive data
  const encryptedData = encryptData(JSON.stringify(authData));
  
  fs.writeFileSync(TOKEN_FILE, encryptedData, { mode: 0o600 });
}

function encryptData(data: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      // Assume unencrypted data for backward compatibility
      return encryptedData;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, assume unencrypted data
    return encryptedData;
  }
}

function loadAuthData(): AuthData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const decryptedContent = decryptData(content);
    const data = JSON.parse(decryptedContent);
    
    // Validate data structure
    if (!data.accessToken || typeof data.accessToken !== 'string') {
      return null;
    }
    
    return data;
  } catch (error) {
    // If file is corrupted, clear it
    try {
      fs.unlinkSync(TOKEN_FILE);
    } catch (e) {
      // Ignore unlink errors
    }
    return null;
  }
}

export function clearAuthData(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    // Log error but don't throw
    console.error('Warning: Failed to clear auth data:', error);
  }
}
