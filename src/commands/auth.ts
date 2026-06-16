import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { initiateGitHubAuth, exchangeCodeForToken } from '../utils/auth';

export const authCommand = new Command('auth')
  .description('Authenticate with GitHub')
  .action(async () => {
    try {
      console.log(chalk.cyan.bold('\n🔐 GitHub Authentication\n'));

      const spinner = ora('Initiating GitHub OAuth flow...').start();
      let authUrl: string = '';
      try {
        authUrl = await initiateGitHubAuth();
        spinner.succeed('Authentication URL generated');
      } catch (authError: any) {
        spinner.fail('Failed to generate authentication URL');
        console.error(chalk.red.bold('\n❌ Error:'), authError.message);
        process.exit(1);
      }

      console.log(chalk.white('\nPlease visit the following URL to authenticate:'));
      console.log(chalk.cyan(authUrl));
      console.log(chalk.white('\nAfter authentication, you will receive a code. Enter it below:'));

      const code = await new Promise<string>((resolve) => {
        process.stdout.write(chalk.yellow('Enter authorization code: '));
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim());
        });
      });

      if (!code || code.length === 0) {
        console.error(chalk.red.bold('\n❌ Error:'), 'Authorization code cannot be empty');
        process.exit(1);
      }

      spinner.start('Exchanging code for access token...');
      let token: string;
      try {
        token = await exchangeCodeForToken(code);
        spinner.succeed('Authentication successful');
      } catch (exchangeError: any) {
        spinner.fail('Failed to exchange authorization code');
        console.error(chalk.red.bold('\n❌ Error:'), exchangeError.message);
        process.exit(1);
      }

      console.log(chalk.green.bold('\n✅ Successfully authenticated!'));
      console.log(chalk.white('You can now use the GNEISS CLI to analyze your projects.'));

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Unexpected Error:'), error.message);
      process.exit(1);
    }
  });
