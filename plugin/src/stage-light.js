/* ============================================================================
 * VELLUM DAY · 空态舞台逻辑
 * 和暗色版同一套行为：有空态就挂载、点一下开场、有对话就卸载。
 * 差别只有一个：纸面上的"尘埃"是深色微墨点，不是发光余烬，所以不用 lighter 混合。
 * ==========================================================================*/
(function () {
  if (window.__DSH_VELLUM_LIGHT_STAGE__) return;

  var STAGE_ID = 'dsh-vellum-light-stage';
  var ATTR = 'data-dsb-light-stage';
  var state = 'idle';
  var root = null, host = null, canvas = null, ctx2d = null;
  var raf = 0, timer = 0, pieces = [], pointer = { x: -9999, y: -9999 };
  var composerClip = null, cardRef = null, reduced = false;
  var W = 0, H = 0, DPR = 1;

  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }

  var MARKUP = [
    '<div class="lv-paper"></div>',
    '<div class="lv-halo"></div>',
    '<div class="lv-field"></div>',
    '<canvas class="lv-fx"></canvas>',
    '<div class="lv-grain"></div>',
    '<div class="lv-warm"></div>',
    '<div class="lv-mark" aria-hidden="true">',
    '  <span class="lv-ring-base"></span>',
    '  <span class="lv-ring-arc"></span>',
    '  <span class="lv-ring-in"></span>',
    '  <span class="lv-core"></span>',
    '  <span class="lv-sat-a"></span>',
    '  <span class="lv-sat-b"></span>',
    '</div>',
    '<div class="lv-emblem" aria-hidden="true">',
    '  <span class="lv-e-ring"></span><span class="lv-e-core"></span>',
    '</div>',
    '<div class="lv-word">',
    '  <div class="w">DEEPSEEK</div>',
    '  <div class="rule"></div>',
    '  <div class="meta">HARNESS</div>',
    '  <div class="hint"><i></i>CLICK TO BEGIN</div>',
    '</div>',
    '<div class="lv-hit" role="button" tabindex="-1" aria-label="开始输入"></div>'
  ].join('');

  /* 找舞台要盖住的那一块。
   * 优先用 app 自己的空态钩子，找不到就顺着输入卡往上找一个"聊天列尺寸"的祖先，
   * 再找不到就退化成"窗口减去侧栏"的矩形——保证任何版本的 DOM 都能铺上。 */
  var hostIsWindow = false;

  function findHost() {
    var hero = document.querySelector('[class*="composerHero"]');
    var card = document.querySelector('div:has(> div > div > [contenteditable="true"])');
    var start = hero || card;
    if (!start) return null;

    var n = start;
    var best = null;
    var limit = window.innerWidth - 40;
    while (n && n !== document.body) {
      var r = n.getBoundingClientRect();
      if (r.width > 320 && r.height > 300 && r.width < limit) best = n;
      n = n.parentElement;
    }
    return best || null;
  }

  /* 退化的舞台矩形：窗口去掉侧栏和标题栏 */
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

  function findComposerCard() {
    return document.querySelector('div:has(> div > div > [contenteditable="true"])');
  }

  function resizeCanvas(w, h) {
    if (!canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    canvas.width = Math.max(1, Math.round(w * DPR));
    canvas.height = Math.max(1, Math.round(h * DPR));
    ctx2d = canvas.getContext('2d');
    if (ctx2d) ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function hostAlive() {
    if (!host) return false;
    if (!document.contains(host)) return false;
    var r = host.getBoundingClientRect();
    return r.width > 80 && r.height > 120;
  }

  function syncGeometry() {
    if (!root) return;
    var r;
    if (hostAlive()) {
      r = host.getBoundingClientRect();
      if (!r.width || !r.height) r = windowRect();
    } else {
      r = windowRect();
    }
    root.style.left = Math.round(r.left) + 'px';
    root.style.top = Math.round(r.top) + 'px';
    root.style.width = Math.round(r.width) + 'px';
    root.style.height = Math.round(r.height) + 'px';

    var card = findComposerCard();
    var cr = card ? card.getBoundingClientRect() : null;
    if (cr && cr.width > 0) {
      composerClip = { left: cr.left - r.left, top: cr.top - r.top, right: cr.right - r.left, bottom: cr.bottom - r.top };
      root.style.setProperty('--lv-emblem-x', (composerClip.left + composerClip.right) / 2 + 'px');
      root.style.setProperty('--lv-emblem-y', composerClip.top - 34 + 'px');
    } else {
      composerClip = null;
    }
    resizeCanvas(r.width, r.height);
  }

  function spawn() {
    pieces = [];
    var n = Math.round(Math.min(150, (W * H) / 6200));
    for (var i = 0; i < n; i++) {
      pieces.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.4 + Math.random() * 1.3,
        vy: -(0.05 + Math.random() * 0.18),
        sway: Math.random() * Math.PI * 2,
        swaySpd: 0.0016 + Math.random() * 0.005,
        a: 0.05 + Math.random() * 0.18,
        warm: Math.random() > 0.82
      });
    }
  }

  function inComposer(x, y, pad) {
    if (!composerClip) return false;
    return x > composerClip.left - pad && x < composerClip.right + pad &&
           y > composerClip.top - pad && y < composerClip.bottom + pad;
  }

  function draw() {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, W, H);
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

      var alpha = p.a * (1 - calm * 0.45);
      if (inComposer(p.x, p.y, 10)) alpha *= 0.14;
      else if (inComposer(p.x, p.y, 34)) alpha *= 0.5;
      if (alpha <= 0.002) continue;

      var rgb = p.warm ? '192,88,15' : '36,26,18';
      var g = ctx2d.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.8);
      g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx2d.fillStyle = g;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r * 1.8, 0, 6.2832);
      ctx2d.fill();
    }
  }

  function frame() { draw(); raf = requestAnimationFrame(frame); }

  function setState(next) {
    state = next;
    document.documentElement.setAttribute(ATTR, next);
    if (root) root.setAttribute('data-state', next);
  }

  function focusComposer() {
    var editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return;
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

  function open() {
    if (state !== 'idle') return;
    setState('opening');
    window.dispatchEvent(new CustomEvent('dsh-vellum-light-open'));
    setTimeout(function () { setState('open'); focusComposer(); }, 1000);
  }

  function onPointerMove(e) {
    if (!root) return;
    var r = root.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    if (state === 'idle') {
      var mark = root.querySelector('.lv-mark');
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

  function onKeyDown(e) {
    if (state !== 'idle') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.key || e.key.length !== 1) return;
    open();
  }


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
    // 找不到"聊天列"这一层也别放弃：退化成"窗口减去侧栏"，照样把舞台铺上。
    hostIsWindow = !host;

    root = document.createElement('div');
    root.id = STAGE_ID;
    root.innerHTML = MARKUP;
    document.body.appendChild(root);
    document.addEventListener('pointerdown', onDocPointerDown, true);

    canvas = root.querySelector('.lv-fx');
    root.querySelector('.lv-hit').addEventListener('click', open);

    cardRef = findComposerCard();
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('resize', syncGeometry);
    window.addEventListener('keydown', onKeyDown, true);
    pointer.x = -9999; pointer.y = -9999;

    syncGeometry();
    markHero();
    spawn();
    setState('idle');
    if (!reduced) raf = requestAnimationFrame(frame); else draw();
  }

  function unmount() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('resize', syncGeometry);
    window.removeEventListener('keydown', onKeyDown, true);
    unmarkHero();
    root.remove();
    root = null; canvas = null; ctx2d = null; cardRef = null;
    document.documentElement.removeAttribute(ATTR);
    state = 'idle';
  }

  /* 空态判定：优先认 app 的 composerHero；没有就用"有输入卡、聊天流里没有消息"来推断。
   * 这样即使 app 换了类名，舞台也不会哑掉。 */
  /* 空态判定：只看"聊天流里有没有真实消息行"。
     data-dsh-row / data-dsh-msg 由 tag.js 按结构打上（不是类名），
     空态里不会有；有对话时一定有。容器/卡片暂时找不到时一律当空态处理。 */
  function isEmptyState() {
    // 和暗色一模一样的思路：只看"有没有对话内容"，别的一概不看
    if (document.querySelector('[data-dsh-msg]')) return false;
    return true;
  }
  function start() {
    tickLight();
    timer = setInterval(tickLight, 400);

    // 安全兜底：真实 app 里 composerHero 的类名/时序可能和本地模拟不同。
    // 1.5 秒后如果还没挂上、且没有任何消息，就无条件挂上——宁可多显示，不能什么都不显示。
    setTimeout(function () {
      if (root) return;
      if (document.querySelector('[data-dsh-msg]')) return;
      mount();
    }, 1500);
  }

  /* 和暗色完全一致的挂载逻辑：
     有 app 的空态 hero → 挂载（mount 里会把状态设回 idle）
     没有 hero → 撤掉（说明已经在对话里了）
     换工作区时 hero 会短暂消失再出现 → 先卸载再挂载 → 状态自动回到 idle */
  var heroRef = null;

  /* 直接监听"新会话"按钮：不管在哪个工作区，只要点了它，就回到 idle（显示圆环）。
     文字匹配，多语言都覆盖；只在点击的那一刻判断，不轮询、不误伤。 */
  var NEWCHAT_RE = /新会话|新建对话|新的对话|新建会话|New chat|New conversation|New session/i;

  function onDocPointerDown(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button, [role="button"], a, [role="menuitem"], li, div, span');
    if (!btn) return;
    var txt = (btn.textContent || '').trim();
    if (!txt || txt.length > 24) return;
    if (!NEWCHAT_RE.test(txt)) return;
    // 新会话 → 复位到 idle
    if (state !== 'idle') setState('idle');
    if (!root) { try { mount(); } catch (err) {} }
  }

  function tickLight() {
    // 和暗色完全一致：宿主失效就重找，并且把状态复位回 idle
    // （原来这里多了个 host 非空的前提，host 为空时永远不复位，于是卡在 open）
    if (root && !hostAlive()) {
      var h = findHost();
      host = h || null;
      hostIsWindow = !h;
      try { markHero(); } catch (e) {}
      if (state === 'open') setState('idle');
    }
    var hero = document.querySelector('[class*="composerHero"]');
    // 出现"另一个"空态 hero = 换工作区/换会话 → 状态复位回 idle（这是暗色能显示、亮色卡住的关键）
    if (hero && heroRef && hero !== heroRef && (state === 'open' || state === 'opening')) setState('idle');
    if (hero) heroRef = hero;
    if (hero && !root) mount();
    else if (!hero && root) unmount();
    else if (root) {
      var card = findComposerCard();
      if (card && card !== cardRef) cardRef = card;
      syncGeometry();
    }
  }
  function stop() {
    clearInterval(timer);
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    unmount();
  }

  window.__DSH_VELLUM_LIGHT_STAGE__ = { start: start, stop: stop, open: open, state: function () { return state; } };
})();
