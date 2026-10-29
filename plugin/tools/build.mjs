// 构建合并版：skin(暗/亮) + 舞台(暗/亮) + 片头 + 音效 + 控制条 → client.js
//
//   node tools/build.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { buildBootSplash } from './boot-splash.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';



const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const ws = join(root, '..');



const PKG = 'dsh-plugin-vellum';
const STYLE_ID = 'dsh-vellum-style';



const read = (p) => readFile(join(root, 'src', p), 'utf8');
const [skinDark, skinLight, tokensDark, fixCss, stageDarkCss, stageDarkJs, stageLightCss, stageLightJs,
       tagJs, themeJs, controlJs, controlCss, splashCss, splashJs,
       soundJs, soundHooks, petJs, petCss, paletteRaw, whaleSrc] = await Promise.all([
  read('skin-dark.css'), read('skin-light-generated.css'), read('tokens-dark.css'), read('fix.css'),
  read('stage-dark.css'), read('stage-dark.js'),
  read('stage-light.css'), read('stage-light.js'),
  read('tag.js'), read('theme.js'), read('control.js'), read('control.css'),
  read('splash.css'), read('splash.js'),
  read('sound.js'), read('sound-hooks.js'), read('pet.js'), read('pet.css'),
  read('dark-palette.json'),
  readFile(join(ws, 'deepseek-boot', 'assets', 'whale-path.js'), 'utf8'),
]);



const palette = JSON.parse(paletteRaw);
const whaleMatch = whaleSrc.match(/window\.WHALE_D\s*=\s*("(?:[^"\\]|\\.)*")/);
if (!whaleMatch) throw new Error('whale-path.js 里找不到 WHALE_D');



/* ---------- 作用域改写 ---------- */
const dark = skinDark
  .replaceAll('body[data-ds-dark-theme]', 'html[data-dsh-theme="dark"] body')
  .replaceAll('[data-ds-dark-theme]', '[data-dsh-theme="dark"]');



const light = skinLight.replaceAll('html[data-dsh-skin="vellum-light"]', 'html[data-dsh-theme="light"]');



const paletteBlock = Object.entries(palette)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n');



const css = `/* VELLUM — built from src/*, do not edit by hand */



/* ================= 暗色色板（app 的深色 token 搬进来） ================= */
html[data-dsh-theme="dark"] body {
${paletteBlock}
}



/* ================= 暗色 token 覆盖 ================= */
${tokensDark}

/* ================= 暗色皮肤 ================= */
${dark}



/* ================= 亮色皮肤（由暗色几何生成，只换配色） ================= */
${light}



/* ================= 对比度兜底 ================= */
${fixCss}

/* ================= 舞台 ================= */
${stageDarkCss}



${stageLightCss}



/* ================= 片头 ================= */
${splashCss}



/* ================= 桌宠 ================= */
${petCss}

/* ================= 控制条 ================= */
${controlCss}
`;

// 暗色片头：deepseek-boot 原版（粒子 / 描线 / 填充），只换配色
/* ---------- VS Code 原声：构建时内联成 base64 ---------- */
{
  const vsDir = join(root, 'assets', 'vs');
  const vsNames = ['click', 'open', 'send', 'think', 'response', 'ask', 'done'];
  const vs = {};
  for (const name of vsNames) {
    try {
      const buf = await readFile(join(vsDir, name + '.mp3'));
      vs[name] = 'data:audio/mpeg;base64,' + buf.toString('base64');
    } catch (e) { console.warn('VS 素材缺失:', name); }
  }
  globalThis.__VS_JSON__ = JSON.stringify(vs);
  console.log('VS 素材内联:', Object.keys(vs).length, '个');
}
/* ---------- 桌宠素材：构建时内联成 base64（视频，不占 GPU 3D） ---------- */
{
  const petDir = join(root, 'assets', 'pet');
  const pet = {};
  for (const name of ['idle', 'dance']) {
    try {
      const buf = await readFile(join(petDir, name + '.webm'));
      pet[name] = buf.toString('base64');
    } catch (e) { console.warn('桌宠素材缺失:', name); }
  }
  globalThis.__PET_JSON__ = JSON.stringify(pet);
  console.log('桌宠素材内联:', Math.round(Object.values(pet).join('').length / 1024), 'KB base64');
}
const bootSplash = await buildBootSplash(ws);

const client = `// 由 tools/build.mjs 生成，别手改。
window.__ModuleLoader__.load({
  id: ${JSON.stringify(PKG)},
  factory(require) {
    const CSS = ${JSON.stringify(css)};
    const STYLE_ID = ${JSON.stringify(STYLE_ID)};



    window.__DSH_WHALE_D__ = ${whaleMatch[1]};
    window.__DSH_VS_AUDIO__ = ${globalThis.__VS_JSON__};
    window.__DSH_PET__ = ${globalThis.__PET_JSON__};



${themeJs}



${stageDarkJs}
    window.__DSH_VELLUM_DARK_STAGE__ = window.__DSH_VELLUM_HERO__;



${stageLightJs}



${tagJs}



${soundJs}



${soundHooks}



${splashJs}



${bootSplash}



${petJs}

${controlJs}



    function apply(ctx) {
      ctx.effect(() => {
        const root = document.documentElement;
        const body = document.body;
        const beforeTheme = root.getAttribute('data-dsh-theme');
        const beforeDark = body ? body.getAttribute('data-ds-dark-theme') : null;



        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);



        // 主题先落地，舞台/片头/控制条才知道自己该长什么样
        const api = window.__DSH_VELLUM__;
        if (api) api.apply(); else root.setAttribute('data-dsh-theme', 'dark');



        // 片头：暗色播 deepseek-boot 原版（粒子/描线/填充），亮色播线稿版。
        // 一个窗口会话只播一次，切换主题不重播。
        const played = (function () {
          try { return sessionStorage.getItem('dsh-vellum-splash-played') === '1'; } catch (e) { return false; }
        })();
        function playSplash() {
          var api = window.__DSH_VELLUM__;
          var theme = api ? api.get().theme : 'dark';
          try { sessionStorage.setItem('dsh-vellum-splash-played', '1'); } catch (e) {}
          if (theme === 'dark' && window.__DSH_BOOT_SPLASH__) window.__DSH_BOOT_SPLASH__.start();
          else if (window.__DSH_VELLUM_SPLASH_START__) window.__DSH_VELLUM_SPLASH_START__();
        }
        if (!played) {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', playSplash, { once: true });
          } else {
            setTimeout(playSplash, 0);
          }
        }



        const petStart = window.__DSH_VELLUM_PET_START__;
        if (petStart) petStart();

        const control = window.__DSH_VELLUM_CONTROL_START__;
        if (control) control();



        const tag = window.__DSH_VELLUM_LIGHT_TAG_START__;
        if (tag) tag();



        return () => {
          const cancel = window.__DSH_VELLUM_SPLASH_CANCEL__;
          if (cancel) cancel();
          if (window.__DSH_BOOT_SPLASH__) window.__DSH_BOOT_SPLASH__.cancel();
          const petStop = window.__DSH_VELLUM_PET_STOP__;
        if (petStop) petStop();

        const stopControl = window.__DSH_VELLUM_CONTROL_STOP__;
          if (stopControl) stopControl();
          const stopTag = window.__DSH_VELLUM_LIGHT_TAG_STOP__;
          if (stopTag) stopTag();
          const d = window.__DSH_VELLUM_DARK_STAGE__;
          if (d) d.stop();
          const l = window.__DSH_VELLUM_LIGHT_STAGE__;
          if (l) l.stop();
          const s = window.__DSH_SOUND_HOOKS__;
          if (window.__DSH_SOUND_CLEANUP__) window.__DSH_SOUND_CLEANUP__();
          style.remove();
          if (body) {
            if (beforeDark === null) body.removeAttribute('data-ds-dark-theme');
            else body.setAttribute('data-ds-dark-theme', beforeDark);
          }
          if (beforeTheme === null) root.removeAttribute('data-dsh-theme');
          else root.setAttribute('data-dsh-theme', beforeTheme);
        };
      });
    }



    return { apply };
  },
});
`;



await writeFile(join(root, 'client.js'), client, 'utf8');
console.log(`client.js: ${client.length} chars (css ${css.length})`);



/* 预览页：直接看控制条 + 两套主题 */
const design = join(ws, '_design');
if (existsSync(design)) {
  const page = `<!doctype html>
<meta charset="utf-8"><title>vellum merged preview</title>
<style>
  html,body{margin:0;height:100%;font-family:"Segoe UI",system-ui,sans-serif}
  body[data-prev="dark"]{background:#100904;color:#ffedd7}
  body[data-prev="light"]{background:#f5ede2;color:#241a12}
  .wrap{padding:40px 48px;font-size:14px;line-height:1.9;max-width:720px}
  h3{font-weight:500;letter-spacing:.14em;font-size:12px;opacity:.6;margin:0 0 14px}
  .row{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
  .box{padding:12px 16px;border-radius:18px;background:rgba(127,127,127,.12)}
</style>
<script>
  window.__mods = {};
  window.__ModuleLoader__ = { load: function (m) { window.__mods[m.id] = m; } };
  try { sessionStorage.setItem('dsh-vellum-splash-played', '1'); } catch (e) {}
</script>
<body data-prev="dark">
<div class="wrap">
  <h3>VELLUM · 合并版预览</h3>
  <p>右下角是控制条：☾/☀ 切明暗，♪ 开关音效。也可以用 <b>Ctrl+Shift+L</b> / <b>Ctrl+Shift+M</b>。</p>
  <div class="row"><div class="box">主题：<b id="t">dark</b></div><div class="box">音效：<b id="s">on</b></div></div>
  <p>这个页面只是验证控制条与主题切换；皮肤/舞台/片头要在 app 里看。</p>
</div>
<script src="../dsh-plugin-vellum/client.js"></script>
<script>
  var m = window.__mods['dsh-plugin-vellum'];
  if (m) m.factory(function(){ return {}; }).apply({ effect: function(fn){ window.__cleanup = fn(); } });
  document.addEventListener('dsh-vellum-change', function (e) {
    document.body.setAttribute('data-prev', e.detail.theme);
    document.getElementById('t').textContent = e.detail.theme;
    document.getElementById('s').textContent = e.detail.sound ? 'on' : 'off';
  });
</script>
`;
  await writeFile(join(design, 'vellum-preview.html'), page, 'utf8');
  console.log('preview: _design/vellum-preview.html');
}
