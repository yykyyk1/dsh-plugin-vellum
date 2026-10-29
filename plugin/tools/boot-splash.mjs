// 暗色片头：把 deepseek-boot 那套原封不动搬进来（只把冷蓝换成暖色）。
//
// 这条链路和之前 dsh-plugin-deepseek-splash 完全一致：
//   index.html + style.css + animation.js + config.js + 鲸鱼路径
//   → 全部内联进一个自包含 payload
//   → 装进 Shadow DOM（app 的 CSS / id 不会打架）
//   → 播完自己移除
//
// 和那个插件唯一的差别：不在这里判"播过没有"，交给合并版的主题逻辑决定
// （暗色播这个，亮色播线稿版）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HEX = {
  '#07090e': '#0b0703',
  '#0d1220': '#140c05',
  '#0a0f1c': '#0f0a05',
  '#111a33': '#1c1208',
  '#4d6bfe': '#dc5000',
  '#9fb2ff': '#ffb27a',
  '#eef2ff': '#ffedd7',
  '#e6ecff': '#ffe3c4',
  '#c3d0ff': '#e8c9a8',
  '#e8eeff': '#ffe9cf',
  '#cfd9ff': '#f0d8bb',
  '#dbe4ff': '#f6e1c6',
  '#eaf0ff': '#ffe9cf',
  '#b9c8ff': '#f0d0ae',
  '#9fb4ff': '#e0b184',
  '#ffffff': '#ffedd7',
};
const RGB = {
  '77,107,254': '220,80,0',
  '110,140,255': '255,140,0',
  '130,155,255': '255,150,60',
  '140,164,255': '255,178,110',
  '155,176,255': '255,170,90',
  '160,180,255': '255,178,122',
  '178,194,255': '255,200,150',
  '198,214,255': '255,214,170',
  '200,211,255': '255,220,180',
  '255,255,255': '255,237,215',
};

function warm(text) {
  let out = text.replace(/(rgba?\()\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, pre, r, g, b) => {
    const key = `${r},${g},${b}`;
    return pre + (RGB[key] ? RGB[key].split(',').join(', ') : `${r}, ${g}, ${b}`);
  });
  for (const [from, to] of Object.entries(HEX)) out = out.split(from).join(to);
  return out;
}

export async function buildBootSplash(ws) {
  const boot = join(ws, 'deepseek-boot');
  const read = (p) => readFile(join(boot, p), 'utf8');
  const [html, cssRaw, animRaw, config, whale] = await Promise.all([
    read('index.html'),
    read('style.css'),
    read('animation.js'),
    read('config.js'),
    read('assets/whale-path.js'),
  ]);

  const css = warm(cssRaw);
  const anim = warm(animRaw);

  const scoped = css
    .replace(/:root\s*\{/g, ':host {')
    .replace(/html,\s*body\s*\{/g, ':host {')
    .replace(/(^|\n)body\s*\{/g, '$1:host {')
    .replace(/body\.done\s+#stage/g, ':host(.done) #stage')
    .replace(/\bbody\b(?=\s*\.)/g, ':host')
    .replace('#stage {\n  position: fixed;', '#stage {\n  position: absolute;');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error('index.html 里找不到 <body>');
  const markup = warm(bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim());

  return `/* ---- 暗色片头（deepseek-boot 原版，只换了配色） ---- */
(function () {
  if (window.__DSH_BOOT_SPLASH__) return;
  var CSS = ${JSON.stringify(scoped)};
  var MARKUP = ${JSON.stringify(markup)};

${config}

${whale}

${anim}

  var host = null;

  function start() {
    if (host) return;
    var parent = document.body || document.documentElement;
    if (!parent) { setTimeout(start, 20); return; }

    host = document.createElement("div");
    host.id = "dsh-boot-host";
    host.setAttribute("data-dsh-boot", "1");
    host.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;top:40px;" +
      "margin:0;padding:0;border:0;overflow:hidden;" +
      "z-index:2147483600;background:transparent;pointer-events:auto;";

    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "dsb-root";
    wrap.innerHTML = MARKUP;
    shadow.appendChild(wrap);
    parent.appendChild(host);

    window.DSB.mount(shadow, {
      onFinish: function () {
        try { if (host && host.parentNode) host.parentNode.removeChild(host); } catch (e) {}
        host = null;
      }
    });
  }

  function cancel() {
    if (!host) return;
    try { if (host.parentNode) host.parentNode.removeChild(host); } catch (e) {}
    host = null;
  }

  window.__DSH_BOOT_SPLASH__ = { start: start, cancel: cancel };
})();`;
}
