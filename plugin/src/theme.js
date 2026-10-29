/* ============================================================================
 * VELLUM · 主题与开关（合并版）
 * ----------------------------------------------------------------------------
 * 一个插件里装两套皮肤：暗房 / 暖纸。
 *   html[data-dsh-theme="dark"]   → 暗色皮肤 + 暗色舞台
 *   html[data-dsh-theme="light"]  → 暖纸皮肤 + 浅色舞台
 * 切换是即时的：换属性 → CSS 变量与规则全部重算；舞台换成对应的那一套。
 * 选择记在 localStorage，下次启动沿用。
 * ==========================================================================*/
(function () {
  if (window.__DSH_VELLUM__) return;

  var KEY_THEME = 'dsh-vellum-theme';
  var KEY_SOUND = 'dsh-vellum-sound';
  var state = { theme: 'dark', sound: true };

  try {
    var t = localStorage.getItem(KEY_THEME);
    if (t === 'dark' || t === 'light') state.theme = t;
    state.sound = localStorage.getItem(KEY_SOUND) !== '0';
  } catch (e) {}

  function body() { return document.body || null; }

  function applyStage() {
    var dark = window.__DSH_VELLUM_DARK_STAGE__;
    var light = window.__DSH_VELLUM_LIGHT_STAGE__;
    try {
      if (state.theme === 'dark') {
        if (light) light.stop();
        if (dark) dark.start();
      } else {
        if (dark) dark.stop();
        if (light) light.start();
      }
    } catch (e) {}
  }

  function applySound() {
    // 诊断：这一版到底用的是 VS Code 原声，还是退回合成音
    try {
      var vs = window.__DSH_VS_AUDIO__ || {};
      var n = Object.keys(vs).length;
      if (!window.__DSH_VELLUM_AUDIO_LOGGED__) {
        window.__DSH_VELLUM_AUDIO_LOGGED__ = true;
        console.log('[vellum] 音效来源: ' + (n ? ('VS Code 原声 ' + n + ' 个') : '合成音（没找到内联素材）'));
      }
    } catch (e) {}
    var s = window.__DSH_SOUND__;
    if (!s) return;
    try { state.sound ? s.unmute() : s.mute(); } catch (e) {}
  }

  function apply(attrs) {
    var root = document.documentElement;
    var b = body();
    root.setAttribute('data-dsh-theme', state.theme);
    if (b) {
      if (state.theme === 'dark') b.setAttribute('data-ds-dark-theme', '');
      else b.removeAttribute('data-ds-dark-theme');
    }
    if (attrs !== false) applyStage();
    applySound();
    document.dispatchEvent(new CustomEvent('dsh-vellum-change', {
      detail: { theme: state.theme, sound: state.sound }
    }));
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY_THEME, state.theme);
      localStorage.setItem(KEY_SOUND, state.sound ? '1' : '0');
    } catch (e) {}
  }

  var api = {
    get: function () { return { theme: state.theme, sound: state.sound }; },
    setTheme: function (v) {
      state.theme = v === 'light' ? 'light' : 'dark';
      save(); return apply();
    },
    toggleTheme: function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      save(); return apply();
    },
    setSound: function (on) { state.sound = !!on; save(); return apply(false); },
    toggleSound: function () { state.sound = !state.sound; save(); return apply(false); },
    apply: function () { return apply(true); }
  };

  window.__DSH_VELLUM__ = api;
})();
