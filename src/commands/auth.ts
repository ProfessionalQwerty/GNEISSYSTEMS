import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import open from 'open';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { saveAuthData, AuthData } from '../utils/auth';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liQ8vZQq8K8J8L8W'; // Replace with actual client ID
const CONFIG_DIR = path.join(os.homedir(), '.gneiss');
const CONFIG_FILE = path.join(CONFIG_DIR, 'auth.json');

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export const authCommand = new Command('auth')
  .description('Authenticate with GitHub using Device Flow')
  .action(async () => {
    try {
      console.log(chalk.cyan.bold('\n🔐 GitHub Device Authentication\n'));

      // Ensure config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      const spinner = ora('Requesting device code from GitHub...').start();

      try {
        // Step 1: Request device code from GitHub
        const deviceCodeResponse = await axios.post<DeviceCodeResponse>(
          'https://github.com/login/device/code',
          {
            client_id: GITHUB_CLIENT_ID,
            scope: 'read:user user:email'
          },
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );

        const { device_code, user_code, verification_uri, expires_in, interval } = deviceCodeResponse.data;

        spinner.succeed('Device code received');

        // Step 2: Display instructions to user
        console.log(chalk.white('\n1. Copy this code:'));
        console.log(chalk.cyan.bold(`   ${user_code}`));
        console.log(chalk.white('\n2. Visit this URL in your browser:'));
        console.log(chalk.cyan(`   ${verification_uri}`));
        console.log(chalk.white('\n3. Enter the code and authorize the GNEISS CLI\n'));

        // Step 3: Open browser automatically
        const openSpinner = ora('Opening browser...').start();
        try {
          await open(`${verification_uri}?login=${user_code}`);
          openSpinner.succeed('Browser opened');
        } catch (openError) {
          openSpinner.warn('Could not open browser automatically');
          console.log(chalk.yellow('Please manually visit the URL above\n'));
        }

        // Step 4: Poll for token
        const pollSpinner = ora('Waiting for authorization...').start();
        let accessToken: string | null = null;
        const startTime = Date.now();
        const pollInterval = interval * 1000; // Convert to milliseconds

        while (Date.now() - startTime < expires_in * 1000) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          try {
            const tokenResponse = await axios.post<TokenResponse>(
              'https://github.com/login/oauth/access_token',
              {
                client_id: GITHUB_CLIENT_ID,
                device_code: device_code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
              },
              {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              }
            );

            if (tokenResponse.data.access_token) {
              accessToken = tokenResponse.data.access_token;
              break;
            }
          } catch (pollError: any) {
            // Continue polling if authorization is pending
            if (pollError.response?.status !== 400) {
              throw pollError;
            }
          }
        }

        if (!accessToken) {
          pollSpinner.fail('Authorization timed out');
          console.error(chalk.red.bold('\n❌ Error:'), 'Authorization timed out. Please try again.');
          process.exit(1);
        }

        pollSpinner.succeed('Authorization successful');

        // Step 5: Get user info and save auth data
        const userSpinner = ora('Fetching user information...').start();
        try {
          const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });

          const authData: AuthData = {
            accessToken: accessToken,
            refreshToken: '', // Device flow doesn't provide refresh tokens
            expiresAt: Date.now() + (expires_in * 1000),
            encrypted: true,
            userId: userResponse.data.id.toString(),
            username: userResponse.data.login,
            email: userResponse.data.email
          };

          await saveAuthData(authData);
          userSpinner.succeed('User information saved');

        } catch (userError: any) {
          userSpinner.warn('Could not fetch user information');
          // Still save the token even if we can't get user info
          const authData: AuthData = {
            accessToken: accessToken,
            refreshToken: '',
            expiresAt: Date.now() + (expires_in * 1000),
            encrypted: true
          };
          await saveAuthData(authData);
        }

        console.log(chalk.green.bold('\n✅ Successfully authenticated!'));
        console.log(chalk.white('You can now use the GNEISS CLI to analyze your projects.'));

      } catch (error: any) {
        spinner.fail('Authentication failed');
        if (axios.isAxiosError(error)) {
          console.error(chalk.red.bold('\n❌ Error:'), error.response?.data?.error_description || error.message);
        } else {
          console.error(chalk.red.bold('\n❌ Error:'), error.message);
        }
        process.exit(1);
      }

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Unexpected Error:'), error.message);
      process.exit(1);
    }
  });
