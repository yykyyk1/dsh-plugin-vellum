// 由暗色皮肤生成亮色皮肤：几何一模一样，只把颜色反过来。
//
//   node tools/make-light-skin.mjs
//
// 做法：
//   1) 把暗色表里那份 --dsw-static-neutral* 暖刻度，换成暖纸→暖墨的同序刻度；
//   2) 其余颜色按"深→浅"映射表逐个替换（同色系、反明度）；
//   3) 选择器从 body[data-ds-dark-theme] 换成 html[data-dsh-theme="light"] body。
// 这样亮色的圆角、边框、间距和暗色完全一致，差别只在颜色。
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ---------- 暖色刻度：00 最亮 → 1000 最暗 ---------- */
const STOPS = [
  [0, '#fffdf8'], [50, '#fdf8ef'], [60, '#fbf5eb'], [75, '#f8f1e5'],
  [100, '#f5ede2'], [150, '#f0e6d7'], [200, '#eadfcd'], [300, '#ddd0ba'],
  [400, '#c9b9a1'], [500, '#b0a08a'], [600, '#93826e'], [700, '#6e5f4e'],
  [800, '#4a3d31'], [850, '#3a2f26'], [900, '#2a2018'], [950, '#1f1811'],
  [1000, '#16100a'],
];

function hexToRgb(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function rampAt(step) {
  let a = STOPS[0], b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (step >= STOPS[i][0] && step <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
  }
  const t = b[0] === a[0] ? 0 : (step - a[0]) / (b[0] - a[0]);
  const A = hexToRgb(a[1]), B = hexToRgb(b[1]);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/* ---------- 深 → 浅 的颜色映射 ---------- */
const HEX = {
  '#100904': '#f5ede2',   // 画布
  '#0b0703': '#efe4d4',
  '#180e06': '#fffaf2',
  '#1a1008': '#fffaf2',
  '#1a1009': '#fffaf2',
  '#21150c': '#fdf8f0',
  '#2a1c12': '#fffaf2',   // 抬升面
  '#382416': '#fffaf2',
  '#3a2b1e': '#efe4d4',
  '#33251a': '#f3eaDB',
  '#43352a': '#e6d9c7',
  '#40372e': '#ddcfbd',   // 发丝线
  '#4a2f1c': '#d9c9b4',
  '#55483a': '#8a7a66',   // 弱字
  '#6c5f51': '#7a6a56',
  '#857661': '#8a7a66',
  '#9b8a74': '#a1907a',
  '#b9a68c': '#c0b09a',
  '#d6c2a6': '#d8c9b4',
  '#fbf0dc': '#241a12',   // 亮字 → 墨
  '#f0e2cb': '#2a1e16',
  '#dccab0': '#3a2b1e',
  '#e6d4b9': '#2f241a',
  '#f5e7d1': '#241a12',
  '#f2e3cc': '#2a1e16',
  '#f7ead5': '#241a12',
  '#eee0c9': '#2a1e16',
  '#ffedd7': '#241a12',
  '#fafafa': '#fffaf2',
  '#ffa000': '#e08a2e',   // 琥珀
  '#dc5000': '#b84a0c',   // 橙墨
};

const RGB = {
  '255,237,215': '36,26,18',
  '255,160,0': '224,138,46',
  '220,80,0': '184,74,12',
  '16,9,4': '245,237,226',
  '255,176,80': '192,88,15',
  '173,178,184': '122,106,86',
  '129,133,140': '161,144,122',
};

function recolor(text) {
  let out = text.replace(/(rgba?\()\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, pre, r, g, b) => {
    const key = `${r},${g},${b}`;
    return pre + (RGB[key] ? RGB[key].split(',').join(', ') : `${r}, ${g}, ${b}`);
  });
  for (const [from, to] of Object.entries(HEX)) out = out.split(from).join(to);
  return out;
}

let css = await readFile(join(root, 'src', 'skin-dark.css'), 'utf8');

/* 1) 暖刻度：按 token 名字里的步进值换 */
css = css.replace(/(--dsw-static-neutral(?:-bluish)?-)(\d{2,4})(\s*:\s*)(#[0-9a-fA-F]{6})/g,
  (m, pre, step, sep) => pre + step + sep + rampAt(Number(step)));

/* 2) 其余颜色 */
css = recolor(css);

/* 3) 选择器 */
css = css.replaceAll('body[data-ds-dark-theme]', 'html[data-dsh-theme="light"] body')
         .replaceAll('[data-ds-dark-theme]', '[data-dsh-theme="light"]');

/* 4) 头注释 */
css = '/* 由 tools/make-light-skin.mjs 生成：暗色皮肤的几何 + 暖纸配色。别手改。 */\n' + css;

await writeFile(join(root, 'src', 'skin-light-generated.css'), css, 'utf8');
const sample = css.match(/--dsw-static-neutral-bluish-\d{2,4}:\s*#[0-9a-f]{6}/g) || [];
console.log('生成:', css.length, 'chars · 刻度条数', sample.length);
console.log(sample.slice(0, 6).join('\n'));
console.log(sample.slice(-4).join('\n'));
