import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { getChangedPositions } from "../extensions/changeGutterExtension";

interface MinimapState {
  markerRatios: number[];
  viewportRatio: { top: number; height: number };
}

const SCROLL_CONTAINER_ID = "md-editor-content";

function getScrollContainer(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID);
}

function calcMarkerRatios(editor: Editor): number[] {
  const container = getScrollContainer();
  if (!container) return [];

  const { scrollTop, scrollHeight } = container;
  const containerTop = container.getBoundingClientRect().top;
  const positions = getChangedPositions(editor.state);

  return positions.flatMap((pos) => {
    try {
      const domInfo = editor.view.domAtPos(pos);
      const el =
        domInfo.node instanceof Element
          ? (domInfo.node as HTMLElement)
          : (domInfo.node as Node).parentElement;
      if (!el) return [];
      const elTop = el.getBoundingClientRect().top;
      const absY = elTop - containerTop + scrollTop;
      const ratio = absY / scrollHeight;
      return [Math.max(0, Math.min(1, ratio))];
    } catch {
      return [];
    }
  });
}

function calcViewportRatio(container: HTMLElement): { top: number; height: number } {
  const { scrollTop, scrollHeight, clientHeight } = container;
  if (scrollHeight === 0) return { top: 0, height: 1 };
  return {
    top: scrollTop / scrollHeight,
    height: clientHeight / scrollHeight,
  };
}

export function useMarkdownMinimap(editor: Editor | null) {
  const [state, setState] = useState<MinimapState>({
    markerRatios: [],
    viewportRatio: { top: 0, height: 1 },
  });

  const recalculate = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const container = getScrollContainer();
    if (!container) return;
    setState({
      markerRatios: calcMarkerRatios(editor),
      viewportRatio: calcViewportRatio(container),
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", recalculate);
    return () => { editor.off("update", recalculate); };
  }, [editor, recalculate]);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    container.addEventListener("scroll", recalculate, { passive: true });
    return () => { container.removeEventListener("scroll", recalculate); };
  }, [recalculate]);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    const ro = new ResizeObserver(recalculate);
    ro.observe(container);
    return () => ro.disconnect();
  }, [recalculate]);

  useEffect(() => { recalculate(); }, [recalculate]);

  const handleBarClick = useCallback(
    (ratio: number) => {
      const container = getScrollContainer();
      if (!container) return;
      container.scrollTo({ top: ratio * container.scrollHeight, behavior: "smooth" });
    },
    [],
  );

  const goToNext = useCallback(() => {
    editor?.commands.goToNextChange();
  }, [editor]);

  const goToPrev = useCallback(() => {
    editor?.commands.goToPrevChange();
  }, [editor]);

  return {
    markerRatios: state.markerRatios,
    viewportRatio: state.viewportRatio,
    hasChanges: state.markerRatios.length > 0,
    handleBarClick,
    goToNext,
    goToPrev,
  };
}
