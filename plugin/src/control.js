/* ============================================================================
 * VELLUM · 控制条
 * 右下角一枚胶囊：☾/☀ 切换明暗，♪ 开关音效。
 * 快捷键：Ctrl+Shift+L 明暗 · Ctrl+Shift+M 音效。
 * ==========================================================================*/
(function () {
  if (window.__DSH_VELLUM_CONTROL__) return;
  window.__DSH_VELLUM_CONTROL__ = true;

  var bar = null;

  function build() {
    if (bar) return bar;
    var api = window.__DSH_VELLUM__;
    if (!api) return null;

    bar = document.createElement('div');
    bar.id = 'dsh-vellum-control';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'VELLUM 外观');

    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'or-btn or-theme';
    themeBtn.title = '切换明暗（Ctrl+Shift+L）';

    var soundBtn = document.createElement('button');
    soundBtn.type = 'button';
    soundBtn.className = 'or-btn or-sound';
    soundBtn.title = '开关音效（Ctrl+Shift+M）';

    bar.appendChild(themeBtn);
    bar.appendChild(soundBtn);
    document.body.appendChild(bar);

    themeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      api.toggleTheme();
    });
    soundBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var s = api.toggleSound();
      if (s.sound) { try { window.__DSH_SOUND__ && window.__DSH_SOUND__.play('click'); } catch (err) {} }
    });

    render();
    return bar;
  }

  function render() {
    var api = window.__DSH_VELLUM__;
    if (!api || !bar) return;
    var s = api.get();
    var themeBtn = bar.querySelector('.or-theme');
    var soundBtn = bar.querySelector('.or-sound');
    if (themeBtn) {
      themeBtn.innerHTML = s.theme === 'dark'
        ? '<span class="or-ico">☾</span><span class="or-txt">暗</span>'
        : '<span class="or-ico">☀</span><span class="or-txt">亮</span>';
      themeBtn.setAttribute('aria-pressed', s.theme === 'light' ? 'true' : 'false');
    }
    if (soundBtn) {
      soundBtn.innerHTML = s.sound
        ? '<span class="or-ico">♪</span><span class="or-txt">开</span>'
        : '<span class="or-ico">♪</span><span class="or-txt">关</span>';
      soundBtn.setAttribute('aria-pressed', s.sound ? 'true' : 'false');
      soundBtn.classList.toggle('is-off', !s.sound);
    }
  }

  document.addEventListener('dsh-vellum-change', render);

  window.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || !e.shiftKey) return;
    var k = (e.key || '').toLowerCase();
    var api = window.__DSH_VELLUM__;
    if (!api) return;
    if (k === 'l') { e.preventDefault(); api.toggleTheme(); }
    if (k === 'm') { e.preventDefault(); api.toggleSound(); }
  }, true);

  window.__DSH_VELLUM_CONTROL_START__ = function () { build(); };
  window.__DSH_VELLUM_CONTROL_STOP__ = function () {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    window.__DSH_VELLUM_CONTROL__ = false;
  };
})();
