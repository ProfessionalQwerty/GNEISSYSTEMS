import * as path from "path";
import { JavaFile } from "./scanner";

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; group?: string }>;
  links: Array<{ source: string; target: string; weight?: number }>;
}

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function stripJavaSourceRoot(filePath: string): string {
  const normalized = normalizePathSeparators(filePath);
  const sourceRootPattern =
    /(?:^|\/)src\/(?:main|test)\/(?:java|kotlin|scala)\//;
  const match = normalized.match(sourceRootPattern);

  if (!match || match.index === undefined) {
    return normalized;
  }

  return normalized.slice(match.index + match[0].length);
}

function classNameFromPath(filePath: string): string {
  return path.posix.basename(normalizePathSeparators(filePath), ".java");
}

function normalizeFilePath(file: JavaFile): string {
  const className = classNameFromPath(file.path);

  if (file.packageName) {
    return `${file.packageName}.${className}`;
  }

  return stripJavaSourceRoot(file.path)
    .replace(/\.java$/, "")
    .replace(/\//g, ".");
}

function normalizeImport(importName: string): string {
  return importName.trim().replace(/\s+/g, "");
}

function addLink(
  links: Map<string, { source: string; target: string; weight: number }>,
  source: string,
  target: string,
): void {
  if (!source || !target || source === target) {
    return;
  }

  const linkKey = `${source}\u0000${target}`;
  const existingLink = links.get(linkKey);

  if (existingLink) {
    existingLink.weight += 1;
  } else {
    links.set(linkKey, { source, target, weight: 1 });
  }
}

function resolveImportTargets(
  importName: string,
  nodes: Map<string, { id: string; label: string; group?: string }>,
  simpleNameIndex: Map<string, string[]>,
): string[] {
  const normalizedImport = normalizeImport(importName);

  if (!normalizedImport) {
    return [];
  }

  if (normalizedImport.endsWith(".*")) {
    const packagePrefix = normalizedImport.slice(0, -2);
    return Array.from(nodes.keys()).filter((nodeId) =>
      nodeId.startsWith(`${packagePrefix}.`),
    );
  }

  if (nodes.has(normalizedImport)) {
    return [normalizedImport];
  }

  // Static imports can include a member after the class name, for example
  // org.example.Foo.BAR. Walk backward until we find the owning class.
  const importParts = normalizedImport.split(".");
  for (let i = importParts.length - 1; i > 0; i -= 1) {
    const candidate = importParts.slice(0, i).join(".");
    if (nodes.has(candidate)) {
      return [candidate];
    }
  }

  const simpleName = importParts[importParts.length - 1];
  return simpleNameIndex.get(simpleName) || [];
}

export function buildDependencyGraph(javaFiles: JavaFile[]): DependencyGraph {
  const nodes = new Map<
    string,
    { id: string; label: string; group?: string }
  >();
  const links = new Map<
    string,
    { source: string; target: string; weight: number }
  >();
  const sourceIds = new Map<JavaFile, string>();
  const simpleNameIndex = new Map<string, string[]>();

  for (const file of javaFiles) {
    const nodeId = normalizeFilePath(file);
    const label = nodeId.split(".").pop() || nodeId;
    const packageParts = (file.packageName || nodeId)
      .split(".")
      .filter(Boolean);
    const group = packageParts.length > 0 ? packageParts[0] : "default";

    nodes.set(nodeId, { id: nodeId, label, group });
    sourceIds.set(file, nodeId);

    const matches = simpleNameIndex.get(label) || [];
    matches.push(nodeId);
    simpleNameIndex.set(label, matches);
  }

  for (const file of javaFiles) {
    const sourceNodeId = sourceIds.get(file);

    if (!sourceNodeId) {
      continue;
    }

    for (const imp of file.imports) {
      for (const targetNodeId of resolveImportTargets(
        imp,
        nodes,
        simpleNameIndex,
      )) {
        addLink(links, sourceNodeId, targetNodeId);
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()),
  };
}
