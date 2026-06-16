import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface JavaFile {
  path: string;
  imports: string[];
  packageName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DEPTH = 50; // Maximum directory depth to prevent infinite loops
const SKIPPED_DIRECTORIES = new Set([
  'node_modules', '.git', 'target', 'build', 'dist', '.next',
  'vendor', 'coverage', '.idea', '.vscode', 'venv', 'env'
]);

export async function scanDirectory(directory: string): Promise<JavaFile[]> {
  // Validate directory exists
  try {
    const stats = await fs.promises.stat(directory);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${directory}`);
    }
  } catch (error) {
    throw new Error(`Cannot access directory: ${directory}. Please check the path and permissions.`);
  }

  const javaFiles: JavaFile[] = [];
  const visitedDirs = new Set<string>();

  async function scan(dir: string, depth: number = 0) {
    // Prevent infinite loops with depth limit
    if (depth > MAX_DEPTH) {
      return;
    }

    // Prevent circular symlinks
    const realPath = await fs.promises.realpath(dir);
    if (visitedDirs.has(realPath)) {
      return;
    }
    visitedDirs.add(realPath);

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        try {
          if (entry.isDirectory()) {
            // Skip common directories that don't contain Java source
            if (!SKIPPED_DIRECTORIES.has(entry.name)) {
              await scan(fullPath, depth + 1);
            }
          } else if (entry.name.endsWith('.java')) {
            // Check file size before reading
            const fileStats = await fs.promises.stat(fullPath);
            if (fileStats.size > MAX_FILE_SIZE) {
              console.warn(`Skipping large file: ${fullPath} (${(fileStats.size / 1024 / 1024).toFixed(2)}MB)`);
              continue;
            }

            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const imports = extractImports(content);
            const packageName = extractPackageName(content);

            // Use relative path from the base directory for anonymization
            const relativePath = path.relative(directory, fullPath);

            javaFiles.push({
              path: relativePath,
              imports,
              packageName
            });
          }
        } catch (fileError) {
          // Log permission errors but continue scanning
          console.warn(`Warning: Cannot access ${fullPath}: ${fileError}`);
        }
      }
    } catch (dirError) {
      console.warn(`Warning: Cannot read directory ${dir}: ${dirError}`);
    }
  }

  await scan(directory);
  return javaFiles;
}

function extractImports(content: string): string[] {
  try {
    const importRegex = /import\s+(?:static\s+)?([\w.]+);/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  } catch (error) {
    // If regex fails, return empty array
    return [];
  }
}

function extractPackageName(content: string): string {
  try {
    const packageRegex = /package\s+([\w.]+);/;
    const match = content.match(packageRegex);
    return match ? match[1] : '';
  } catch (error) {
    // If regex fails, return empty string
    return '';
  }
}
