/**
 * Tiny SVG string helpers shared by all art files. Colours come from CSS classes (see the "robot art" block in
 * style.css): `f-*` fills (with the outline), `ln` strokes. Nothing else is needed to draw a part.
 */
export type Fill = 'body' | 'hi' | 'lo' | 'metal' | 'dark' | 'acc' | 'glow' | 'hot' | 'light';

const n = (v: number) => Math.round(v * 100) / 100;

export const rect = (x: number, y: number, w: number, h: number, fill: Fill, r = 0, extra = ''): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${r}"` : ''} class="f-${fill}"${extra ? ` ${extra}` : ''}/>`;
export const circle = (cx: number, cy: number, r: number, fill: Fill, extra = ''): string => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" class="f-${fill}"${extra ? ` ${extra}` : ''}/>`;
export const poly = (points: readonly (readonly [number, number])[], fill: Fill, extra = ''): string => `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" class="f-${fill}"${extra ? ` ${extra}` : ''}/>`;
export const path = (d: string, fill: Fill, extra = ''): string => `<path d="${d}" class="f-${fill}"${extra ? ` ${extra}` : ''}/>`;
/** A stroke-only detail line (panel seam, vent, cable). */
export const line = (d: string, extra = ''): string => `<path d="${d}" class="ln"${extra ? ` ${extra}` : ''}/>`;
/** A bright detail without outline. */
export const spark = (shape: string): string => `<g class="nl">${shape}</g>`;
export const g = (cls: string, ...children: string[]): string => `<g class="${cls}">${children.join('')}</g>`;
export const mirrorY = (build: (side: 1 | -1) => string): string => build(1) + build(-1);
