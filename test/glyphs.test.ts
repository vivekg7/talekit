import { describe, expect, it } from 'vitest';
import { bubbleSvg, textWidth, wrapText } from '../src/engine/bubble.js';
import { hasDevanagari, needsShaping, shapedText, shapedWidth } from '../src/engine/glyphs.js';

const spec = (text: string) => ({
  text,
  style: 'speech' as const,
  headX: 400,
  headTop: 400,
  frameW: 1280,
  frameH: 720,
  font: 'Chalkboard SE',
  uiScale: 1,
});

describe('Devanagari text', () => {
  it('is shaped here; Latin text is left to the rasteriser', () => {
    expect(needsShaping('अरे कछुए')).toBe(true);
    expect(needsShaping('Hello, rabbit!')).toBe(false);
    expect(bubbleSvg(spec('Hello, rabbit!'))).toContain('<text');
    const hindi = bubbleSvg(spec('अरे कछुए, तुम कितने धीमे हो!'));
    expect(hindi).not.toContain('<text');
    expect(hindi.match(/<path transform='translate/g)!.length).toBeGreaterThan(10);
  });

  it('measures by its shaped advances, so wrapping fits the drawn width', () => {
    const w = shapedWidth('कछुआ', 26);
    expect(w).toBeGreaterThan(40);
    expect(w).toBeLessThan(90);
    expect(textWidth('कछुआ', 26)).toBe(w);
    expect(shapedWidth('कछुआ', 26, true)).toBeGreaterThan(w);
    const lines = wrapText('धीरे धीरे चलने वाला कछुआ दौड़ जीत गया', 200, 26);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 26)).toBeLessThanOrEqual(200);
  });

  it('draws the same outlines every time, centred on x', () => {
    const a = shapedText('खरगोश', { x: 300, y: 100, fontSize: 26, fill: '#111' });
    expect(a).toBe(shapedText('खरगोश', { x: 300, y: 100, fontSize: 26, fill: '#111' }));
    const x0 = 300 - shapedWidth('खरगोश', 26) / 2;
    expect(a.startsWith(`<g transform='translate(${Math.round(x0 * 100) / 100} 100) scale(`)).toBe(
      true
    );
  });

  it('is told apart by one definition: letters, not the dandas other scripts share', () => {
    expect(hasDevanagari('अरे कछुए।')).toBe(true);
    expect(hasDevanagari('\ua8f2')).toBe(true);
    expect(hasDevanagari('Hello, rabbit!')).toBe(false);
    expect(hasDevanagari('আমি।')).toBe(false);
  });

  it('draws every र of a growl, though the font cannot stack rakars', () => {
    const one = shapedWidth('ग्र', 26);
    const three = shapedWidth('ग्र्र्र', 26);
    expect(three).toBeGreaterThan(one + 15);
    expect(shapedWidth('ग्र्र्र्र', 26)).toBeGreaterThan(three + 5);
  });

  it('splits a word too long for the line between letters, never inside a conjunct', () => {
    const lines = wrapText('क्षत्रियस्त्रीकुत्ताक्षत्रियस्त्री', 80, 26);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('क्षत्रियस्त्रीकुत्ताक्षत्रियस्त्री');
    for (const l of lines) {
      expect(l).not.toMatch(/^\p{M}/u);
      expect(l).not.toMatch(/\u094d$/);
    }
  });
});
