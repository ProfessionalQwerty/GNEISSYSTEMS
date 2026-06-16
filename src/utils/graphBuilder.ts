import { JavaFile } from './scanner';

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; group?: string }>;
  links: Array<{ source: string; target: string; weight?: number }>;
}

export function buildDependencyGraph(javaFiles: JavaFile[]): DependencyGraph {
  const nodes = new Map<string, { id: string; label: string; group?: string }>();
  const links = new Map<string, { source: string; target: string; weight: number }>();
  let linkId = 0;

  // Create nodes from Java files
  for (const file of javaFiles) {
    const nodeId = file.path.replace(/\.java$/, '').replace(/\//g, '.');
    
    // Determine group based on package structure
    const packageParts = file.packageName.split('.');
    const group = packageParts.length > 0 ? packageParts[0] : 'default';

    nodes.set(nodeId, {
      id: nodeId,
      label: nodeId.split('.').pop() || nodeId,
      group
    });
  }

  // Create links from imports
  for (const file of javaFiles) {
    const sourceNodeId = file.path.replace(/\.java$/, '').replace(/\//g, '.');

    for (const imp of file.imports) {
      // Check if the imported class is within our scanned files
      const importParts = imp.split('.');
      const importClassName = importParts[importParts.length - 1];

      // Find matching node
      for (const [nodeId, node] of nodes) {
        if (node.label === importClassName || nodeId.endsWith('.' + importClassName)) {
          const linkKey = `${sourceNodeId}-${nodeId}`;
          
          if (!links.has(linkKey)) {
            links.set(linkKey, {
              source: sourceNodeId,
              target: nodeId,
              weight: 1
            });
          } else {
            // Increment weight if link already exists
            const existingLink = links.get(linkKey)!;
            existingLink.weight += 1;
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values())
  };
}
