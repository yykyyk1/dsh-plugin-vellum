/* ============================================================================
 * VELLUM 空态舞台：环形标志 + 粒子 + 点击开场
 * ----------------------------------------------------------------------------
 * 这一段会被 tools/build.mjs 原样塞进 client.js 的 factory 里，所以不能有
 * import / export，也不能依赖任何外部模块。全部挂在 window.__DSH_VELLUM_HERO__ 上，
 * 方便我在 _skin-lab 里单独注入调试。
 *
 * 生命周期：
 *   有 [class*="composerHero"]（空会话） → 舞台挂载，html[data-dsb-stage="idle"]
 *   用户点画面        → idle → opening → open，输入卡从中心绽放
 *   发出第一条消息     → composerHero 消失 → 舞台卸载、属性清掉
 * ==========================================================================*/
(function () {
  if (window.__DSH_VELLUM_HERO__) return;

  var STAGE_ID = 'dsh-vellum-stage';
  var ATTR = 'data-dsb-stage';
  var state = 'idle';
  var root = null;          // 舞台根节点
  var canvas = null;
  var ctx2d = null;
  var raf = 0;
  var timer = 0;
  var host = null;          // 舞台覆盖的元素（聊天列）
  var pieces = [];
  var pointer = { x: -9999, y: -9999 };
  var composerClip = null;  // 输入卡的屏幕矩形，粒子在这块地面上要让开
  var cardRef = null;       // 当前会话的输入卡节点，用来发现"换会话"
  var reduced = false;
  var W = 0, H = 0, DPR = 1;

  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }

  /* ---------------- 结构 ---------------- */

  var MARKUP = [
    '<div class="vo-paper"></div>',
    '<div class="vo-glow"></div>',
    '<div class="vo-field"></div>',
    '<canvas class="vo-fx"></canvas>',
    '<div class="vo-grain"></div>',
    '<div class="vo-vignette"></div>',
    '<div class="vo-mark" aria-hidden="true">',
    '  <span class="vo-orbit"></span>',
    '  <span class="vo-ring vo-ring-a"></span>',
    '  <span class="vo-ring vo-ring-b"></span>',
    '  <span class="vo-ring-c"></span>',
    '  <span class="vo-core"></span>',
    '  <span class="vo-sat vo-sat-a"></span>',
    '  <span class="vo-sat vo-sat-b"></span>',
    '</div>',
    '<div class="vo-emblem" aria-hidden="true">',
    '  <span class="vo-e-bg"></span><span class="vo-e-ring"></span><span class="vo-e-core"></span>',
    '</div>',
    '<div class="vo-title">',
    '  <div class="vo-word">DEEPSEEK</div>',
    '  <div class="vo-rule"></div>',
    '  <div class="vo-meta">HARNESS</div>',
    '  <div class="vo-hint"><i></i>CLICK TO BEGIN</div>',
    '</div>',
    '<div class="vo-hit" role="button" tabindex="-1" aria-label="开始输入"></div>'
  ].join('');

  /* ---------------- 查找宿主 ---------------- */

  function findHost() {
    var hero = document.querySelector('[class*="composerHero"]');
    if (!hero) return null;
    var seat = hero;
    while (seat && seat !== document.body && !String(seat.className).match(/composerSeat/)) seat = seat.parentElement;
    if (!seat || seat === document.body) {
      // 兜底：往上找一个够大的、带 root 类名的祖先
      var n = hero;
      while (n && n !== document.body) {
        if (String(n.className).match(/_root/) && n.getBoundingClientRect().height > 300) { seat = n; break; }
        n = n.parentElement;
      }
    }
    if (!seat) return null;
    var up = seat;
    while (up && up !== document.body && !String(up.className).match(/_root/)) up = up.parentElement;
    return up && up !== document.body ? up : seat.parentElement || seat;
  }

  function findComposerCard() {
    return document.querySelector('div:has(> div > div > [contenteditable="true"])');
  }


  /* 宿主失效兜底：换工作区之后 app 会把聊天区整块重建，
     原来抓到的 host 就变成游离节点（rect 全是 0），舞台就"什么都不显示"。
     这里检测到失效就重新找，找不到就退化成"窗口减去侧栏"。 */
  var hostIsWindow = false;

  function windowRect() {
    var side = document.querySelector('[role="tree"], [class*="sidebar"], [class*="Sidebar"]');
    var left = 0;
    if (side) {
      var sr = side.getBoundingClientRect();
      if (sr.width > 120 && sr.width < 420) left = sr.right;
    }
    var top = 40;
    var bar = document.querySelector('[data-windows-titlebar], [class*="titlebar"]');
    if (bar) {
      var br = bar.getBoundingClientRect();
      if (br.height > 20 && br.height < 80) top = br.height;
    }
    return { left: left, top: top, width: window.innerWidth - left, height: window.innerHeight - top };
  }

  function hostAlive() {
    if (!host) return false;
    if (!document.contains(host)) return false;
    var r = host.getBoundingClientRect();
    return r.width > 80 && r.height > 120;
  }
  function syncGeometry() {
    if (!root) return;
    var r = hostAlive() ? host.getBoundingClientRect() : windowRect();
    root.style.left = Math.round(r.left) + 'px';
    root.style.top = Math.round(r.top) + 'px';
    root.style.width = Math.round(r.width) + 'px';
    root.style.height = Math.round(r.height) + 'px';

    var card = findComposerCard();
    var cr = card ? card.getBoundingClientRect() : null;
    if (cr && cr.width > 0) {
      composerClip = { left: cr.left - r.left, top: cr.top - r.top, right: cr.right - r.left, bottom: cr.bottom - r.top };
      // 小徽标悬在输入卡上方一点
      root.style.setProperty('--vo-emblem-x', (composerClip.left + composerClip.right) / 2 + 'px');
      root.style.setProperty('--vo-emblem-y', composerClip.top - 34 + 'px');
    } else {
      composerClip = null;
    }
    resizeCanvas(r.width, r.height);
  }

  /* ---------------- 粒子 ---------------- */

  function resizeCanvas(w, h) {
    if (!canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx2d = canvas.getContext('2d');
    if (ctx2d) ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn() {
    pieces = [];
    var n = Math.round(Math.min(150, (W * H) / 6000));
    for (var i = 0; i < n; i++) {
      var warm = Math.random();
      pieces.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.4 + Math.random() * 1.5,
        vy: -(0.05 + Math.random() * 0.18),
        sway: Math.random() * Math.PI * 2,
        swaySpd: 0.0016 + Math.random() * 0.005,
        a: 0.05 + Math.random() * 0.42,
        warm: warm > 0.74
      });
    }
  }

  function inComposer(x, y, pad) {
    if (!composerClip) return false;
    return x > composerClip.left - pad && x < composerClip.right + pad &&
           y > composerClip.top - pad && y < composerClip.bottom + pad;
  }

  function drawParticles() {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, W, H);
    ctx2d.globalCompositeOperation = 'lighter';
    var calm = state === 'idle' ? 0 : 1;
    var speed = 1 - calm * 0.62;
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      p.sway += p.swaySpd * speed;
      p.y += p.vy * speed;
      p.x += Math.sin(p.sway) * 0.22 * speed;

      var dx = p.x - pointer.x, dy = p.y - pointer.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < 18000) {
        var f = (18000 - d2) / 18000;
        var d = Math.sqrt(d2) + 0.001;
        p.x += (dx / d) * f * 2.2;
        p.y += (dy / d) * f * 2.2;
      }

      if (p.y < -24) { p.y = H + 24; p.x = Math.random() * W; }
      if (p.x < -24) p.x = W + 24;
      if (p.x > W + 24) p.x = -24;

      // 输入卡下面不让粒子穿过去（画布在卡片上方，这里抠个软洞）
      var alpha = p.a * (1 - calm * 0.45);
      if (inComposer(p.x, p.y, 10)) alpha *= 0.12;
      else if (inComposer(p.x, p.y, 34)) alpha *= 0.5;
      if (alpha <= 0.002) continue;

      var hue = p.warm ? '255,160,0' : '255,237,215';
      var g = ctx2d.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, 'rgba(' + hue + ',' + alpha + ')');
      g.addColorStop(1, 'rgba(' + hue + ',0)');
      ctx2d.fillStyle = g;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r * 5, 0, 6.2832);
      ctx2d.fill();
    }
  }

  function frame() {
    drawParticles();
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- 状态 ---------------- */

  function setState(next) {
    state = next;
    document.documentElement.setAttribute(ATTR, next);
    if (root) root.setAttribute('data-state', next);
  }

  function focusComposer() {
    var editable = document.querySelector('[contenteditable="true"]');
    if (editable) {
      try { editable.focus(); } catch (e) {}
      var sel = window.getSelection && window.getSelection();
      if (sel) {
        try {
          var range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
      }
    }
  }

  function open() {
    if (state !== 'idle') return;
    setState('opening');
    setTimeout(function () {
      setState('open');
      focusComposer();
    }, 1000);
  }

  /* ---------------- 挂载 / 卸载 ---------------- */


  /* 空态里除了输入卡之外的东西（标题、工作区行、"预览版"徽标……）按结构隐藏：
     从输入卡往上走三层，凡是"同层兄弟又不包含输入卡"的节点，一律标 data-dsh-hide。
     这样不依赖 app 的类名，换构建也不会露出来。 */
  function markHero() {
    var card = findComposerCard();
    if (!card) return;
    var n = card;
    for (var depth = 0; depth < 3 && n && n !== document.body; depth++) {
      var parent = n.parentElement;
      if (!parent) break;
      for (var i = 0; i < parent.children.length; i++) {
        var k = parent.children[i];
        if (k === n || k.contains(card)) continue;
        if (k.id && k.id.indexOf('dsh-vellum') === 0) continue;   // 别把自己的舞台/控制条/桌宠藏了
        var r = k.getBoundingClientRect();
        if (r.height < 4 && r.width < 4) continue;
        if (k.querySelector && k.querySelector('[data-chat-flow]')) continue;
        k.setAttribute('data-dsh-hide', '');
      }
      n = parent;
    }
  }

  function unmarkHero() {
    var els = document.querySelectorAll('[data-dsh-hide]');
    for (var i = 0; i < els.length; i++) els[i].removeAttribute('data-dsh-hide');
  }
  function mount() {
    if (root) return;
    host = findHost();
    if (!host) return;

    root = document.createElement('div');
    root.id = STAGE_ID;
    root.innerHTML = MARKUP;
    document.body.appendChild(root);

    canvas = root.querySelector('.vo-fx');
    var hit = root.querySelector('.vo-hit');
    hit.addEventListener('click', open);

    cardRef = findComposerCard();
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('resize', syncGeometry);
    window.addEventListener('keydown', onKeyDown, true);
    onPointerMove({ clientX: -9999, clientY: -9999 });

    syncGeometry();
    markHero();
    spawn();
    setState('idle');

    if (!reduced) raf = requestAnimationFrame(frame);
    else drawParticles();
  }

  function unmount() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('resize', syncGeometry);
    window.removeEventListener('keydown', onKeyDown, true);
    cardRef = null;
    unmarkHero();
    root.remove();
    root = null; canvas = null; ctx2d = null;
    document.documentElement.removeAttribute(ATTR);
    state = 'idle';
  }

  function onPointerMove(e) {
    if (!root) return;
    var r = root.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    if (state === 'idle') {
      var mark = root.querySelector('.vo-mark');
      if (mark) {
        var mx = (pointer.x - r.width / 2) / r.width;
        var my = (pointer.y - r.height / 2) / r.height;
        if (Math.abs(mx) < 1 && Math.abs(my) < 1) {
          mark.style.transform = 'translate(-50%,-50%) translate(' + (mx * 14).toFixed(1) + 'px,' +
            (my * 10).toFixed(1) + 'px) rotate(' + (mx * 2.2).toFixed(2) + 'deg)';
        }
      }
    }
  }

  // 舞台上直接敲字也开场：字符跟着进输入框
  function onKeyDown(e) {
    if (state !== 'idle') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.key || e.key.length !== 1) return;
    open();
  }

  /* ---------------- 守望空态 ---------------- */

  function tick() {
    // 换工作区会重建 DOM：宿主没了就重找，找不到就用窗口兜底
    if (root && !hostAlive()) {
      var h = findHost();
      host = h || null;
      hostIsWindow = !h;
      try { markHero(); } catch (e) {}
      if (state === 'open') setState('idle');
    }
    var hero = document.querySelector('[class*="composerHero"]');
    if (hero && !root) mount();
    else if (!hero && root) unmount();
    else if (root) {
      // 输入卡节点变了只更新引用，不要复位状态。
      // 焦点变化会让 app 换一次节点，复位就会把"刚点开"打回首页 —— 表现为
      // 第一次点击后又弹回舞台、必须再点一次才能输入。
      var card = findComposerCard();
      if (card && card !== cardRef) cardRef = card;
      syncGeometry();
    }
  }

  function start() {
    tick();
    timer = setInterval(tick, 400);
  }

  function stop() {
    clearInterval(timer);
    unmount();
  }

  window.__DSH_VELLUM_HERO__ = { start: start, stop: stop, open: open, state: function () { return state; } };
})();
