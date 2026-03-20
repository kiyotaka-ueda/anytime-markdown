import { useCallback, useRef, useState } from "react";

import type { ChildrenCache, HasMdCache, TreeEntry } from "../types";

export function useTreeState() {
  const [rootEntries, setRootEntries] = useState<TreeEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingInDir, setCreatingInDir] = useState<string | null>(null);
  const [creatingFolderInDir, setCreatingFolderInDir] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const dragSourceRef = useRef<string | null>(null);

  const childrenCacheRef = useRef<ChildrenCache>(new Map());
  const hasMdCacheRef = useRef<HasMdCache>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  const bumpCache = useCallback(() => setCacheVersion((v) => v + 1), []);

  const resetTree = useCallback(() => {
    setExpanded(new Set());
    setRootEntries([]);
    childrenCacheRef.current = new Map();
    hasMdCacheRef.current = new Map();
  }, []);

  return {
    rootEntries,
    setRootEntries,
    expanded,
    setExpanded,
    loadingDirs,
    setLoadingDirs,
    renamingPath,
    setRenamingPath,
    creatingInDir,
    setCreatingInDir,
    creatingFolderInDir,
    setCreatingFolderInDir,
    dragOverPath,
    setDragOverPath,
    dragSourceRef,
    childrenCacheRef,
    hasMdCacheRef,
    cacheVersion,
    bumpCache,
    resetTree,
  };
}
