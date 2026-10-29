/* ============================================================================
 * VELLUM · 片头时间轴
 * ----------------------------------------------------------------------------
 * 0.15  墨线开始描（2.4s）
 * 2.15  琥珀光沿线扫过
 * 2.40  （暗色）填成实体，线退到后面
 * 3.25  标题起来
 * 5.80  收场
 * 6.70  移除
 * 点击 / Esc / 空格 / 回车 立即收。
 * 每个窗口会话只播一次（sessionStorage）。
 * ==========================================================================*/
(function () {
  if (window.__DSH_VELLUM_SPLASH__) return;
  window.__DSH_VELLUM_SPLASH__ = true;

  var KEY = 'dsh-vellum-splash-played';
  var forced = window.__DSH_VELLUM_SPLASH_FORCE__ === true ||
    /(?:^|[#&])splash(?:[=&]|$)/.test(location.hash);
  if (!forced) {
    try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}
  }

  var NS = 'http://www.w3.org/2000/svg';
  var D = window.__DSH_WHALE_D__ || '';
  var host = null, timers = [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function path(cls, d) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', d);
    return p;
  }
  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
  }
  function teardown() {
    clearAll();
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', cancel, true);
  }
  function cancel() {
    if (!host) return;
    host.style.transition = 'opacity .35s ease';
    host.style.opacity = '0';
    setTimeout(teardown, 380);
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') cancel();
  }

  function dust(c) {
    var r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var light = document.documentElement.getAttribute('data-dsh-theme') === 'light';
    var rgb = light ? '36,26,18' : '255,237,215';
    var warm = light ? '192,88,15' : '255,160,0';
    var n = Math.round(Math.min(160, (r.width * r.height) / 6000));
    for (var i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + (Math.random() > 0.82 ? warm : rgb) + ',' + (0.06 + Math.random() * 0.24) + ')';
      ctx.arc(Math.random() * r.width, Math.random() * r.height, 0.4 + Math.random() * 1.3, 0, 6.2832);
      ctx.fill();
    }
  }

  function start() {
    if (host) return;
    if (!D) return;
    var parent = document.body || document.documentElement;
    if (!parent) { setTimeout(start, 20); return; }

    var light = document.documentElement.getAttribute('data-dsh-theme') === 'light';

    host = el('div', '');
    host.id = 'dsh-vellum-splash';

    var glow = el('div', 'sp-glow');
    host.appendChild(glow);

    // 0.74s 那一下：墨点爆散（对应暗色的 burst）
    host.appendChild(el('div', 'sp-burst'));

    var fx = document.createElement('canvas');
    fx.className = 'sp-fx';
    host.appendChild(fx);

    var wrap = el('div', 'sp-whale');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '70 118 392 296');
    var fill = path('sp-fill', D);
    var line = path('sp-line', D);
    var rim = path('sp-rim', D);
    svg.appendChild(fill);
    svg.appendChild(line);
    svg.appendChild(rim);
    wrap.appendChild(svg);
    host.appendChild(wrap);

    var cap = el('div', 'sp-cap');

    var kick = el('div', 'sp-kick');
    var kickLetters = 'DEEPSEEK'.split('').map(function (ch) {
      var s = el('span', '', ch);
      kick.appendChild(s);
      return s;
    });
    cap.appendChild(kick);

    var wm = el('div', 'sp-wm');
    var wmLetters = 'DeepSeek'.split('').map(function (ch) {
      var i = el('i', '', ch);
      wm.appendChild(i);
      return i;
    });
    cap.appendChild(wm);

    var rule = el('div', 'sp-rule');
    rule.appendChild(el('i'));
    cap.appendChild(rule);

    var sub = el('div', 'sp-sub');
    var subParts = [];
    ['深度求索', 'HARNESS'].forEach(function (text, idx) {
      if (idx > 0) sub.appendChild(el('em', '', '·'));
      var s = el('span', '', text);
      sub.appendChild(s);
      subParts.push(s);
    });
    cap.appendChild(sub);
    host.appendChild(cap);

    host.appendChild(el('div', 'sp-skip', '按 Esc 跳过'));
    host.appendChild(el('div', 'sp-grain'));
    parent.appendChild(host);

    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    dust(fx);

    var len = 0;
    try { len = line.getTotalLength ? line.getTotalLength() : 0; } catch (e) { len = 0; }

    var reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', cancel, true);

    if (reduce || !len) {
      line.style.strokeDasharray = 'none';
      if (!light) fill.style.opacity = '1';
      cap.style.opacity = '1';
      timers.push(setTimeout(teardown, 2600));
      return;
    }

    /* ---------- 时间轴：和暗色（deepseek-boot）逐拍对齐 ----------
     *   0.15  起笔
     *   0.74  墨点爆散（对应暗色的 burst）
     *   1.40–3.30  描线（drawStart 1400 / drawDur 1900）
     *   3.02  "收笔"——线稿短促提亮一次（替代暗色的填充 thump）
     *   3.96–4.86  琥珀光扫过（sheenStart 3960 / sheenDur 900）
     *   3.98  标题（titleStart 3980）
     *   6.32  收拢（outroStart 6320）
     *   7.28  移除（total 7280）
     */
    var T = { burst: 740, drawStart: 1400, drawDur: 1900, settle: 3020, sheen: 3960, sheenDur: 900, title: 3980, outro: 6320, outroDur: 900, total: 7280 };
    var EASE_OUT = 'cubic-bezier(.33,1,.68,1)';
    var EASE_INOUT = 'cubic-bezier(.65,0,.35,1)';

    // 起笔：0.15s 开始，1.40s 才进入主描线（前面这段是"蓄"）
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    line.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: T.drawDur, delay: T.drawStart, easing: 'cubic-bezier(.55,.05,.35,1)', fill: 'forwards' }
    );

    // 0.74 墨点爆散
    timers.push(setTimeout(function () {
      var b = host && host.querySelector('.sp-burst');
      if (b) {
        b.animate([
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' },
          { opacity: .55, offset: .25, transform: 'translate(-50%,-50%) scale(.7)' },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }
        ], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
      }
    }, T.burst));

    // 琥珀光：3.96 起，扫一遍
    var seg = 120;
    rim.style.strokeDasharray = seg + ' ' + (len + seg);
    rim.style.strokeDashoffset = String(len);
    timers.push(setTimeout(function () {
      rim.animate(
        [{ opacity: 0, strokeDashoffset: len }, { opacity: .95, offset: .12 },
         { opacity: .95, offset: .82 }, { opacity: 0, strokeDashoffset: -seg }],
        { duration: T.sheenDur, easing: 'linear', fill: 'forwards' }
      );
    }, T.sheen));

    // 3.02 收笔：线稿提亮一下（亮色没有填充，用这个"拍子"顶上）
    timers.push(setTimeout(function () {
      if (light) {
        line.animate([
          { strokeWidth: '2.4px', opacity: 1 },
          { strokeWidth: '3.6px', opacity: 1, offset: .35 },
          { strokeWidth: '2.4px', opacity: 1 }
        ], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
      } else {
        fill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
        line.animate([{ opacity: 1 }, { opacity: .35 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
      }
    }, T.settle));

    // 3.98 标题：kicker 逐字 → wordmark 逐字（带模糊）→ 横线 → 副标题
    timers.push(setTimeout(function () {
      cap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' });

      kickLetters.forEach(function (s, i) {
        s.animate([
          { opacity: 0, transform: 'translateY(7px)' },
          { opacity: 0.92, transform: 'translateY(0px)' }
        ], { duration: 520, delay: i * 40, easing: EASE_OUT, fill: 'forwards' });
      });

      wmLetters.forEach(function (s, i) {
        s.animate([
          { opacity: 0, transform: 'translateY(16px)', filter: 'blur(5px)' },
          { opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }
        ], { duration: 720, delay: 70 + i * 58, easing: EASE_OUT, fill: 'forwards' });
      });

      rule.firstElementChild.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 820, delay: 600, easing: EASE_INOUT, fill: 'forwards' }
      );

      subParts.forEach(function (s) {
        s.animate([
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0px)' }
        ], { duration: 900, delay: 880, easing: EASE_OUT, fill: 'forwards' });
      });
    }, T.title));

    // 6.32 收拢，7.28 移除
    timers.push(setTimeout(function () {
      if (!host) return;
      host.style.transition = 'opacity ' + T.outroDur + 'ms ease';
      host.style.opacity = '0';
      timers.push(setTimeout(teardown, T.outroDur + 60));
    }, T.outro));  }

  window.__DSH_VELLUM_SPLASH_START__ = start;
  window.__DSH_VELLUM_SPLASH_CANCEL__ = cancel;
})();
