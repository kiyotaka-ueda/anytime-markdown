import { useCallback, useRef, useState } from "react";
import type {
  TimelineCommit,
  TimelineDataProvider,
  TimelineState,
} from "../types/timeline";

const INITIAL_STATE: TimelineState = {
  commits: [],
  selectedIndex: 0,
  content: null,
  previousContent: null,
  isLoading: false,
  error: null,
};

export function useTimeline(
  provider: TimelineDataProvider | null,
  filePath: string | null,
) {
  const [state, setState] = useState<TimelineState>(INITIAL_STATE);
  const filePathRef = useRef(filePath);
  const activeFilePathRef = useRef<string | null>(null);
  const commitsRef = useRef<TimelineCommit[]>([]);

  filePathRef.current = filePath;
  commitsRef.current = state.commits;

  const fetchContent = useCallback(
    async (
      commits: TimelineCommit[],
      index: number,
      fp: string,
    ): Promise<{ content: string | null; previousContent: string | null }> => {
      if (!provider || index < 0 || index >= commits.length) {
        return { content: null, previousContent: null };
      }
      const content = await provider.getFileContent(fp, commits[index].sha);
      const previousContent =
        index < commits.length - 1
          ? await provider.getFileContent(fp, commits[index + 1].sha)
          : null;
      return { content, previousContent };
    },
    [provider],
  );

  const loadTimeline = useCallback(
    async (fp: string) => {
      if (!provider) return;
      activeFilePathRef.current = fp;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const commits = await provider.getCommits(fp);
        if (commits.length === 0) {
          setState({
            ...INITIAL_STATE,
            error: "No commits found",
          });
          return;
        }
        const { content, previousContent } = await fetchContent(commits, 0, fp);
        setState({
          commits,
          selectedIndex: 0,
          content,
          previousContent,
          isLoading: false,
          error: null,
        });
      } catch (e) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: e instanceof Error ? e.message : "Unknown error",
        }));
      }
    },
    [provider, fetchContent],
  );

  const selectCommit = useCallback(
    async (index: number) => {
      const fp = activeFilePathRef.current ?? filePathRef.current;
      if (!provider || !fp) return;
      const commits = commitsRef.current;
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const { content, previousContent } = await fetchContent(
          commits,
          index,
          fp,
        );
        setState((prev) => ({
          ...prev,
          selectedIndex: index,
          content,
          previousContent,
          isLoading: false,
        }));
      } catch (e) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: e instanceof Error ? e.message : "Unknown error",
        }));
      }
    },
    [provider, fetchContent],
  );

  const close = useCallback(() => {
    activeFilePathRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    loadTimeline,
    selectCommit,
    close,
  };
}
