import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scanDirectory } from '../utils/scanner';
import { buildDependencyGraph } from '../utils/graphBuilder';
import { sendAnalysisRequest } from '../utils/api';
import { renderMarkdown } from '../utils/markdown';

export const auditCommand = new Command('audit')
  .description('Analyze a local Java directory for structural coupling')
  .argument('<directory>', 'Path to the Java directory to analyze')
  .option('-d, --depth <number>', 'Depth of analysis', '10')
  .action(async (directory: string, options: { depth: string }) => {
    try {
      console.log(chalk.cyan.bold('\n🔍 GNEISS Structural Analysis\n'));

      // Validate depth parameter
      const depth = parseInt(options.depth, 10);
      if (isNaN(depth) || depth < 1 || depth > 100) {
        console.error(chalk.red.bold('\n❌ Error:'), 'Depth must be a number between 1 and 100');
        process.exit(1);
      }

      // Step 1: Scan directory for Java files
      const spinner = ora('Scanning directory for Java files...').start();
      let javaFiles: any[] = [];
      try {
        javaFiles = await scanDirectory(directory);
        spinner.succeed(`Found ${javaFiles.length} Java files`);
      } catch (scanError: any) {
        spinner.fail('Directory scan failed');
        console.error(chalk.red.bold('\n❌ Error:'), scanError.message);
        process.exit(1);
      }

      if (javaFiles.length === 0) {
        spinner.stop();
        console.log(chalk.yellow('\n⚠️  No Java files found in the specified directory.'));
        console.log(chalk.white('Please ensure the directory contains Java source files (.java) and try again.'));
        return;
      }

      // Step 2: Extract imports and build dependency graph
      spinner.start('Extracting import statements and building dependency graph...');
      let dependencyGraph: any;
      try {
        dependencyGraph = buildDependencyGraph(javaFiles);
        spinner.succeed(`Built dependency graph with ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.links.length} edges`);
      } catch (graphError: any) {
        spinner.fail('Dependency graph construction failed');
        console.error(chalk.red.bold('\n❌ Error:'), graphError.message);
        process.exit(1);
      }

      // Validate graph before sending
      if (!dependencyGraph.nodes || dependencyGraph.nodes.length === 0) {
        spinner.stop();
        console.error(chalk.red.bold('\n❌ Error:'), 'No dependency nodes found. Cannot analyze empty graph.');
        process.exit(1);
      }

      // Step 3: Send to backend for analysis
      spinner.start('Analyzing graph architecture...');
      let result: any;
      try {
        result = await sendAnalysisRequest(dependencyGraph, depth, (message: string) => {
          spinner.text = message;
        });
        spinner.succeed('Analysis complete');
      } catch (apiError: any) {
        spinner.fail('Analysis failed');
        console.error(chalk.red.bold('\n❌ Error:'), apiError.message);
        process.exit(1);
      }

      // Step 4: Display results
      console.log(chalk.cyan.bold('\n📊 Analysis Results\n'));
      console.log(chalk.gray('─'.repeat(50)));
      renderMarkdown(result.review);
      console.log(chalk.gray('─'.repeat(50)));

      console.log(chalk.cyan.bold('\n📈 Metrics\n'));
      console.log(chalk.white(`Risk Level: ${chalk.red.bold(result.risk_level.toUpperCase())}`));
      console.log(chalk.white(`Decay Probability: ${(result.decay_probability * 100).toFixed(2)}%`));
      console.log(chalk.white(`Spectral Gap Ratio: ${result.metrics.spectral_gap_ratio.toFixed(4)}`));
      console.log(chalk.white(`PageRank Entropy: ${result.metrics.pagerank_entropy.toFixed(4)}`));
      console.log(chalk.white(`Structural Delta: ${result.metrics.structural_delta.toFixed(4)}`));

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Unexpected Error:'), error.message);
      process.exit(1);
    }
  });
