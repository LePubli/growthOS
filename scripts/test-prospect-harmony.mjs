import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../artifacts/growthos/src/atlas-prospect-colors.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../artifacts/growthos/src/index.css', import.meta.url), 'utf8');
assert.ok(entry.includes('@import "./atlas-prospect-colors.css"'), 'La palette doit rester chargée dans ATLAS');

const rgb = hex => hex.match(/[0-9a-f]{2}/g).map(channel => parseInt(channel, 16));
const luminance = hex => rgb(hex).map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (high + .05) / (low + .05);
};
const colorDistance = (a, b) => Math.hypot(...rgb(a).map((value, i) => value - rgb(b)[i]));

function blockFor(selector, property) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(escaped + '\\s*\\{([^}]+)\\}', 'g'))];
  const block = matches.find(match => match[1].includes(property))?.[1];
  assert.ok(block, `Surface manquante : ${selector}`);
  return block;
}

function color(block, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = block.match(new RegExp(escaped + ':\\s*(#[0-9a-f]{6})', 'i'))?.[1];
  assert.ok(value, `Couleur absente : ${property}`);
  return value;
}

const topSelectors = [
  '.atlas-360-company', '.atlas-360-completeness', '.atlas-360-copilot',
  ...[1, 2, 3, 4].map(index => `.atlas-360-secondary-grid>.atlas-360-card:nth-child(${index})`),
];
const finishes = topSelectors.map(selector => {
  const block = blockFor(selector, '--atlas-harmony-from');
  const from = color(block, '--atlas-harmony-from');
  const to = color(block, '--atlas-harmony-to');
  assert.ok(contrast('#192b47', from) >= 8 && contrast('#192b47', to) >= 8,
    `Texte trop peu contrasté sur ${selector}`);
  return to;
});
for (let first = 0; first < finishes.length; first++) {
  for (let second = first + 1; second < finishes.length; second++) {
    assert.ok(colorDistance(finishes[first], finishes[second]) >= 12,
      `${topSelectors[first]} et ${topSelectors[second]} ont des fonds indiscernables`);
  }
}

for (const selector of ['.atlas-company-watch', '.atlas-360-legal-extra', '.atlas-360-detail-contacts',
  '.atlas-360-professional-sources>section', '.atlas-360-pj-details', '.atlas-360-enriched-data',
  '.atlas-360-detail-activities', '.atlas-360-collaboration']) {
  const block = blockFor(selector, '--atlas-detail-from');
  assert.ok(contrast('#192b47', color(block, '--atlas-detail-to')) >= 8,
    `Dossier détaillé insuffisamment contrasté : ${selector}`);
}
assert.match(css, /background:linear-gradient\(128deg,var\(--atlas-harmony-from/);
assert.match(css, /background:linear-gradient\(135deg,var\(--atlas-detail-from/);
assert.doesNotMatch(css, /border-top:\s*3px solid/,
  'Les anciens bandeaux colorés épais ne doivent pas réapparaître');
console.log('✓ Harmony : 7 fonds harmonisés et contrastés, 8 modules détaillés et sans liserés épais');
