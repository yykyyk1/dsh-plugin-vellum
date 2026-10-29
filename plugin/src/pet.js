/* ORYZO · 桌宠（预渲染视频，不占用 GPU 3D 渲染）
 * 平时循环待机，生成中（think）循环跳舞，结束回待机。
 * 素材：Blender 从 lowpoly_trump_dance.glb 离线渲染的透明 WebM
 *   idle  6.71s / 161 帧 / 24fps
 *   dance 3.38s /  81 帧 / 24fps
 */
(function () {
  if (window.__DSH_ORYZO_PET__) return;
  window.__DSH_ORYZO_PET__ = true;

  var host = null, video = null, thinking = false, reduce = false;
  var timer = 0;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function src(name) {
    var p = window.__DSH_PET__ || {};
    var b64 = p[name];
    return b64 ? ('data:video/webm;base64,' + b64) : '';
  }

  function build() {
    if (host) return;
    if (!src('idle')) { console.warn('[oryzo] 桌宠素材缺失'); return; }

    host = document.createElement('div');
    host.id = 'dsh-oryzo-pet';
    host.setAttribute('data-mode', 'idle');
    host.title = 'DEEPSEEK';

    var bubble = document.createElement('div');
    bubble.className = 'pet-bubble';
    bubble.textContent = '···';

    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.loop = true;
    video.autoplay = !reduce;
    video.preload = 'auto';
    video.src = src('idle');
    video.addEventListener('ended', function () { if (!thinking) playIdle(); });

    host.appendChild(video);
    host.appendChild(bubble);
    document.body.appendChild(host);
    if (!reduce) { try { video.play(); } catch (e) {} }
  }

  function playIdle() {
    if (!video) return;
    video.loop = true;
    if (video.getAttribute('src') !== src('idle')) video.src = src('idle');
    if (!reduce) { try { video.play(); } catch (e) {} }
    if (host) host.setAttribute('data-mode', 'idle');
  }

  function playDance() {
    if (!video) return;
    video.loop = true;                 // 思考期间一直循环
    if (video.getAttribute('src') !== src('dance')) video.src = src('dance');
    if (!reduce) { try { video.play(); } catch (e) {} }
    if (host) host.setAttribute('data-mode', 'thinking');
  }

  function isThinking() {
    var els = document.querySelectorAll('[class*="runningText"], [class*="runningDivider"], [class*="runningWhale"]');
    for (var i = 0; i < els.length; i++) if (els[i].getClientRects().length) return true;
    return false;
  }

  function tick() {
    var now = isThinking();
    if (now === thinking) return;
    thinking = now;
    if (now) playDance(); else playIdle();
  }

  function start() {
    if (timer || host) return;
    build();
    timer = setInterval(tick, 400);
  }

  function stop() {
    clearInterval(timer); timer = 0;
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; video = null; thinking = false;
    window.__DSH_ORYZO_PET__ = false;
  }

  window.__DSH_ORYZO_PET_START__ = start;
  window.__DSH_ORYZO_PET_STOP__ = stop;
})();