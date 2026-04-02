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

      const runningLayout: Layouts = cy.layout(layoutOpts).run();

      cyRef.current = cy;
      onCyReady?.(cy);

      return () => {
        runningLayout.stop();
        cy.stop();
        cy.elements().stop();
        cy.destroy();
        cyRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <Box ref={containerRef} sx={{ width: '100%', height: '100%', ...sx }} />;
  },
);
