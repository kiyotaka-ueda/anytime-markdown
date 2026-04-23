import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export type DropDecision =
  | { action: "wrap-left" | "wrap-right"; targetPos: number; targetElement: Element }
  | { action: "default" };

export interface ComputeDropTargetParams {
  view: EditorView;
  clientX: number;
  clientY: number;
}

const LEFT_THRESHOLD = 0.25;
const RIGHT_THRESHOLD = 0.75;

/**
 * ドラッグ中のカーソル位置が画像ブロックの左/右 25% 内にあるかを判定する。
 * 範囲外または画像ブロック上でない場合は "default" を返す。
 */
export function computeDropTarget(params: Readonly<ComputeDropTargetParams>): DropDecision {
  const { view, clientX, clientY } = params;
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return { action: "default" };

  const domAtPos = view.domAtPos(coords.pos);
  const nodeAtPos = domAtPos.node as Node | null;
  let targetElement: Element | null = null;
  if (nodeAtPos instanceof Element) {
    targetElement = nodeAtPos.closest("[data-image-block]");
  } else if (nodeAtPos?.parentElement) {
    targetElement = nodeAtPos.parentElement.closest("[data-image-block]");
  }
  if (!targetElement) return { action: "default" };

  const rect = targetElement.getBoundingClientRect();
  if (rect.width === 0) return { action: "default" };
  const xRatio = (clientX - rect.left) / rect.width;
  if (xRatio <= LEFT_THRESHOLD) {
    return { action: "wrap-left", targetPos: coords.pos, targetElement };
  }
  if (xRatio >= RIGHT_THRESHOLD) {
    return { action: "wrap-right", targetPos: coords.pos, targetElement };
  }
  return { action: "default" };
}

export const imageRowDropPluginKey = new PluginKey("imageRowDrop");

export const imageRowDropPlugin = new Plugin({
  key: imageRowDropPluginKey,
  props: {
    // handleDrop/handleDragOver は Task 12/13 で実装
  },
});
