/**
 * @jest-environment jsdom
 */
import { exportToDrawio } from '../../io/exportDrawio';
import { importFromDrawio } from '../../io/importDrawio';
import { createDocument, createNode, createEdge } from '../../types';

describe('exportToDrawio', () => {
  it('should produce valid mxfile XML for empty document', () => {
    const doc = createDocument('Empty');
    const xml = exportToDrawio(doc);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<mxfile>');
    expect(xml).toContain('</mxfile>');
    expect(xml).toContain('<mxCell id="0"/>');
    expect(xml).toContain('<mxCell id="1" parent="0"/>');
  });

  it('should export a node with correct geometry', () => {
    const doc = createDocument('Test');
    const node = createNode('rect', 50, 100, { id: 'n1', text: 'Box', width: 200, height: 80 });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('value="Box"');
    expect(xml).toContain('vertex="1"');
    expect(xml).toContain('x="50"');
    expect(xml).toContain('y="100"');
    expect(xml).toContain('width="200"');
    expect(xml).toContain('height="80"');
  });

  it('should escape special characters in node text', () => {
    const doc = createDocument('Test');
    const node = createNode('rect', 0, 0, { id: 'n1', text: 'A & B <C>' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
  });

  it('should round-trip: export then import preserves node properties', () => {
    const doc = createDocument('RoundTrip');
    const node = createNode('ellipse', 30, 40, {
      id: 'rt1',
      text: 'Test Node',
      width: 120,
      height: 60,
    });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    const imported = importFromDrawio(xml);

    expect(imported.nodes).toHaveLength(1);
    const importedNode = imported.nodes[0];
    expect(importedNode.id).toBe('rt1');
    expect(importedNode.type).toBe('ellipse');
    expect(importedNode.x).toBe(30);
    expect(importedNode.y).toBe(40);
    expect(importedNode.width).toBe(120);
    expect(importedNode.height).toBe(60);
    expect(importedNode.text).toBe('Test Node');
  });

  it('should round-trip edge with source and target', () => {
    const doc = createDocument('RoundTrip');
    const n1 = createNode('rect', 0, 0, { id: 'a', text: 'A' });
    const n2 = createNode('rect', 200, 0, { id: 'b', text: 'B' });
    const edge = createEdge('connector', { nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 0, y: 0 }, { id: 'e1' });
    doc.nodes = [n1, n2];
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    const imported = importFromDrawio(xml);

    expect(imported.edges).toHaveLength(1);
    expect(imported.edges[0].from.nodeId).toBe('a');
    expect(imported.edges[0].to.nodeId).toBe('b');
  });

  it('should export parallelogram node with correct shape style', () => {
    const doc = createDocument('Test');
    const node = createNode('parallelogram', 0, 0, { id: 'p1', text: 'IO' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('shape=parallelogram');
  });

  it('should export cylinder node with correct shape style', () => {
    const doc = createDocument('Test');
    const node = createNode('cylinder', 0, 0, { id: 'cy1', text: 'DB' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('shape=cylinder3');
  });

  it('should export sticky node with note shape', () => {
    const doc = createDocument('Test');
    const node = createNode('sticky', 0, 0, { id: 's1', text: 'Note' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('shape=note');
  });

  it('should export text node with no fill/stroke', () => {
    const doc = createDocument('Test');
    const node = createNode('text', 0, 0, { id: 't1', text: 'Label' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('strokeColor=none');
    expect(xml).toContain('fillColor=none');
  });

  it('should export diamond node as rhombus', () => {
    const doc = createDocument('Test');
    const node = createNode('diamond', 0, 0, { id: 'd1', text: 'Decision' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('rhombus');
  });

  it('should export connector edge with bezier routing', () => {
    const doc = createDocument('Test');
    const n1 = createNode('rect', 0, 0, { id: 'a', text: 'A' });
    const n2 = createNode('rect', 200, 0, { id: 'b', text: 'B' });
    const edge = createEdge('connector', { nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 0, y: 0 }, { id: 'e1' });
    edge.style.routing = 'bezier';
    doc.nodes = [n1, n2];
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('curved=1');
  });

  it('should export edge with circle endShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e2' });
    edge.style.endShape = 'circle';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('endArrow=oval');
  });

  it('should export edge with diamond endShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e3' });
    edge.style.endShape = 'diamond';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('endArrow=diamond');
  });

  it('should export edge with bar endShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e4' });
    edge.style.endShape = 'bar';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('endArrow=block;endFill=0');
  });

  it('should export edge with none endShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e5' });
    edge.style.endShape = 'none';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('endArrow=none');
  });

  it('should export edge with arrow startShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e6' });
    edge.style.startShape = 'arrow';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('startArrow=classic');
  });

  it('should export edge with circle startShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e7' });
    edge.style.startShape = 'circle';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('startArrow=oval');
  });

  it('should export edge with diamond startShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e8' });
    edge.style.startShape = 'diamond';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('startArrow=diamond');
  });

  it('should export edge with bar startShape', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'e9' });
    edge.style.startShape = 'bar';
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('startArrow=block');
  });

  it('should export sourcePoint when edge has no source nodeId', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { x: 10, y: 20 }, { nodeId: 'n1', x: 0, y: 0 }, { id: 'e10' });
    const node = createNode('rect', 200, 0, { id: 'n1', text: 'A' });
    doc.nodes = [node];
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('as="sourcePoint"');
    expect(xml).toContain('x="10"');
    expect(xml).toContain('y="20"');
  });

  it('should export targetPoint when edge has no target nodeId', () => {
    const doc = createDocument('Test');
    const edge = createEdge('line', { nodeId: 'n1', x: 0, y: 0 }, { x: 300, y: 400 }, { id: 'e11' });
    const node = createNode('rect', 0, 0, { id: 'n1', text: 'A' });
    doc.nodes = [node];
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('as="targetPoint"');
    expect(xml).toContain('x="300"');
    expect(xml).toContain('y="400"');
  });

  it('should export node with URL as link attribute', () => {
    const doc = createDocument('Test');
    const node = createNode('rect', 0, 0, { id: 'u1', text: 'Link', url: 'https://example.com' });
    doc.nodes = [node];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('link="https://example.com"');
  });

  it('should export edge with label', () => {
    const doc = createDocument('Test');
    const edge = createEdge('arrow', { x: 0, y: 0 }, { x: 100, y: 100 }, { id: 'el1', label: 'yes' });
    doc.edges = [edge];
    const xml = exportToDrawio(doc);
    expect(xml).toContain('value="yes"');
  });
});
