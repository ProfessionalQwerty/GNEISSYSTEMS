import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const TOKEN_FILE = path.join(os.homedir(), ".gneiss", "auth.json");
const KEY_MATERIAL =
  process.env.GNEISS_ENCRYPTION_KEY ||
  [
    "gneiss-cli-auth-v1",
    os.hostname(),
    os.userInfo().username,
    os.homedir(),
  ].join(":");

export interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  encrypted: boolean;
  userId?: string;
  username?: string;
  email?: string;
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const authData = loadAuthData();

    if (!authData) {
      return null;
    }

    if (authData.expiresAt && Date.now() > authData.expiresAt) {
      clearAuthData();
      return null;
    }

    return authData.accessToken;
  } catch {
    return null;
  }
}

export async function saveAuthData(authData: AuthData): Promise<void> {
  const authDir = path.dirname(TOKEN_FILE);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  }

  const encryptedData = encryptData(
    JSON.stringify({
      ...authData,
      encrypted: true,
    }),
  );

  fs.writeFileSync(TOKEN_FILE, encryptedData, { mode: 0o600 });
}

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(KEY_MATERIAL).digest();
}

function encryptData(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);

  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `v1:${iv.toString("hex")}:${encrypted}`;
}

function decryptData(storedData: string): string {
  try {
    const parts = storedData.split(":");

    if (parts.length === 3 && parts[0] === "v1") {
      const iv = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        getEncryptionKey(),
        iv,
      );

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    }

    if (parts.length === 2) {
      // Legacy auth files were encrypted with a per-process random key and cannot
      // be reliably decrypted after the CLI exits. Treat them as invalid below.
      return storedData;
    }

    return storedData;
  } catch {
    return storedData;
  }
}

export function loadAuthData(): AuthData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const content = fs.readFileSync(TOKEN_FILE, "utf-8");
    const decryptedContent = decryptData(content);
    const data = JSON.parse(decryptedContent);

    if (!data.accessToken || typeof data.accessToken !== "string") {
      return null;
    }

    return data;
  } catch {
    try {
      fs.unlinkSync(TOKEN_FILE);
    } catch {
      // Ignore cleanup errors.
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
    console.error("Warning: Failed to clear auth data:", error);
  }
}
