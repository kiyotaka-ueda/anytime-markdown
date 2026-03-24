import { GraphDocument, GraphNode, GraphEdge } from '../types';
import { escapeXml, toHexColor } from './utils';

function nodeStyle(node: GraphNode): string {
  const parts: string[] = [];
  const fill = toHexColor(node.style.fill).replace('#', '');
  const stroke = toHexColor(node.style.stroke).replace('#', '');

  switch (node.type) {
    case 'ellipse':
      parts.push('ellipse');
      break;
    case 'diamond':
      parts.push('rhombus');
      break;
    case 'parallelogram':
      parts.push('shape=parallelogram');
      break;
    case 'cylinder':
      parts.push('shape=cylinder3;size=15');
      break;
    case 'sticky':
      parts.push('shape=note;size=15');
      break;
    case 'text':
      parts.push('text;strokeColor=none;fillColor=none');
      return parts.join(';');
    default:
      parts.push('rounded=0');
  }

  parts.push(`fillColor=#${fill}`);
  parts.push(`strokeColor=#${stroke}`);
  parts.push(`strokeWidth=${node.style.strokeWidth}`);
  parts.push(`fontSize=${node.style.fontSize}`);
  parts.push(`fontFamily=${node.style.fontFamily}`);
  parts.push('fontColor=#FFFFFF');
  parts.push('whiteSpace=wrap');
  parts.push('html=1');

  return parts.join(';');
}

function edgeStyle(edge: GraphEdge): string {
  const parts: string[] = [];
  const stroke = toHexColor(edge.style.stroke).replace('#', '');

  if (edge.type === 'connector') {
    const routing = edge.style.routing ?? 'orthogonal';
    if (routing === 'bezier') {
      parts.push('edgeStyle=orthogonalEdgeStyle;curved=1');
    } else {
      parts.push('edgeStyle=orthogonalEdgeStyle');
    }
  }

  parts.push(`strokeColor=#${stroke}`);
  parts.push(`strokeWidth=${edge.style.strokeWidth}`);

  const endShape = edge.style.endShape ?? ((edge.type === 'arrow' || edge.type === 'connector') ? 'arrow' : 'none');
  const startShape = edge.style.startShape ?? 'none';

  if (endShape === 'none') parts.push('endArrow=none');
  else if (endShape === 'circle') parts.push('endArrow=oval;endFill=1');
  else if (endShape === 'diamond') parts.push('endArrow=diamond;endFill=1');
  else if (endShape === 'bar') parts.push('endArrow=block;endFill=0');
  else parts.push('endArrow=classic;endFill=1');

  if (startShape === 'none') parts.push('startArrow=none');
  else if (startShape === 'arrow') parts.push('startArrow=classic;startFill=1');
  else if (startShape === 'circle') parts.push('startArrow=oval;startFill=1');
  else if (startShape === 'diamond') parts.push('startArrow=diamond;startFill=1');
  else if (startShape === 'bar') parts.push('startArrow=block;startFill=0');

  parts.push('html=1');
  return parts.join(';');
}

export function exportToDrawio(doc: GraphDocument): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<mxfile>');
  lines.push('<diagram>');
  lines.push('<mxGraphModel>');
  lines.push('<root>');
  lines.push('<mxCell id="0"/>');
  lines.push('<mxCell id="1" parent="0"/>');

  for (const node of doc.nodes) {
    const style = nodeStyle(node);
    const label = escapeXml(node.text);
    lines.push(`<mxCell id="${escapeXml(node.id)}" value="${label}" style="${style}" vertex="1" parent="1">`);
    lines.push(`<mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry"/>`);
    lines.push('</mxCell>');
  }

  for (const edge of doc.edges) {
    const style = edgeStyle(edge);
    const label = edge.label ? escapeXml(edge.label) : '';
    const src = edge.from.nodeId ? `source="${escapeXml(edge.from.nodeId)}"` : '';
    const tgt = edge.to.nodeId ? `target="${escapeXml(edge.to.nodeId)}"` : '';
    lines.push(`<mxCell id="${escapeXml(edge.id)}" value="${label}" style="${style}" edge="1" parent="1" ${src} ${tgt}>`);
    lines.push('<mxGeometry relative="1" as="geometry">');
    if (!edge.from.nodeId) {
      lines.push(`<mxPoint x="${edge.from.x}" y="${edge.from.y}" as="sourcePoint"/>`);
    }
    if (!edge.to.nodeId) {
      lines.push(`<mxPoint x="${edge.to.x}" y="${edge.to.y}" as="targetPoint"/>`);
    }
    lines.push('</mxGeometry>');
    lines.push('</mxCell>');
  }

  lines.push('</root>');
  lines.push('</mxGraphModel>');
  lines.push('</diagram>');
  lines.push('</mxfile>');
  return lines.join('\n');
}
