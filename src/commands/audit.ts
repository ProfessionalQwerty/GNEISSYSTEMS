import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scanDirectory } from "../utils/scanner";
import { buildDependencyGraph } from "../utils/graphBuilder";
import { sendAnalysisRequest } from "../utils/api";
import { renderMarkdown } from "../utils/markdown";
import { getAuthToken } from "../utils/auth";
import axios from "axios";

const API_BASE_URL =
  process.env.GNEISS_API_URL || "https://gneiss-systems.vercel.app";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function probabilityToPercent(value: number): number {
  const numericValue = Number(value);
  const percent = numericValue <= 1 ? numericValue * 100 : numericValue;
  return clampPercent(percent);
}

function colorRiskLevel(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return chalk.green.bold(riskLevel.toUpperCase());
    case "medium":
      return chalk.yellow.bold(riskLevel.toUpperCase());
    case "high":
      return chalk.hex("#f97316").bold(riskLevel.toUpperCase());
    case "critical":
      return chalk.red.bold(riskLevel.toUpperCase());
    default:
      return chalk.white.bold(riskLevel.toUpperCase());
  }
}

async function logScanMetrics(
  accessToken: string,
  scanType: string,
  status: string,
  systemMetadata: any = {},
  errorMessage: string | null = null,
  scanDurationMs: number | null = null,
  filesScanned: number | null = null,
) {
  try {
    await axios.post(
      `${API_BASE_URL}/api/v1/metrics/log`,
      {
        access_token: accessToken,
        scan_type: scanType,
        status,
        system_metadata: systemMetadata,
        error_message: errorMessage,
        scan_duration_ms: scanDurationMs,
        files_scanned: filesScanned,
      },
      {
        timeout: 5000,
      },
    );
  } catch (error) {
    // Don't fail the scan if metrics logging fails
    console.warn(chalk.yellow("⚠️  Failed to log scan metrics"));
  }
}

export const auditCommand = new Command("audit")
  .description("Analyze a local Java directory for structural coupling")
  .argument("<directory>", "Path to the Java directory to analyze")
  .option("-d, --depth <number>", "Depth of analysis", "10")
  .action(async (directory: string, options: { depth: string }) => {
    const startTime = Date.now();
    let accessToken: string | null = null;
    let scanStatus = "initiated";
    let errorMessage: string | null = null;
    let filesScanned: number | null = null;

    try {
      console.log(chalk.cyan.bold("\n🔍 GNEISS Structural Analysis\n"));

      // Get auth token for metrics logging
      accessToken = await getAuthToken();

      // Log scan initiation
      if (accessToken) {
        await logScanMetrics(accessToken, "audit", "initiated", {
          directory,
          depth: options.depth,
        });
      }

      // Validate depth parameter
      const depth = parseInt(options.depth, 10);
      if (isNaN(depth) || depth < 1 || depth > 100) {
        console.error(
          chalk.red.bold("\n❌ Error:"),
          "Depth must be a number between 1 and 100",
        );
        scanStatus = "failed";
        errorMessage = "Invalid depth parameter";
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {},
            errorMessage,
            Date.now() - startTime,
            0,
          );
        }
        process.exit(1);
      }

      // Step 1: Scan directory for Java files
      const spinner = ora("Scanning directory for Java files...").start();
      let javaFiles: any[] = [];
      try {
        javaFiles = await scanDirectory(directory);
        spinner.succeed(`Found ${javaFiles.length} Java files`);
        filesScanned = javaFiles.length;
      } catch (scanError: any) {
        spinner.fail("Directory scan failed");
        console.error(chalk.red.bold("\n❌ Error:"), scanError.message);
        scanStatus = "failed";
        errorMessage = scanError.message;
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {},
            errorMessage,
            Date.now() - startTime,
            0,
          );
        }
        process.exit(1);
      }

      if (javaFiles.length === 0) {
        spinner.stop();
        console.log(
          chalk.yellow("\n⚠️  No Java files found in the specified directory."),
        );
        console.log(
          chalk.white(
            "Please ensure the directory contains Java source files (.java) and try again.",
          ),
        );
        scanStatus = "completed";
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {
              directory,
              depth: options.depth,
              files_found: 0,
            },
            null,
            Date.now() - startTime,
            0,
          );
        }
        return;
      }

      // Step 2: Extract imports and build dependency graph
      spinner.start(
        "Extracting import statements and building dependency graph...",
      );
      let dependencyGraph: any;
      try {
        dependencyGraph = buildDependencyGraph(javaFiles);
        spinner.succeed(
          `Built dependency graph with ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.links.length} edges`,
        );
      } catch (graphError: any) {
        spinner.fail("Dependency graph construction failed");
        console.error(chalk.red.bold("\n❌ Error:"), graphError.message);
        scanStatus = "failed";
        errorMessage = graphError.message;
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {},
            errorMessage,
            Date.now() - startTime,
            filesScanned,
          );
        }
        process.exit(1);
      }

      // Validate graph before sending
      if (!dependencyGraph.nodes || dependencyGraph.nodes.length === 0) {
        spinner.stop();
        console.error(
          chalk.red.bold("\n❌ Error:"),
          "No dependency nodes found. Cannot analyze empty graph.",
        );
        scanStatus = "failed";
        errorMessage = "No dependency nodes found";
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {},
            errorMessage,
            Date.now() - startTime,
            filesScanned,
          );
        }
        process.exit(1);
      }

      // Step 3: Send to backend for analysis
      spinner.start("Analyzing graph architecture...");
      let result: any;
      try {
        result = await sendAnalysisRequest(
          dependencyGraph,
          depth,
          (message: string) => {
            spinner.text = message;
          },
        );
        spinner.succeed("Analysis complete");
      } catch (apiError: any) {
        spinner.fail("Analysis failed");
        console.error(chalk.red.bold("\n❌ Error:"), apiError.message);
        scanStatus = "failed";
        errorMessage = apiError.message;
        if (accessToken) {
          await logScanMetrics(
            accessToken,
            "audit",
            scanStatus,
            {},
            errorMessage,
            Date.now() - startTime,
            filesScanned,
          );
        }
        process.exit(1);
      }

      // Step 4: Display results
      console.log(chalk.cyan.bold("\n📊 Analysis Results\n"));
      console.log(chalk.gray("─".repeat(50)));
      renderMarkdown(result.review);
      console.log(chalk.gray("─".repeat(50)));

      const decayProbabilityPercent = probabilityToPercent(
        result.decay_probability,
      );
      const codebaseHealthScore = clampPercent(
        Number(
          result.metrics?.codebase_health_score ??
            100 - decayProbabilityPercent,
        ),
      );

      console.log(chalk.cyan.bold("\n📈 Metrics\n"));
      console.log(
        chalk.white(`Risk Level: ${colorRiskLevel(result.risk_level)}`),
      );
      console.log(
        chalk.white(
          `Decay Probability: ${decayProbabilityPercent.toFixed(2)}%`,
        ),
      );
      console.log(
        chalk.white(`Codebase Health: ${codebaseHealthScore.toFixed(1)}/100`),
      );
      console.log(
        chalk.white(
          `Spectral Gap Ratio: ${result.metrics.spectral_gap_ratio.toFixed(4)}`,
        ),
      );
      console.log(
        chalk.white(
          `PageRank Entropy: ${result.metrics.pagerank_entropy.toFixed(4)}`,
        ),
      );
      console.log(
        chalk.white(
          `Structural Delta: ${result.metrics.structural_delta.toFixed(4)}`,
        ),
      );

      // Log successful scan completion
      scanStatus = "completed";
      if (accessToken) {
        await logScanMetrics(
          accessToken,
          "audit",
          scanStatus,
          {
            directory,
            depth: options.depth,
            risk_level: result.risk_level,
            decay_probability: decayProbabilityPercent,
            spectral_gap_ratio: result.metrics.spectral_gap_ratio,
            pagerank_entropy: result.metrics.pagerank_entropy,
            structural_delta: result.metrics.structural_delta,
          },
          null,
          Date.now() - startTime,
          filesScanned,
        );
      }
    } catch (error: any) {
      console.error(chalk.red.bold("\n❌ Unexpected Error:"), error.message);
      scanStatus = "failed";
      errorMessage = error.message;
      if (accessToken) {
        await logScanMetrics(
          accessToken,
          "audit",
          scanStatus,
          {},
          errorMessage,
          Date.now() - startTime,
          filesScanned,
        );
      }
      process.exit(1);
    }
  });
