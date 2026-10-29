/* ============================================================================
 * ORYZO DAY · 结构标记
 * ----------------------------------------------------------------------------
 * 问题：这个 app 的类名会随构建变，靠 [class*="_presented"] 这种猜法经常打空。
 * 做法：不猜类名，用「几何 + 文本」找出真正的那几块，给它们打上 data-*，
 *       CSS 只认这些属性：
 *         data-dsh-canvas   聊天画布（包含输入卡、高度过半屏的那个祖先）
 *         data-dsh-card     附件 / 交付物卡（一行里带 xxx.zip 这类文件名的框）
 *         data-dsh-msg      消息气泡容器（可选，取 userRow 的近似）
 *
 * 同时留一个自检：3 秒后如果一张卡都没标到，在左下角显示一个很小的计数标签，
 * 让"到底有没有标到"这件事可以直接被看见。
 * ==========================================================================*/
(function () {
  if (window.__DSH_ORYZO_LIGHT_TAG__) return;
  window.__DSH_ORYZO_LIGHT_TAG__ = true;

  var FILE_RE = /\.(zip|rar|7z|png|jpe?g|gif|webp|svg|pdf|md|txt|json|js|mjs|ts|tsx|css|html|docx?|xlsx?|pptx?|csv|log)$/i;
  var timer = 0;
  var badge = null;

  function climb(el, max) {
    var n = el;
    for (var i = 0; i < max && n && n !== document.body; i++) n = n.parentElement;
    return n;
  }

  function composerCard() {
    return document.querySelector('div:has(> div > div > [contenteditable="true"])');
  }

  function tagCanvas() {
    var card = composerCard();
    if (!card) return false;
    var n = card, best = null;
    while (n && n !== document.body) {
      var r = n.getBoundingClientRect();
      if (r.height > window.innerHeight * 0.5 && r.width > window.innerWidth * 0.4) best = n;
      n = n.parentElement;
    }
    if (!best) return false;
    best.setAttribute('data-dsh-canvas', '');
    return true;
  }

  function looksLikeFileRow(el) {
    if (!el || el.children.length > 4) return false;
    var txt = (el.textContent || '').trim();
    if (txt.length < 4 || txt.length > 120) return false;
    var first = txt.split('\n')[0].trim();
    return FILE_RE.test(first);
  }

  function tagCards() {
    var found = 0;
    var nodes = document.querySelectorAll('div, span, p, a, li');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute('data-dsh-card')) { found++; continue; }
      if (!looksLikeFileRow(el)) continue;

      // 往上找 1~4 层里最像"卡片"的那个：够宽、有边框或底色
      var box = null;
      var n = el;
      for (var k = 0; k < 4 && n && n !== document.body; k++, n = n.parentElement) {
        var cs = getComputedStyle(n);
        var r = n.getBoundingClientRect();
        var hasEdge = cs.borderTopWidth !== '0px' || cs.borderBottomWidth !== '0px' ||
                      (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)');
        if (r.width > 180 && r.height > 24 && hasEdge) box = n;
      }
      if (box) { box.setAttribute('data-dsh-card', ''); found++; }
    }
    return found;
  }

  function tagMessages() {
    // 用户消息：右侧那种"自己一列"的容器，靠 aria/结构不好认，用几何：宽 < 70% 且靠右
    var bubbles = document.querySelectorAll('[role="listitem"], [data-testid*="message"], [class*="userRow"], [class*="message"]');
    for (var i = 0; i < bubbles.length; i++) {
      var el = bubbles[i];
      if (el.hasAttribute('data-dsh-msg')) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || r.height < 20) continue;
      if (r.width < window.innerWidth * 0.72 && r.right > window.innerWidth * 0.62) {
        el.setAttribute('data-dsh-msg', '');
      }
    }
  }

  function showBadge(cards, canvas) {
    if (badge) badge.remove();
    badge = document.createElement('div');
    badge.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483000',
      'padding:5px 9px', 'border-radius:999px',
      'background:#f5ede2', 'color:#8c7a64',
      'border:1px solid rgba(36,26,18,.14)',
      'font:11px/1.2 ui-monospace,Consolas,monospace',
      'pointer-events:none', 'transition:opacity .4s', 'opacity:.9'
    ].join(';');
    badge.textContent = 'oryzo-light v1.2.0 · cards:' + cards + ' canvas:' + (canvas ? 1 : 0);
    document.body.appendChild(badge);
    setTimeout(function () { if (badge) { badge.style.opacity = '0'; } }, 6000);
    setTimeout(function () { if (badge) { badge.remove(); badge = null; } }, 6800);
  }


  /* 侧栏行：按"在侧栏范围内 + 够宽够高 + 有自己的底色 + 圆角≈0"找出来，
     不依赖类名。找到就打 data-dsh-row，CSS 统一上圆角。 */
  function tagRows() {
    var side = document.querySelector('[role="tree"], [class*="sidebar"], [class*="Sidebar"]');
    if (!side) return 0;
    var r = side.getBoundingClientRect();
    var els = side.querySelectorAll('*');
    var count = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-dsh-row')) { count++; continue; }
      var rc = el.getBoundingClientRect();
      if (rc.width < 140 || rc.height < 22 || rc.height > 60) continue;
      if (rc.left < r.left - 6 || rc.right > r.right + 6) continue;
      var cs = getComputedStyle(el);
      var bg = cs.backgroundColor;
      var hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      var radius = parseFloat(cs.borderTopLeftRadius) || 0;
      if (hasBg && radius < 4) { el.setAttribute('data-dsh-row', ''); count++; }
    }
    return count;
  }

  /* 侧栏面板：大块容器（高 >150 或 几乎满宽）且有自己的底色 → data-dsh-panel，
     CSS 把它刷成透明，露出侧栏本身的颜色，和外面统一。行（data-dsh-row）除外。 */
  function tagPanels() {
    var side = document.querySelector('[role="tree"], [class*="sidebar"], [class*="Sidebar"]');
    if (!side) return 0;
    var r = side.getBoundingClientRect();
    var els = side.querySelectorAll('*');
    var count = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-dsh-panel')) { count++; continue; }
      if (el.hasAttribute('data-dsh-row')) continue;
      if (el.closest && el.closest('[data-dsh-row]')) continue;
      var cs = getComputedStyle(el);
      var bg = cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
      var rc = el.getBoundingClientRect();
      if (!rc.width || !rc.height) continue;
      var isPanel = rc.height > 150 || (rc.width >= r.width - 24 && rc.height > 40);
      if (isPanel) { el.setAttribute('data-dsh-panel', ''); count++; }
    }
    return count;
  }

  /* 对比度兜底：找出"底色和主题明显打架"的大块，打 data-dsh-fix。
     暗色里出现浅底（lum>0.4）、亮色里出现深底（lum<0.2）都要拉回来。 */
  function fixContrast() {
    var dark = (document.documentElement.getAttribute('data-dsh-theme') || 'dark') === 'dark';
    var els = document.querySelectorAll('[data-chat-flow] *');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-dsh-fix')) continue;
      var cs = getComputedStyle(el);
      var bg = cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)') continue;
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
      if (!m) continue;
      var lum = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
      var r = el.getBoundingClientRect();
      if (r.width * r.height < 6000) continue;
      if (dark && lum > 0.4) el.setAttribute('data-dsh-fix', 'dark');
      else if (!dark && lum < 0.2) el.setAttribute('data-dsh-fix', 'light');
    }
  }
  function pass(showDiag) {
    if (document.getElementById('dsh-oryzo-light-splash')) return;   // 片头期间不动
    var canvas = tagCanvas();
    var cards = tagCards();
    tagRows();
    tagPanels();
    fixContrast();
    tagMessages();
    if (showDiag && cards === 0 && document.querySelector('[data-chat-flow], [class*="composer"]')) {
      showBadge(cards, canvas);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { pass(false); }, 260);
  }

  function start() {
    pass(true);
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(document.body, { childList: true, subtree: true });
      window.__DSH_ORYZO_LIGHT_TAG_MO__ = mo;
    } catch (e) {}
    window.addEventListener('resize', schedule);
  }

  function stop() {
    clearTimeout(timer);
    if (window.__DSH_ORYZO_LIGHT_TAG_MO__) { window.__DSH_ORYZO_LIGHT_TAG_MO__.disconnect(); window.__DSH_ORYZO_LIGHT_TAG_MO__ = null; }
    window.removeEventListener('resize', schedule);
    if (badge) { badge.remove(); badge = null; }
    document.querySelectorAll('[data-dsh-canvas],[data-dsh-card],[data-dsh-msg]').forEach(function (n) {
      n.removeAttribute('data-dsh-canvas');
      n.removeAttribute('data-dsh-card');
      n.removeAttribute('data-dsh-msg');
      n.removeAttribute('data-dsh-row');
      n.removeAttribute('data-dsh-panel');
    });
    window.__DSH_ORYZO_LIGHT_TAG__ = false;
  }

  window.__DSH_ORYZO_LIGHT_TAG_START__ = start;
  window.__DSH_ORYZO_LIGHT_TAG_STOP__ = stop;
})();
