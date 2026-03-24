import { GraphDocument, GraphNode, GraphEdge } from '../types';
import { computeOrthogonalPath, getConnectionPoints, nodeCenter } from '../engine/connector';
import {
  CANVAS_BG, COLOR_TEXT_PRIMARY, COLOR_TEXT_SECONDARY,
  FONT_FAMILY, DOC_ICON_COLOR, COLOR_ICE_BLUE,
} from '../theme';
import { escapeXml } from './utils';

function renderNodeSvg(node: GraphNode): string {
  const { id, type, x, y, width: w, height: h, text, style } = node;
  const lines: string[] = [];
  const fill = escapeXml(style.fill);
  const stroke = escapeXml(style.stroke);
  const sw = style.strokeWidth;

  lines.push(`<g id="${escapeXml(id)}">`);

  if (type === 'ellipse') {
    lines.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
  } else if (type === 'diamond') {
    const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
    lines.push(`<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
  } else if (type === 'sticky') {
    lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
  } else if (type === 'text') {
    // テキストノードは枠なし
  } else {
    lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
  }

  if (text) {
    lines.push(`<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" fill="${COLOR_TEXT_PRIMARY}" font-size="${style.fontSize}" font-family="${FONT_FAMILY}">${escapeXml(text)}</text>`);
  }

  if (type === 'insight' && node.label) {
    lines.push(`<text x="${x + 16}" y="${y + 20}" fill="${escapeXml(node.labelColor ?? COLOR_ICE_BLUE)}" font-size="10" font-weight="bold" font-family="${FONT_FAMILY}">${escapeXml(node.label)}</text>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

function renderEdgeSvg(edge: GraphEdge, nodes: GraphNode[]): string {
  const { id, style, type } = edge;
  const stroke = escapeXml(style.stroke);
  const sw = style.strokeWidth;
  const lines: string[] = [];
  lines.push(`<g id="${escapeXml(id)}">`);

  let points: { x: number; y: number }[] = [];

  if (type === 'connector' && edge.from.nodeId && edge.to.nodeId) {
    const fromNode = nodes.find(n => n.id === edge.from.nodeId);
    const toNode = nodes.find(n => n.id === edge.to.nodeId);
    if (fromNode && toNode) {
      points = computeOrthogonalPath(fromNode, toNode, 20, edge.manualMidpoint);
    }
  }

  if (points.length >= 2) {
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    lines.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`);
  } else {
    lines.push(`<line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="${stroke}" stroke-width="${sw}"/>`);
  }

  // 矢印マーカー
  const endShape = style.endShape ?? ((type === 'arrow' || type === 'connector') ? 'arrow' : 'none');
  if (endShape === 'arrow') {
    const last = points.length >= 2 ? points[points.length - 1] : { x: edge.to.x, y: edge.to.y };
    const prev = points.length >= 2 ? points[points.length - 2] : { x: edge.from.x, y: edge.from.y };
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    const len = 12;
    const x1 = last.x - len * Math.cos(angle - Math.PI / 6);
    const y1 = last.y - len * Math.sin(angle - Math.PI / 6);
    const x2 = last.x - len * Math.cos(angle + Math.PI / 6);
    const y2 = last.y - len * Math.sin(angle + Math.PI / 6);
    lines.push(`<polygon points="${last.x},${last.y} ${x1},${y1} ${x2},${y2}" fill="${stroke}"/>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

export function exportToSvg(doc: GraphDocument): string {
  const nodes = doc.nodes;
  const edges = doc.edges;

  // バウンディングボックス計算
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
  const pad = 40;
  const vx = minX - pad;
  const vy = minY - pad;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad * 2;

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`);
  parts.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${CANVAS_BG}"/>`);

  edges.forEach(e => parts.push(renderEdgeSvg(e, nodes)));
  nodes.forEach(n => parts.push(renderNodeSvg(n)));

  parts.push('</svg>');
  return parts.join('\n');
}
