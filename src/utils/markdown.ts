import chalk from "chalk";

export function renderMarkdown(markdown: string): void {
  try {
    if (!markdown || typeof markdown !== "string") {
      console.log(chalk.yellow("No analysis results available."));
      return;
    }

    // Simple markdown renderer for terminal output
    const lines = markdown.split("\n");

    for (const line of lines) {
      const renderedLine = line;

      if (renderedLine.startsWith("# ")) {
        console.log(chalk.cyan.bold(renderedLine.replace("# ", "")));
      } else if (renderedLine.startsWith("## ")) {
        console.log(chalk.cyan.bold(renderedLine.replace("## ", "")));
      } else if (renderedLine.startsWith("### ")) {
        console.log(chalk.white.bold(renderedLine.replace("### ", "")));
      } else if (renderedLine.startsWith("- ")) {
        console.log(chalk.white("  • " + renderedLine.replace("- ", "")));
      } else if (renderedLine.startsWith("**") && renderedLine.endsWith("**")) {
        console.log(chalk.white.bold(renderedLine.replace(/\*\*/g, "")));
      } else if (renderedLine.trim() === "") {
        console.log();
      } else {
        console.log(chalk.white(renderedLine));
      }
    }
  } catch (error) {
    console.log(chalk.yellow("Error rendering analysis results. Raw output:"));
    console.log(markdown);
  }
}
