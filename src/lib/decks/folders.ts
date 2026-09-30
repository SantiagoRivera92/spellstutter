import type { FolderNode } from "@/lib/supabase/types";

export interface FlatFolder {
  id: string;
  name: string;
  depth: number;
}

export function flattenFolders(
  nodes: FolderNode[],
  depth = 0,
): FlatFolder[] {
  const result: FlatFolder[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, depth });
    result.push(...flattenFolders(node.children, depth + 1));
  }
  return result;
}

export function findFolder(
  nodes: FolderNode[],
  id: string,
): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findFolder(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Folder ids that cannot be chosen as a destination for `folderId`. */
export function collectDescendantIds(folder: FolderNode): string[] {
  const ids = [folder.id];
  for (const child of folder.children) {
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}
