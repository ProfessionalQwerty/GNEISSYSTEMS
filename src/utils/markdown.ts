import chalk from 'chalk';

const MAX_LINE_LENGTH = 120;

export function renderMarkdown(markdown: string): void {
  try {
    if (!markdown || typeof markdown !== 'string') {
      console.log(chalk.yellow('No analysis results available.'));
      return;
    }

    // Simple markdown renderer for terminal output
    const lines = markdown.split('\n');
    
    for (const line of lines) {
      // Truncate very long lines to prevent terminal issues
      const truncatedLine = line.length > MAX_LINE_LENGTH 
        ? line.substring(0, MAX_LINE_LENGTH) + '...' 
        : line;
      
      if (truncatedLine.startsWith('# ')) {
        console.log(chalk.cyan.bold(truncatedLine.replace('# ', '')));
      } else if (truncatedLine.startsWith('## ')) {
        console.log(chalk.cyan.bold(truncatedLine.replace('## ', '')));
      } else if (truncatedLine.startsWith('### ')) {
        console.log(chalk.white.bold(truncatedLine.replace('### ', '')));
      } else if (truncatedLine.startsWith('- ')) {
        console.log(chalk.white('  • ' + truncatedLine.replace('- ', '')));
      } else if (truncatedLine.startsWith('**') && truncatedLine.endsWith('**')) {
        console.log(chalk.white.bold(truncatedLine.replace(/\*\*/g, '')));
      } else if (truncatedLine.trim() === '') {
        console.log();
      } else {
        console.log(chalk.white(truncatedLine));
      }
    }
  } catch (error) {
    console.log(chalk.yellow('Error rendering analysis results. Raw output:'));
    console.log(markdown);
  }
}
