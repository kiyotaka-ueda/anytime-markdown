import { useEffect, useRef, useState } from "react";

import { EDITOR_HEIGHT_DEFAULT, EDITOR_HEIGHT_MD, EDITOR_HEIGHT_MIN,EDITOR_HEIGHT_MOBILE } from "../constants/dimensions";
import { DEBOUNCE_SHORT } from "../constants/timing";

export function useEditorHeight(isMobile: boolean, isMd: boolean, bottomOffset = 0) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(isMd ? EDITOR_HEIGHT_MD : isMobile ? EDITOR_HEIGHT_MOBILE : EDITOR_HEIGHT_DEFAULT);

  useEffect(() => {
    const update = () => {
      if (!editorContainerRef.current) return;
      const top = editorContainerRef.current.getBoundingClientRect().top;
      const parent = editorContainerRef.current.closest("#main-content");
      const paddingBottom = parent
        ? parseFloat(getComputedStyle(parent).paddingBottom) || 0
        : (isMobile ? 16 : 24);
      setEditorHeight(Math.max(Math.floor(window.innerHeight - top - paddingBottom - bottomOffset), EDITOR_HEIGHT_MIN));
    };
    update();
    const timer = setTimeout(update, DEBOUNCE_SHORT);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, [isMobile, bottomOffset]);

  return { editorContainerRef, editorHeight };
}
