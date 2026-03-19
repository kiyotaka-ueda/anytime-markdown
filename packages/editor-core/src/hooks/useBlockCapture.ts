import type { NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";

import { CAPTURE_BG } from "../constants/colors";

/**
 * ブロック要素を PNG としてキャプチャしてダウンロードするフック。
 * getPos からエディタ内の NodeView DOM を特定し、コンテンツ部分をキャプチャする。
 */
export function useBlockCapture(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"], fileName = "block.png") {
  return useCallback(async () => {
    if (!editor || typeof getPos !== "function") return;
    const pos = getPos();
    if (pos == null) return;

    // ProseMirror の nodeDOM で NodeView のルート要素を取得
    const dom = editor.view.nodeDOM(pos);
    const el = dom instanceof HTMLElement ? dom : null;
    if (!el) return;

    try {
      // キャプチャ対象: ツールバー ([data-block-toolbar]) を除いたコンテンツ
      // pre, img, svg, canvas, またはコンテナの子要素を対象
      const target = el.querySelector("svg") ?? el.querySelector("img:not([data-block-toolbar] img)") ?? el.querySelector("pre") ?? el;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const scale = 2;
      const w = rect.width;
      const h = rect.height;

      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = CAPTURE_BG;
      ctx.fillRect(0, 0, w, h);

      // img 要素のキャプチャ
      if (target instanceof HTMLImageElement) {
        await waitForImage(target);
        try {
          ctx.drawImage(target, 0, 0, w, h);
          downloadCanvas(canvas, fileName);
          return;
        } catch {
          // taint — fallback below
        }
      }

      // DOM → SVG foreignObject → Canvas → PNG
      const svgNs = "http://www.w3.org/2000/svg";
      const xhtml = "http://www.w3.org/1999/xhtml";

      // スタイルをインライン化したクローンを作成
      const clone = cloneWithStyles(target as HTMLElement);

      const svgStr = [
        `<svg xmlns="${svgNs}" width="${w}" height="${h}">`,
        `<foreignObject width="100%" height="100%">`,
        `<div xmlns="${xhtml}" style="width:${w}px;height:${h}px;background:${CAPTURE_BG};overflow:hidden">`,
        new XMLSerializer().serializeToString(clone),
        `</div></foreignObject></svg>`,
      ].join("");

      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        downloadCanvas(canvas, fileName);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    } catch (err) {
      console.error("Block capture failed:", err);
    }
  }, [editor, getPos, fileName]);
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete) { resolve(); return; }
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

function cloneWithStyles(el: HTMLElement): HTMLElement {
  const clone = el.cloneNode(true) as HTMLElement;
  const computed = getComputedStyle(el);
  clone.style.cssText = computed.cssText;
  clone.style.margin = "0";
  clone.style.position = "static";
  return clone;
}

async function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  await saveBlob(blob, fileName);
}

/** showSaveFilePicker が使えればネイティブ保存ダイアログ、なければ従来のダウンロード */
async function saveBlob(blob: Blob, suggestedName: string) {
  // File System Access API (Chrome/Edge)
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName,
        types: [{
          description: "PNG Image",
          accept: { "image/png": [".png"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // ユーザーがキャンセルした場合は何もしない
      if (err instanceof DOMException && err.name === "AbortError") return;
      // その他のエラーはフォールバック
    }
  }
  // フォールバック: 従来のダウンロード
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
}
