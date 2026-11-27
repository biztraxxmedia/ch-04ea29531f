/* Holo: projected Cephalon hologram orbs on <canvas>. No libraries.
   Holo.create(canvas, themeName) -> { setState('idle'|'thinking'|'talking'), setLevel(0..1), destroy() }
   Holo.attachAudio(audioEl, orb) drives orb.setLevel from the audio's real loudness (WebAudio analyser). */
(function () {
  "use strict";
  const THEMES = {
    hyperion: { rim: [255, 40, 36], accent: [255, 206, 26], core: [10, 0, 0], glow: [255, 60, 40], beam: [255, 70, 50],
      rings: 2, poly: true, aurora: false, signal: false, spin: 0.35 },
    iris: { rim: [150, 255, 175], accent: [210, 255, 225], core: [0, 20, 12], glow: [110, 255, 160], beam: [140, 255, 190],
      rings: 1, poly: false, aurora: true, signal: false, spin: 0.22, auroraCols: [[120, 255, 160], [190, 255, 210], [90, 220, 255], [170, 140, 255]] },
    hermes: { rim: [255, 205, 90], accent: [255, 250, 235], core: [16, 10, 0], glow: [255, 210, 110], beam: [255, 225, 150],
      rings: 3, poly: false, aurora: false, signal: true, spin: 0.9 },
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const TAU = Math.PI * 2;
  // icosahedron for the Cephalon core
  const P = (1 + Math.sqrt(5)) / 2;
  const ICO_V = [[-1, P, 0], [1, P, 0], [-1, -P, 0], [1, -P, 0], [0, -1, P], [0, 1, P], [0, -1, -P], [0, 1, -P], [P, 0, -1], [P, 0, 1], [-P, 0, -1], [-P, 0, 1]]
    .map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
  const ICO_E = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    const d = Math.hypot(ICO_V[i][0] - ICO_V[j][0], ICO_V[i][1] - ICO_V[j][1], ICO_V[i][2] - ICO_V[j][2]);
    if (d < 1.1) ICO_E.push([i, j]);
  }
  function rot(v, ax, ay) {
    let [x, y, z] = v;
    let c = Math.cos(ay), s = Math.sin(ay); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(ax); s = Math.sin(ax); [y, z] = [y * c - z * s, y * s + z * c];
    return [x, y, z];
  }

  const live = new Set();
  let raf = 0;
  function loop(t) {
    live.forEach(o => o._frame(t / 1000));
    raf = live.size ? requestAnimationFrame(loop) : 0;
  }

  function create(canvas, themeName, opts) {
    const theme = THEMES[themeName] || THEMES.hyperion;
    const o = opts || {};
    const ctx = canvas.getContext("2d");
    const buf = document.createElement("canvas");
    const b = buf.getContext("2d");
    let W = 0, H = 0, dpr = 1, state = "idle", level = 0, target = 0, visible = true;
    let glitchUntil = 0, nextGlitch = 2, flick = 1;
    const motes = Array.from({ length: 26 }, () => ({ x: Math.random() * 2 - 1, y: Math.random(), s: 0.3 + Math.random() * 0.7 }));
    const pulses = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
      canvas.width = buf.width = W; canvas.height = buf.height = H;
    }
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(canvas);

    function drawScene(t) {
      const busy = state === "thinking", talk = state === "talking";
      const S = Math.min(W, H / 1.28);
      const cx = W / 2, baseY = H * 0.9, cy = H * 0.42;
      const breathe = Math.sin(t * 1.6) * 0.012;
      const R = S * 0.33 * (1 + breathe + level * 0.13);
      b.clearRect(0, 0, W, H);
      b.globalCompositeOperation = "lighter";

      // projector beam (cone from emitter to orb)
      const bw = S * 0.11, tw = R * 1.15;
      const g = b.createLinearGradient(0, baseY, 0, cy - R * 0.2);
      g.addColorStop(0, rgba(theme.beam, 0.38 * flick));
      g.addColorStop(0.55, rgba(theme.beam, 0.12 * flick));
      g.addColorStop(1, rgba(theme.beam, 0));
      b.fillStyle = g;
      b.beginPath(); b.moveTo(cx - bw, baseY); b.lineTo(cx - tw, cy); b.lineTo(cx + tw, cy); b.lineTo(cx + bw, baseY); b.closePath(); b.fill();
      // streaks in the beam
      for (let i = 0; i < 7; i++) {
        const f = (i / 6) * 2 - 1, a = 0.05 + 0.05 * Math.sin(t * 3 + i * 1.7);
        b.strokeStyle = rgba(theme.beam, a); b.lineWidth = dpr;
        b.beginPath(); b.moveTo(cx + f * bw * 0.8, baseY); b.lineTo(cx + f * tw * 0.9, cy + R * 0.3); b.stroke();
      }
      // rising motes
      motes.forEach(m => {
        m.y += (0.0025 + (busy ? 0.004 : 0) + level * 0.006) * m.s; if (m.y > 1) { m.y = 0; m.x = Math.random() * 2 - 1; }
        const y = baseY - m.y * (baseY - cy), w = bw + (tw - bw) * m.y;
        b.fillStyle = rgba(theme.accent, 0.5 * (1 - m.y) * m.s);
        b.fillRect(cx + m.x * w * 0.8, y, 1.6 * dpr, 1.6 * dpr);
      });

      // orb volume: see-through centre, glowing fresnel rim
      b.globalCompositeOperation = "source-over";
      const core = b.createRadialGradient(cx, cy, 0, cx, cy, R);
      core.addColorStop(0, rgba(theme.core, 0.55)); core.addColorStop(0.7, rgba(theme.core, 0.35)); core.addColorStop(1, rgba(theme.core, 0));
      b.fillStyle = core; b.beginPath(); b.arc(cx, cy, R, 0, TAU); b.fill();
      b.globalCompositeOperation = "lighter";
      const rim = b.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.02);
      rim.addColorStop(0, rgba(theme.rim, 0));
      rim.addColorStop(0.78, rgba(theme.rim, 0.10 + level * 0.15));
      rim.addColorStop(0.96, rgba(theme.rim, 0.55 + level * 0.35));
      rim.addColorStop(1, rgba(theme.rim, 0));
      b.fillStyle = rim; b.beginPath(); b.arc(cx, cy, R * 1.02, 0, TAU); b.fill();
      // outer halo
      const halo = b.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.6);
      halo.addColorStop(0, rgba(theme.glow, 0.16 + level * 0.25)); halo.addColorStop(1, rgba(theme.glow, 0));
      b.fillStyle = halo; b.beginPath(); b.arc(cx, cy, R * 1.6, 0, TAU); b.fill();

      const spin = t * theme.spin * (busy ? 2.6 : 1) * (talk ? 1.4 : 1);
      // wireframe globe
      b.lineWidth = Math.max(1, dpr * 0.9);
      for (let i = 0; i < 6; i++) {
        const ph = spin + (i / 6) * Math.PI;
        const rx = Math.abs(Math.cos(ph)) * R * 0.98;
        b.strokeStyle = rgba(theme.rim, 0.10 + 0.12 * Math.abs(Math.sin(ph)));
        b.beginPath(); b.ellipse(cx, cy, rx, R * 0.98, 0, 0, TAU); b.stroke();
      }
      for (let i = 1; i < 6; i++) {
        const yy = (i / 6) * 2 - 1, rr = Math.sqrt(1 - yy * yy) * R * 0.98;
        b.strokeStyle = rgba(theme.rim, 0.10);
        b.beginPath(); b.ellipse(cx, cy + yy * R * 0.98, rr, rr * 0.18, 0, 0, TAU); b.stroke();
      }

      if (theme.aurora) { // aurora ribbons, light green at the heart
        theme.auroraCols.forEach((c, k) => {
          b.beginPath();
          for (let x = -1; x <= 1.001; x += 0.04) {
            const y = Math.sin(x * 2.6 + t * (0.7 + k * 0.23) + k) * 0.22 + Math.sin(x * 5 - t * 1.1 + k) * 0.06 + (k - 1.5) * 0.13;
            const px = cx + x * R * Math.sqrt(Math.max(0, 1 - y * y)) * 0.92, py = cy + y * R;
            x === -1 ? b.moveTo(px, py) : b.lineTo(px, py);
          }
          b.strokeStyle = rgba(c, k === 0 ? 0.55 + level * 0.3 : 0.28 + level * 0.2);
          b.lineWidth = R * (k === 0 ? 0.12 : 0.07) * (1 + level * 0.6);
          b.lineCap = "round"; b.stroke();
        });
        const heart = b.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
        heart.addColorStop(0, rgba([200, 255, 215], 0.45 + level * 0.4)); heart.addColorStop(1, rgba([120, 255, 170], 0));
        b.fillStyle = heart; b.beginPath(); b.arc(cx, cy, R * 0.55, 0, TAU); b.fill();
      }

      if (theme.poly) { // Cephalon core: black faceted shell, red edges, yellow vertices
        const ax = 0.5 + Math.sin(t * 0.4) * 0.3, ay = spin * 1.3;
        const pr = R * (0.46 + level * 0.12);
        const pts = ICO_V.map(v => rot(v, ax, ay));
        b.globalCompositeOperation = "source-over";
        b.fillStyle = "rgba(0,0,0,0.55)"; b.beginPath(); b.arc(cx, cy, pr * 0.95, 0, TAU); b.fill();
        b.globalCompositeOperation = "lighter";
        ICO_E.forEach(([i, j]) => {
          const zf = (pts[i][2] + pts[j][2]) / 2;
          b.strokeStyle = rgba(theme.rim, 0.25 + 0.45 * (zf + 1) / 2 + level * 0.3);
          b.lineWidth = Math.max(1, dpr * (1 + zf * 0.6));
          b.beginPath(); b.moveTo(cx + pts[i][0] * pr, cy + pts[i][1] * pr); b.lineTo(cx + pts[j][0] * pr, cy + pts[j][1] * pr); b.stroke();
        });
        pts.forEach(p => { if (p[2] > -0.2) { b.fillStyle = rgba(theme.accent, 0.5 + p[2] * 0.4 + level * 0.3); b.beginPath(); b.arc(cx + p[0] * pr, cy + p[1] * pr, dpr * (1.6 + p[2]), 0, TAU); b.fill(); } });
        // eye: yellow slit that widens when he speaks
        const ew = pr * 0.55, eh = pr * (0.06 + level * 0.22 + (busy ? 0.04 * Math.sin(t * 9) : 0));
        const eg = b.createRadialGradient(cx, cy, 0, cx, cy, ew);
        eg.addColorStop(0, rgba(theme.accent, 0.95)); eg.addColorStop(0.5, rgba(theme.rim, 0.55)); eg.addColorStop(1, rgba(theme.rim, 0));
        b.fillStyle = eg; b.beginPath(); b.ellipse(cx, cy, ew, Math.max(eh, dpr), 0, 0, TAU); b.fill();
      }

      if (!theme.poly && !theme.aurora) { // Hermes: bright quick core
        const hc = b.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
        hc.addColorStop(0, rgba(theme.accent, 0.85)); hc.addColorStop(0.4, rgba(theme.rim, 0.4 + level * 0.3)); hc.addColorStop(1, rgba(theme.rim, 0));
        b.fillStyle = hc; b.beginPath(); b.arc(cx, cy, R * (0.42 + level * 0.15), 0, TAU); b.fill();
      }

      // orbit rings
      for (let k = 0; k < theme.rings; k++) {
        const tilt = 0.28 + k * 0.5, a0 = spin * (1.6 + k * 0.7) + k;
        b.save(); b.translate(cx, cy); b.rotate(tilt * (k % 2 ? -1 : 1));
        b.strokeStyle = rgba(k ? theme.rim : theme.accent, 0.35 + level * 0.3); b.lineWidth = Math.max(1, dpr * 1.2);
        b.beginPath(); b.ellipse(0, 0, R * (1.22 + k * 0.1), R * 0.2, 0, a0, a0 + Math.PI * 1.3); b.stroke();
        const dx = Math.cos(a0 + Math.PI * 1.3) * R * (1.22 + k * 0.1), dy = Math.sin(a0 + Math.PI * 1.3) * R * 0.2;
        b.fillStyle = rgba(theme.accent, 0.9); b.beginPath(); b.arc(dx, dy, dpr * 2.2, 0, TAU); b.fill();
        b.restore();
      }
      // thinking: orbiting data ticks
      if (busy) for (let i = 0; i < 12; i++) {
        const a = t * 3 + (i / 12) * TAU, r2 = R * 1.08;
        b.fillStyle = rgba(theme.accent, 0.3 + 0.6 * ((i + Math.floor(t * 12)) % 12 === 0));
        b.fillRect(cx + Math.cos(a) * r2 - dpr, cy + Math.sin(a) * r2 - dpr, dpr * 2.5, dpr * 2.5);
      }
      // voice pulses (signal rings)
      if ((talk && level > 0.35 && Math.random() < 0.12) || (theme.signal && Math.random() < 0.02)) pulses.push({ r: R, a: 0.5 });
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]; p.r += S * 0.006; p.a -= 0.012;
        if (p.a <= 0) { pulses.splice(i, 1); continue; }
        b.strokeStyle = rgba(theme.rim, p.a); b.lineWidth = dpr; b.beginPath(); b.arc(cx, cy, p.r, 0, TAU); b.stroke();
      }

      // projector base: dark disc with glowing emitter ring
      b.globalCompositeOperation = "source-over";
      const bx = S * 0.2, by = S * 0.045;
      const metal = b.createLinearGradient(0, baseY - by, 0, baseY + by * 2.4);
      metal.addColorStop(0, "#202024"); metal.addColorStop(1, "#050506");
      b.fillStyle = metal; b.beginPath(); b.ellipse(cx, baseY + by * 0.9, bx * 1.05, by * 1.5, 0, 0, TAU); b.fill();
      b.globalCompositeOperation = "lighter";
      b.strokeStyle = rgba(theme.rim, 0.75 * flick + level * 0.2); b.lineWidth = dpr * 2;
      b.beginPath(); b.ellipse(cx, baseY, bx * 0.62, by * 0.7, 0, 0, TAU); b.stroke();
      const emit = b.createRadialGradient(cx, baseY, 0, cx, baseY, bx * 0.7);
      emit.addColorStop(0, rgba(theme.accent, 0.8 * flick)); emit.addColorStop(0.35, rgba(theme.glow, 0.35 * flick)); emit.addColorStop(1, rgba(theme.glow, 0));
      b.fillStyle = emit; b.beginPath(); b.ellipse(cx, baseY, bx * 0.7, by * 1.1, 0, 0, TAU); b.fill();
      for (let i = 0; i < 10; i++) {
        const a = t * 0.8 + (i / 10) * TAU, s = Math.sin(a);
        b.fillStyle = rgba(i % 3 ? theme.rim : theme.accent, 0.4 + 0.5 * (s > 0));
        b.fillRect(cx + Math.cos(a) * bx * 0.85 - dpr, baseY + by * 0.9 + s * by * 1.1, dpr * 2, dpr * 2);
      }
      return { cx, cy, R, top: cy - R * 1.7, bottom: baseY + by * 2.5 };
    }

    function frame(t) {
      if (!visible || !W) return;
      level += (target - level) * 0.25;
      target *= 0.92;
      // flicker: mostly steady, rare dips
      flick = 0.9 + Math.random() * 0.1;
      if (Math.random() < (state === "thinking" ? 0.03 : 0.008)) flick = 0.45 + Math.random() * 0.3;
      if (t > nextGlitch) { glitchUntil = t + 0.08 + Math.random() * 0.12; nextGlitch = t + (state === "thinking" ? 0.8 : 2.5) + Math.random() * 4; }
      const box = drawScene(t);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 0.86 + flick * 0.14;
      if (t < glitchUntil) { // horizontal slice tearing
        const n = 6, sh = H / n;
        for (let i = 0; i < n; i++) {
          const off = (Math.random() < 0.4 ? (Math.random() - 0.5) * W * 0.04 : 0);
          ctx.drawImage(buf, 0, i * sh, W, sh, off, i * sh, W, sh);
        }
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25; // chromatic ghost
        ctx.drawImage(buf, W * 0.006, 0); ctx.globalCompositeOperation = "source-over";
      } else ctx.drawImage(buf, 0, 0);
      ctx.globalAlpha = 1;
      // scanlines: cut thin transparent lines through the projection, plus a slow bright sweep
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      const step = Math.max(3, Math.round(3 * dpr)), off = Math.floor((t * 30) % step);
      for (let y = Math.max(0, Math.floor(box.top)) + off; y < box.bottom; y += step) ctx.fillRect(0, y, W, Math.max(1, dpr * 0.9));
      ctx.globalCompositeOperation = "lighter";
      const sweep = box.top + ((t * 0.35) % 1) * (box.bottom - box.top);
      ctx.save();
      ctx.beginPath(); ctx.arc(box.cx, box.cy, box.R * 1.04, 0, TAU); ctx.clip();  // sweep only inside the projection
      const sg = ctx.createLinearGradient(0, sweep - 18 * dpr, 0, sweep + 18 * dpr);
      sg.addColorStop(0, rgba(theme.rim, 0)); sg.addColorStop(0.5, rgba(theme.rim, 0.14)); sg.addColorStop(1, rgba(theme.rim, 0));
      ctx.fillStyle = sg; ctx.fillRect(box.cx - box.R * 1.1, sweep - 18 * dpr, box.R * 2.2, 36 * dpr);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }

    const api = {
      theme: themeName,
      _frame: frame,
      setState(s) { state = s || "idle"; canvas.dataset.state = state; },
      setLevel(v) { target = Math.max(target, Math.min(1, v)); },
      get state() { return state; },
      destroy() { live.delete(api); ro.disconnect(); io.disconnect(); },
    };
    api.setState(o.state || "idle");
    live.add(api);
    if (!raf) raf = requestAnimationFrame(loop);
    return api;
  }

  // Real voice level from an <audio> element.
  let actx = null;
  const wired = new WeakMap();
  function attachAudio(audio, orb) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      let node = wired.get(audio);
      if (!node) {
        const src = actx.createMediaElementSource(audio);
        const an = actx.createAnalyser(); an.fftSize = 1024;
        src.connect(an); an.connect(actx.destination);
        node = { an, data: new Float32Array(an.fftSize), orb: null };
        wired.set(audio, node);
        const tick = () => {
          if (!audio.paused && !audio.ended && node.orb) {
            an.getFloatTimeDomainData(node.data);
            let s = 0; for (let i = 0; i < node.data.length; i++) s += node.data[i] * node.data[i];
            const rms = Math.sqrt(s / node.data.length);
            node.orb.setLevel(Math.min(1, rms * 5.5));
            window.__holoLevel = rms;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      node.orb = orb;
      return true;
    } catch (e) {
      console.warn("audio analyser unavailable", e);
      return false;
    }
  }

  window.Holo = { create, attachAudio, THEMES };
})();
