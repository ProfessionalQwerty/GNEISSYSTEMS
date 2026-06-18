import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

const GITHUB_REPO = "ProfessionalQwerty/GNEISSYSTEMS";
const CURRENT_VERSION = "1.0.0";

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export const updateCommand = new Command("update")
  .description("Check for and install CLI updates")
  .action(async () => {
    try {
      console.log(chalk.cyan.bold("\n🔄 GNEISS CLI Update Check\n"));

      const spinner = ora("Checking for updates...").start();

      try {
        const latestRelease = await getLatestRelease();

        if (!latestRelease) {
          spinner.fail("Failed to fetch latest release information");
          process.exit(1);
        }

        const latestVersion = latestRelease.tag_name.replace(/^v/, "");

        spinner.succeed(
          `Current version: ${CURRENT_VERSION}, Latest version: ${latestVersion}`,
        );

        if (latestVersion === CURRENT_VERSION) {
          console.log(
            chalk.green.bold("\n✅ You are already using the latest version!"),
          );
          return;
        }

        console.log(
          chalk.yellow.bold("\n📦 New version available:"),
          chalk.white(latestVersion),
        );
        console.log(
          chalk.gray("Release notes:"),
          chalk.white(latestRelease.name),
        );
        console.log(chalk.gray(latestRelease.body.substring(0, 200)) + "...\n");

        const confirmSpinner = ora("Downloading update...").start();

        // Detect platform and download appropriate binary
        const platform = os.platform();
        const arch = os.arch();

        let assetName: string;
        if (platform === "win32") {
          assetName = "gneiss-windows-amd64.exe";
        } else if (platform === "darwin") {
          assetName =
            arch === "arm64" ? "gneiss-darwin-arm64" : "gneiss-darwin-amd64";
        } else {
          assetName =
            arch === "arm64" ? "gneiss-linux-arm64" : "gneiss-linux-amd64";
        }

        const asset = latestRelease.assets.find((a) => a.name === assetName);

        if (!asset) {
          confirmSpinner.fail(
            `No binary found for your platform (${platform}-${arch})`,
          );
          process.exit(1);
        }

        // Download the binary
        const response = await axios.get(asset.browser_download_url, {
          responseType: "arraybuffer",
          onDownloadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              ((progressEvent.loaded || 0) * 100) /
                (progressEvent.total || asset.size),
            );
            confirmSpinner.text = `Downloading update... ${percentCompleted}%`;
          },
        });

        confirmSpinner.succeed("Download complete");

        // Install the update
        const installSpinner = ora("Installing update...").start();

        const currentExePath = process.execPath;

        if (platform === "win32") {
          const installDir = path.dirname(currentExePath);
          const tempExePath = path.join(installDir, "gneiss_new.exe");

          fs.writeFileSync(tempExePath, response.data);

          installSpinner.succeed("Update staged successfully");
          console.log(
            chalk.green.bold(
              "\n✅ Update downloaded. Finishing installation in the background...",
            ),
          );
          console.log(
            chalk.gray(
              "The CLI will exit now so Windows can replace the executable.\n",
            ),
          );

          spawnDetachedWindowsInstaller(currentExePath, tempExePath);
          process.exit(0);
        }

        const backupPath = currentExePath + ".old";

        // Create backup
        if (fs.existsSync(currentExePath)) {
          fs.copyFileSync(currentExePath, backupPath);
        }

        // Write new binary
        fs.writeFileSync(currentExePath, response.data);
        fs.chmodSync(currentExePath, 0o755);

        installSpinner.succeed("Update installed successfully");

        // Clean up backup
        try {
          fs.unlinkSync(backupPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        console.log(
          chalk.green.bold("\n✅ Successfully updated to version"),
          chalk.white(latestVersion),
        );
        console.log(
          chalk.gray("Please restart your CLI to use the new version.\n"),
        );
      } catch (error: any) {
        spinner.fail("Failed to check for updates");
        console.error(chalk.red.bold("\n❌ Error:"), error.message);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(chalk.red.bold("\n❌ Unexpected Error:"), error.message);
      process.exit(1);
    }
  });

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function spawnDetachedWindowsInstaller(
  currentExePath: string,
  tempExePath: string,
): void {
  const currentPath = escapePowerShellLiteral(currentExePath);
  const tempPath = escapePowerShellLiteral(tempExePath);
  const command = [
    "Start-Sleep -Seconds 1",
    `Remove-Item -LiteralPath '${currentPath}' -Force -ErrorAction Stop`,
    `Move-Item -LiteralPath '${tempPath}' -Destination '${currentPath}' -Force -ErrorAction Stop`,
  ].join("; ");

  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-Command",
      command,
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  child.unref();
}

async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GNEISS-CLI",
        },
        timeout: 10000,
      },
    );

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error("No releases found for this repository");
      }
      if (error.code === "ECONNABORTED") {
        throw new Error("Request timed out. Please check your connection.");
      }
    }
    throw new Error("Failed to fetch release information from GitHub");
  }
}
