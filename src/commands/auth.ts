import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { saveAuthData, AuthData } from "../utils/auth";

const GITHUB_CLIENT_ID = "Ov23liq9BwI9F0OnP2ny";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const CONFIG_DIR = path.join(os.homedir(), ".gneiss");

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?:
    | "authorization_pending"
    | "slow_down"
    | "expired_token"
    | "access_denied"
    | string;
  error_description?: string;
  interval?: number;
}

function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    const command =
      platform === "win32"
        ? "cmd"
        : platform === "darwin"
          ? "open"
          : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function formatGitHubDeviceError(error: any): string {
  if (!axios.isAxiosError(error)) {
    return error?.message || "Unknown authentication error";
  }

  const status = error.response?.status;
  const data = error.response?.data as any;
  const githubMessage = data?.error_description || data?.error || error.message;

  if (status === 404) {
    return [
      "GitHub rejected the CLI OAuth client ID for Device Flow.",
      "Verify that the baked GitHub OAuth App client ID is correct and that Device Flow is enabled for that OAuth App.",
      `GitHub response: ${githubMessage}`,
    ].join(" ");
  }

  return githubMessage;
}

export const authCommand = new Command("auth")
  .description("Authenticate with GitHub using native Device Flow")
  .action(async () => {
    try {
      console.log(chalk.cyan.bold("\n🔐 GitHub Device Authentication\n"));

      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
      }

      const spinner = ora("Requesting device code from GitHub...").start();

      let deviceCodeResponse;
      try {
        deviceCodeResponse = await axios.post<DeviceCodeResponse>(
          GITHUB_DEVICE_CODE_URL,
          {
            client_id: GITHUB_CLIENT_ID,
            scope: "read:user user:email",
          },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "GNEISS-CLI",
            },
            timeout: 15000,
          },
        );
      } catch (error: any) {
        spinner.fail("Authentication failed");
        console.error(
          chalk.red.bold("\n❌ Error:"),
          formatGitHubDeviceError(error),
        );
        process.exit(1);
      }

      const { device_code, user_code, verification_uri, expires_in } =
        deviceCodeResponse.data;
      let pollIntervalSeconds = deviceCodeResponse.data.interval || 5;

      if (!device_code || !user_code || !verification_uri) {
        spinner.fail("Authentication failed");
        console.error(
          chalk.red.bold("\n❌ Error:"),
          "GitHub returned an invalid device-code response.",
        );
        process.exit(1);
      }

      spinner.succeed("Device code received");

      console.log(chalk.white("\n1. Copy this code:"));
      console.log(chalk.cyan.bold(`   ${user_code}`));
      console.log(chalk.white("\n2. Visit this URL in your browser:"));
      console.log(chalk.cyan(`   ${verification_uri}`));
      console.log(
        chalk.white("\n3. Enter the code and authorize the GNEISS CLI\n"),
      );

      const openSpinner = ora("Opening browser...").start();
      try {
        await openBrowser(verification_uri);
        openSpinner.succeed("Browser opened");
      } catch {
        openSpinner.warn("Could not open browser automatically");
        console.log(chalk.yellow("Please manually visit the URL above\n"));
      }

      const pollSpinner = ora("Waiting for authorization...").start();
      const deadline = Date.now() + expires_in * 1000;
      let tokenData: TokenResponse | null = null;

      while (Date.now() < deadline) {
        await new Promise((resolve) =>
          setTimeout(resolve, pollIntervalSeconds * 1000),
        );

        const tokenResponse = await axios.post<TokenResponse>(
          GITHUB_ACCESS_TOKEN_URL,
          {
            client_id: GITHUB_CLIENT_ID,
            device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "GNEISS-CLI",
            },
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 500,
          },
        );

        const data = tokenResponse.data;

        if (data.access_token) {
          tokenData = data;
          break;
        }

        if (data.error === "authorization_pending") {
          continue;
        }

        if (data.error === "slow_down") {
          pollIntervalSeconds += 5;
          pollSpinner.text = `Waiting for authorization... slowed polling to ${pollIntervalSeconds}s`;
          continue;
        }

        if (data.error === "expired_token") {
          pollSpinner.fail("Device code expired");
          console.error(
            chalk.red.bold("\n❌ Error:"),
            'The device code expired. Please run "gneiss auth" again.',
          );
          process.exit(1);
        }

        if (data.error === "access_denied") {
          pollSpinner.fail("Authorization denied");
          console.error(
            chalk.red.bold("\n❌ Error:"),
            "Authorization was denied in GitHub.",
          );
          process.exit(1);
        }

        if (data.error) {
          pollSpinner.fail("Authentication failed");
          console.error(
            chalk.red.bold("\n❌ Error:"),
            data.error_description || data.error,
          );
          process.exit(1);
        }
      }

      if (!tokenData?.access_token) {
        pollSpinner.fail("Authorization timed out");
        console.error(
          chalk.red.bold("\n❌ Error:"),
          "Authorization timed out. Please try again.",
        );
        process.exit(1);
      }

      pollSpinner.succeed("Authorization successful");

      const userSpinner = ora("Fetching GitHub user information...").start();
      try {
        const userResponse = await axios.get(GITHUB_USER_URL, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "GNEISS-CLI",
          },
          timeout: 15000,
        });

        const authData: AuthData = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : undefined,
          encrypted: true,
          userId: userResponse.data.id?.toString(),
          username: userResponse.data.login,
          email: userResponse.data.email,
        };

        await saveAuthData(authData);
        userSpinner.succeed(
          `Authenticated as ${authData.username || "GitHub user"}`,
        );
      } catch {
        userSpinner.warn("Could not fetch GitHub user information");
        await saveAuthData({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : undefined,
          encrypted: true,
        });
      }

      console.log(chalk.green.bold("\n✅ Successfully authenticated!"));
      console.log(
        chalk.white("You can now use the GNEISS CLI to analyze your projects."),
      );
    } catch (error: any) {
      console.error(chalk.red.bold("\n❌ Unexpected Error:"), error.message);
      process.exit(1);
    }
  });
