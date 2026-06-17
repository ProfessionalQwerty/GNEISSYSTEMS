#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { auditCommand } from './commands/audit';
import { authCommand } from './commands/auth';
import { updateCommand } from './commands/update';

const program = new Command();

program
  .name('gneiss')
  .description('GNEISS CLI - Local structural analysis tool for Java projects')
  .version('1.0.0');

program.addCommand(auditCommand);
program.addCommand(authCommand);
program.addCommand(updateCommand);

program.parse();
