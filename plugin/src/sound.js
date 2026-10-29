/* ============================================================================
 * DSH 音效引擎（全部合成，不带音频文件）
 * ----------------------------------------------------------------------------
 * 用途：片头、开场、点击、发送、思考中。
 * 设计约束：
 *  - 不打包任何 mp3/wav，全部 WebAudio 现场合成，体积 0；
 *  - 音量偏小但听得清：母线上压限 + 轻微补偿，叠音不爆；
 *  - 合成一小段卷积混响（IR），声音有空间感；
 *  - 点击走"上滑的玻璃音"而不是干涩的咔哒声（sci-fi 一点）；
 *  - 静音开关存 localStorage，快捷键 Ctrl+Shift+M。
 * ==========================================================================*/
(function () {
  if (window.__DSH_SOUND__) return;

  var MUTE_KEY = 'dsh-sound-muted';
  var MASTER = 0.85;      // 母线
  var VOL = 1.3;          // 用户音量倍数（默认 1.3，localStorage 可覆盖）
  var MAKEUP = 1.3;       // 压限之后的补偿，把整体响度提上来

  var ctx = null;
  var master = null;
  var finalNode = null;
  var muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
    var v = parseFloat(localStorage.getItem('dsh-sound-vol'));
    if (v > 0 && v <= 4) VOL = v;
  } catch (e) {}

  /* ---------------- 图 ---------------- */

  function buildGraph(c) {
    var m = c.createGain();
    m.gain.value = muted ? 0 : MASTER * VOL;

    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 18;
    comp.ratio.value = 4.5;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;

    var makeup = c.createGain();
    makeup.gain.value = MAKEUP;

    var dry = c.createGain();
    dry.gain.value = 0.82;
    var wet = c.createGain();
    wet.gain.value = 0.32;

    var conv = c.createConvolver();
    conv.buffer = makeImpulse(c, 1.6, 2.6);

    m.connect(dry).connect(comp);
    m.connect(conv).connect(wet).connect(comp);
    comp.connect(makeup).connect(c.destination);
    finalNode = makeup;

    return m;
  }

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = buildGraph(ctx);
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function makeImpulse(c, seconds, decay) {
    var rate = c.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = c.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        // 前 8ms 留一点预延迟，避免糊在干声上
        var pre = i < rate * 0.008 ? 0.15 : 1;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * pre;
      }
    }
    return buf;
  }

  function noiseBuffer(c, seconds) {
    var len = Math.max(1, Math.floor(c.sampleRate * seconds));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 声像：让叠出来的音有一点宽度，不那么"正中间一根线"
  function panned(c, node, pan) {
    if (!pan) return node;
    var p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    return p;
  }

  /* ---------------- 基础音色 ---------------- */

  // 正弦 / 滑音：sub 脉冲、thump、上滑的玻璃音
  function tone(dest, when, o) {
    var c = ctx;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, when);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), when + o.dur);

    var peak = o.gain === undefined ? 0.2 : o.gain;
    var attack = o.attack === undefined ? 0.006 : o.attack;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);

    var out = g;
    if (o.lp) {
      var f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = 0.7;
      osc.connect(f).connect(g);
    } else {
      osc.connect(g);
    }
    var tail = panned(c, g, o.pan);
    if (tail !== g) tail.connect(dest); else g.connect(dest);
    osc.start(when);
    osc.stop(when + o.dur + 0.02);
    return osc;
  }

  // 噪声：click 的"嘶"、burst 的气流、gather 的沙沙
  function noise(dest, when, o) {
    var c = ctx;
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c, Math.max(0.05, o.dur + 0.02));
    var f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.Q.value = o.q === undefined ? 1.1 : o.q;
    f.frequency.setValueAtTime(o.f0, when);
    if (o.f1 && o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), when + o.dur);

    var g = c.createGain();
    var peak = o.gain === undefined ? 0.12 : o.gain;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);

    src.connect(f).connect(g);
    var tail = panned(c, g, o.pan);
    if (tail !== g) tail.connect(dest); else g.connect(dest);
    src.start(when);
    src.stop(when + o.dur + 0.02);
  }

  // 铃：基音 + 三个泛音，指数衰减，带一点玻璃感
  function bell(dest, when, o) {
    var f = o.freq;
    var g0 = o.gain === undefined ? 0.08 : o.gain;
    var dur = o.dur || 1.2;
    var pan = o.pan || 0;
    [[1, 1], [2.01, 0.5], [2.99, 0.26], [4.2, 0.12]].forEach(function (h, i) {
      tone(dest, when, {
        type: 'sine',
        f0: f * h[0],
        f1: f * h[0],
        dur: dur / (1 + (h[0] - 1) * 0.22),
        gain: g0 * h[1],
        attack: 0.004,
        pan: pan * (i % 2 ? -1 : 1)
      });
    });
  }

  /* ---------------- 配方 ---------------- */

  /* ---------------- 音色：木琴 ----------------
   * VS Code 那套信号的性格是"木琴式上行短跑"：起音软、衰减快、泛音少。
   * 这里用 1 / 2.01 / 3.0 / 4.2 四个正弦泛音合成，跟它同一族。 */
  function marimba(dest, when, freq, gain, dur, pan) {
    var parts = [[1, 1.0], [2.01, 0.30], [3.0, 0.13], [4.2, 0.06]];
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i][0];
      tone(dest, when, {
        type: 'sine',
        f0: freq * m,
        f1: freq * m,
        dur: dur / (1 + (m - 1) * 0.35),
        gain: gain * parts[i][1],
        attack: 0.004,
        pan: pan || 0
      });
    }
  }

  // 一串音符：[[相对时间秒, 频率Hz, 力度], ...]
  function run(dest, when, notes, dur, pan) {
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      marimba(dest, when + n[0], n[1], n[2], dur || 0.32, (pan || 0) + (i % 2 ? 0.06 : -0.06));
    }
  }

  /* ---------------- 配方（按 VS Code 的语境对应） ----------------
   *   click   单击                — 我们自己的最小交互音
   *   open    空态开场             — 三音上行
   *   send    发送请求             ↔ requestSent（低频滚动 + 快速点击）
   *   think   思考中（循环）        ↔ progress（471/542/814/600/814）
   *   response 回答到达            ↔ responseReceived（485→471→300）
   *   ask     需要你操作           ↔ chatUserActionRequired（871→700→700）
   *   done    任务完成             ↔ taskCompleted（128→185→242→314→514→771→1042）
   */
  function playCue(name, at) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t = at === undefined ? c.currentTime + 0.01 : at;

    // 直接用 VS Code 自带的声音（除了片头）
    if (name !== 'splash' && (window.__DSH_VS_AUDIO__ || {})[name]) { playFile(name); return; }

    if (name === 'click') {
      marimba(master, t, 471, 0.20, 0.20, -0.04);
      return;
    }

    if (name === 'open') {
      run(master, t, [[0, 471, 0.18], [0.055, 560, 0.15], [0.115, 660, 0.13]], 0.34);
      return;
    }

    if (name === 'send') {
      // requestSent：先一声低频，再 4 下快速点击（贴着 0.33~0.41 那个位置）
      tone(master, t, { f0: 128, f1: 118, dur: 0.30, gain: 0.16, attack: 0.01, lp: 260 });
      run(master, t + 0.10, [[0, 128, 0.10], [0.21, 471, 0.10], [0.235, 542, 0.10],
                             [0.26, 600, 0.10], [0.285, 660, 0.09]], 0.18);
      return;
    }

    if (name === 'think') {
      // progress：5 音上行短跑，间隔 70/60/90/70ms
      run(master, t, [
        [0.00, 471, 0.16], [0.07, 542, 0.15], [0.13, 814, 0.14],
        [0.22, 600, 0.14], [0.29, 814, 0.13]
      ], 0.30);
      return;
    }

    if (name === 'response') {
      run(master, t, [[0.00, 485, 0.16], [0.03, 471, 0.14], [0.05, 300, 0.12]], 0.55);
      return;
    }

    if (name === 'ask') {
      run(master, t, [[0.00, 871, 0.17], [0.10, 700, 0.14], [0.13, 700, 0.11]], 0.35);
      return;
    }

    if (name === 'done') {
      // taskCompleted：一路往上爬
      run(master, t, [
        [0.00, 128, 0.12], [0.07, 185, 0.12], [0.13, 242, 0.12], [0.18, 314, 0.12],
        [0.21, 314, 0.10], [0.29, 514, 0.12], [0.37, 771, 0.12], [0.40, 1042, 0.11]
      ], 0.42);
      return;
    }

    if (name === 'splash') {
      // 原版：和 deepseek-boot 的时间轴一一对应
      tone(master, t + 0.02, { f0: 55, f1: 42, dur: 0.9, gain: 0.32, attack: 0.03 });          // 0.0 脉冲
      noise(master, t + 0.74, { dur: 0.55, f0: 260, f1: 3400, q: 0.7, gain: 0.13, attack: 0.02, pan: 0.1 });   // 0.74 爆散
      noise(master, t + 1.33, { dur: 1.5, f0: 520, f1: 220, q: 0.6, gain: 0.075, attack: 0.4, pan: -0.1 });     // 1.33 汇聚
      tone(master, t + 3.02, { f0: 74, f1: 62, dur: 0.42, gain: 0.26, attack: 0.008 });          // 3.02 填充
      tone(master, t + 3.02, { f0: 148, f1: 124, dur: 0.3, gain: 0.1, attack: 0.008 });
      bell(master, t + 3.96, { freq: 880, gain: 0.075, dur: 1.7, pan: -0.2 });                    // 3.96 高光
      bell(master, t + 4.08, { freq: 1174, gain: 0.055, dur: 1.5, pan: 0.2 });
      bell(master, t + 4.2, { freq: 1568, gain: 0.035, dur: 1.3, pan: -0.1 });
      // 4.02 标题：暖三和弦慢慢起来
      [[220, 0.085], [330, 0.062], [440, 0.045]].forEach(function (ch, i) {
        tone(master, t + 4.02 + i * 0.03, { type: 'triangle', f0: ch[0], f1: ch[0], dur: 2.2, gain: ch[1], attack: 0.9, lp: 950 });
      });
      bell(master, t + 6.3, { freq: 659, gain: 0.045, dur: 1.2 });                                // 6.3 收拢
      return;
    }
  }
  /* ---------------- 原声播放（VS Code 自带的 mp3，构建时内联成 base64） ----------------
   * 解码一次缓存起来；播放走 master，所以静音开关和音量倍数照样生效。 */
  var vsBuffers = {};
  var vsLoading = {};

  function b64ToArrayBuffer(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function playFile(name) {
    var c = ensure();
    if (!c) return;
    var src = (window.__DSH_VS_AUDIO__ || {})[name];
    if (!src) return;

    if (vsBuffers[name]) { startBuffer(vsBuffers[name]); return; }
    if (vsLoading[name]) return;
    vsLoading[name] = true;

    var raw = src.indexOf(',') >= 0 ? src.slice(src.indexOf(',') + 1) : src;
    var buf = b64ToArrayBuffer(raw);
    var done = function (audioBuf) {
      vsBuffers[name] = audioBuf;
      vsLoading[name] = false;
      startBuffer(audioBuf);
    };
    try {
      var pr = c.decodeAudioData(buf, done, function () { vsLoading[name] = false; });
      if (pr && pr.then) pr.then(done).catch(function () { vsLoading[name] = false; });
    } catch (e) { vsLoading[name] = false; }
  }

  function startBuffer(audioBuf) {
    var c = ensure();
    if (!c) return;
    var s = c.createBufferSource();
    s.buffer = audioBuf;
    s.connect(master);
    s.start(c.currentTime + 0.005);
  }
  /* ---------------- 调试：离线渲染一条音，量一下电平 ---------------- */

  function renderOffline(name, seconds) {
    var AC = window.OfflineAudioContext;
    if (!AC) return Promise.reject(new Error('no OfflineAudioContext'));
    var c = new AC(2, Math.ceil(44100 * seconds), 44100);
    var savedCtx = ctx, savedMaster = master;
    ctx = c;
    master = buildGraph(c);
    muted = false;
    playCue(name, 0.02);
    var renderCtx = c;
    ctx = savedCtx;
    master = savedMaster;
    return renderCtx.startRendering().then(function (buf) {
      var peak = 0, sum = 0, n = 0;
      for (var ch = 0; ch < buf.numberOfChannels; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < d.length; i++) {
          var v = Math.abs(d[i]);
          if (v > peak) peak = v;
          sum += v * v; n++;
        }
      }
      return { name: name, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(4) };
    });
  }

  /* ---------------- 静音 ---------------- */

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER * VOL, ctx.currentTime, 0.05);
  }

  window.__DSH_SOUND__ = {
    play: playCue,
    mute: function () { setMuted(true); },
    unmute: function () { setMuted(false); },
    toggle: function () { setMuted(!muted); return muted; },
    muted: function () { return muted; },
    renderOffline: renderOffline,
    state: function () { return ctx ? ctx.state : 'none'; },
    volume: function (v) {
      if (v === undefined) return VOL;
      VOL = Math.max(0.2, Math.min(4, Number(v) || 1));
      try { localStorage.setItem('dsh-sound-vol', String(VOL)); } catch (e) {}
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER * VOL, ctx.currentTime, 0.05);
      return VOL;
    },
    debug: function () { return { ctx: ctx, master: master, out: finalNode, muted: muted }; }
  };
})();
