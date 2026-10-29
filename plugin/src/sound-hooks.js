/* ============================================================================
 * 把音效挂到真实事件上
 * ----------------------------------------------------------------------------
 *  片头    出现 #dsh-splash-host 时播一次（和片头同一条时间轴）
 *  开场    点空态舞台（#dsh-oryzo-stage 的命中层）
 *  发送    输入框里回车，或点发送键
 *  思考中  聊天流里出现「生成中」时循环一层很轻的垫音，结束后收掉
 *  Ctrl+Shift+M  静音开关
 * ==========================================================================*/
(function () {
  if (window.__DSH_SOUND_HOOKS__) return;
  window.__DSH_SOUND_HOOKS__ = true;

  var S = window.__DSH_SOUND__;
  if (!S) return;

  var THINK_EVERY = 1600;   // progress 一条 1.08s，1.6s 循环刚好
  var thinkTimer = 0;
  var thinkOn = false;
  var lastSend = 0;

  /* ---------- 自动播放策略：第一次手势时把 context 唤醒 ---------- */
  function wake() {
    if (S.state() === 'suspended') {
      try { S.play('click'); } catch (e) {}
    }
  }
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);

  /* ---------- 片头 ---------- */
  var splashSeen = false;
  function checkSplash() {
    if (splashSeen) return;
    // 三种片头都认：原版 boot 片头 / 合并版线稿片头 / 旧的独立插件
    if (!document.getElementById('dsh-boot-host') &&
        !document.getElementById('dsh-oryzo-splash') &&
        !document.getElementById('dsh-splash-host')) return;
    splashSeen = true;
    S.play('splash');
  }

  /* ---------- 开场 / 点击 ---------- */
  window.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // 空态舞台：整块画面点击 → 开场音（暗色/亮色两套舞台都要）
    if (t.closest('#dsh-oryzo-stage .vo-hit') || t.closest('#dsh-oryzo-light-stage')) { S.play('open'); return; }

    // 发送键（app 的输入卡里那颗）：类名带 send 的按钮/元素
    var sendBtn = t.closest('[class*="send"], button[type="submit"]');
    if (sendBtn && t.closest('div:has(> div > div > [contenteditable="true"])')) {
      fireSend();
      return;
    }

    // 输入卡里的其它按钮（+ / 工作区 / 模型）：很轻的一下
    if (t.closest('div:has(> div > div > [contenteditable="true"]) button')) S.play('click');
  }, true);

  /* ---------- 回车发送 ---------- */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      var el = e.target;
      if (el && el.getAttribute && el.getAttribute('contenteditable') === 'true') fireSend();
    }
  }, true);

  function fireSend() {
    var now = Date.now();
    if (now - lastSend < 320) return;   // 回车 + 点按钮可能连着来
    lastSend = now;
    S.play('send');
  }

  /* ---------- 思考中 ---------- */
  function thinkingVisible() {
    // 生成中的几块标记：runningDivider / runningText / runningWhale
    return !!document.querySelector('[class*="runningText"], [class*="runningDivider"], [class*="runningWhale"]');
  }

  function startThink() {
    if (thinkOn) return;
    thinkOn = true;
    S.play('think');
    thinkTimer = setInterval(function () { S.play('think'); }, THINK_EVERY);
  }

  function stopThink() {
    if (!thinkOn) return;
    thinkOn = false;
    clearInterval(thinkTimer);
    thinkTimer = 0;
    S.play('response');   // 回答到了
  }

  /* ---------- 静音快捷键 ---------- */
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      var m = S.toggle();
      if (!m) S.play('click');
      e.preventDefault();
    }
  }, true);

  /* ---------- 片头：立刻发现（Observer），思考中：轻轮询 ---------- */
  var tick = 0;
  var mo = null;
  try {
    mo = new MutationObserver(checkSplash);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { mo = null; }
  checkSplash();

  /* 需要你操作：出现模态对话框 / 授权按钮时响一下 */
  var askSeen = false;
  function checkAsk() {
    var dlg = document.querySelector('[role="dialog"][aria-modal="true"], [aria-modal="true"]');
    var btn = Array.prototype.some.call(document.querySelectorAll('button'), function (b) {
      return /允许|批准|同意|Approve|Allow/.test((b.textContent || '').trim());
    });
    var on = !!(dlg || btn);
    if (on && !askSeen) { askSeen = true; S.play('ask'); }
    else if (!on) askSeen = false;
  }

  function thinkLoop() {
    if (thinkingVisible()) startThink(); else stopThink();
    checkAsk();
  }
  thinkLoop();
  tick = setInterval(thinkLoop, 350);

  /* ---------- 清理（插件卸载 / HMR） ---------- */
  window.__DSH_SOUND_CLEANUP__ = function () {
    clearInterval(tick);
    stopThink();
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
    window.__DSH_SOUND_HOOKS__ = false;
  };
})();
