'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import cytoscape, {
  type Core,
  type ElementDefinition,
  type Layouts,
  type StylesheetJsonBlock,
  type LayoutOptions,
} from 'cytoscape';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

export interface CytoscapeCanvasProps {
  readonly elements: ElementDefinition[];
  readonly stylesheet?: StylesheetJsonBlock[];
  readonly layout?: LayoutOptions;
  readonly onCyReady?: (cy: Core) => void;
  readonly sx?: SxProps<Theme>;
}

export interface CytoscapeCanvasRef {
  getCy: () => Core | null;
}

export const CytoscapeCanvas = forwardRef<CytoscapeCanvasRef, CytoscapeCanvasProps>(
  function CytoscapeCanvas({ elements, stylesheet, layout, onCyReady, sx }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);

    useImperativeHandle(ref, () => ({
      getCy: () => cyRef.current,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const layoutOpts = layout ?? { name: 'cose' };

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: stylesheet,
        layout: { name: 'preset' },
      });

      cyRef.current = cy;
      onCyReady?.(cy);

      // Defer layout start so React Strict Mode's immediate cleanup
      // can cancel it via clearTimeout before the layout begins.
      let runningLayout: Layouts | null = null;
      const layoutTimer = setTimeout(() => {
        runningLayout = cy.layout(layoutOpts).run();
      }, 0);

      return () => {
        clearTimeout(layoutTimer);
        runningLayout?.stop();
        cyRef.current = null;
        cy.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <Box ref={containerRef} sx={{ width: '100%', height: '100%', ...sx }} />;
  },
);
