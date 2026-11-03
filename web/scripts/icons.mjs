// Renders the app icons from icons/hydra.svg (artwork only) into public/.
// Run with `npm run icons -w web` after changing the artwork; outputs are committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BACKGROUND = '#14202E';
const art = readFileSync(new URL('../icons/hydra.svg', import.meta.url), 'utf8');
const inner = art.slice(art.indexOf('>', art.indexOf('<svg')) + 1, art.lastIndexOf('</svg>'));
const out = (name) => new URL(`../public/${name}`, import.meta.url);

/** The artwork on a background; `scale` shrinks it around the centre. */
function compose({ rounded, scale }) {
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g>
</svg>
`;
}

function png(svg, size, name) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  writeFileSync(out(name), image.asPng());
}

// Regular icon: rounded square, also the favicon. (Home inlines the artwork on the same background.)
const icon = compose({ rounded: true, scale: 0.9 });
writeFileSync(out('icon.svg'), icon);
png(icon, 192, 'icon-192.png');
png(icon, 512, 'icon-512.png');
png(icon, 32, 'favicon-32.png');
// Maskable: full-bleed background, artwork inside the 80% safe zone.
png(compose({ rounded: false, scale: 0.72 }), 512, 'icon-maskable-512.png');
// iOS rounds the corners itself and wants no transparency.
png(compose({ rounded: false, scale: 0.84 }), 180, 'apple-touch-icon.png');
