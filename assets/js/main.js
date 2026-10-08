/* Sainjal Poly — Portfolio v3: "a software engineer's digital universe".
   GSAP + ScrollTrigger + Lenis, canvas and SVG. Progressive: without JS or with
   reduced motion every section is still readable and the interactive pieces still work. */
(() => {
  'use strict';

  window.__siteBooted = true;

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const mq = (q) => window.matchMedia(q).matches;
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');
  const coarse = mq('(hover: none), (pointer: coarse)');
  const narrow = () => window.innerWidth <= 900;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const animate = hasGsap && !reduceMotion;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    if (parent) parent.append(el);
    return el;
  };

  if (!hasGsap) root.classList.remove('js');
  if (!animate) root.classList.add('reduced');

  /* ---------- Static bits ---------- */

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const tick = () => { clock.textContent = `KERALA ${fmt.format(new Date())} IST`; };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- One frame loop; each visual only runs while it is on screen ---------- */

  const loops = [];
  const watch = (el, onChange, margin = '120px') => {
    new IntersectionObserver(([entry]) => {
      el.classList.toggle('is-offscreen', !entry.isIntersecting);
      onChange?.(entry.isIntersecting);
    }, { rootMargin: `${margin} 0px` }).observe(el);
  };
  const addLoop = (el, fn, margin) => {
    const loop = { fn, on: false };
    loops.push(loop);
    watch(el, (on) => { loop.on = on; }, margin);
    return loop;
  };
  let lastFrame = performance.now();
  const frame = (now) => {
    const dt = Math.min(50, now - lastFrame);
    lastFrame = now;
    if (!document.hidden) for (const loop of loops) if (loop.on) loop.fn(now, dt);
    requestAnimationFrame(frame);
  };
  if (!reduceMotion) requestAnimationFrame(frame);

  /* ---------- Smooth scroll (desktop); phones keep their native scrolling ---------- */

  let lenis = null;
  if (animate) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (window.Lenis && !coarse) {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }
  const easeInOut = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
  const scrollToY = (y) => {
    if (lenis) lenis.scrollTo(y, { duration: 1.8, easing: easeInOut });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const scrollToEl = (el) => scrollToY(el.getBoundingClientRect().top + window.scrollY);

  /* ---------- Small helpers ---------- */

  // Words ride up inside masks. Keeps inline elements such as <em>.
  const splitWords = (el) => {
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const mask = document.createElement('span');
            const word = document.createElement('span');
            mask.className = 'w';
            word.className = 'wi';
            word.textContent = part;
            mask.append(word);
            frag.append(mask);
            words.push(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
    return words;
  };

  // Characters inside per-word masks, for display titles.
  const splitTitle = (el) => {
    const chars = [];
    const text = el.textContent.trim();
    el.textContent = '';
    el.setAttribute('aria-label', text);
    text.split(/\s+/).forEach((wordText, i) => {
      if (i) el.append(' ');
      const mask = document.createElement('span');
      mask.className = 'w';
      mask.setAttribute('aria-hidden', 'true');
      Array.from(wordText).forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'wi';
        span.textContent = ch;
        mask.append(span);
        chars.push(span);
      });
      el.append(mask);
    });
    return chars;
  };

  // Text dissolves into 0s and 1s, then resolves left to right.
  const scrambleTo = (el, text, duration = 700) => {
    if (reduceMotion) { el.textContent = text; return; }
    cancelAnimationFrame(el.scrambleFrame);
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const reveal = Math.floor((1 - (1 - p) ** 2) * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) out += i < reveal || text[i] === ' ' ? text[i] : (Math.random() < 0.5 ? '0' : '1');
      el.textContent = out;
      if (p < 1) el.scrambleFrame = requestAnimationFrame(step);
    };
    el.scrambleFrame = requestAnimationFrame(step);
  };

  // Chases a target value; `spring` adds a little overshoot.
  const follow = (initial, render, { ease = 0.14, spring = false } = {}) => {
    let x = initial;
    let target = initial;
    let vel = 0;
    let raf = 0;
    const tick = () => {
      if (spring) { vel = (vel + (target - x) * 0.09) * 0.8; x += vel; } else { x += (target - x) * ease; }
      const done = Math.abs(target - x) < 0.02 && Math.abs(vel) < 0.02;
      if (done) { x = target; vel = 0; }
      render(x);
      raf = done ? 0 : requestAnimationFrame(tick);
    };
    return {
      set(v, instant) {
        target = v;
        if (instant || reduceMotion) { x = v; vel = 0; render(x); return; }
        if (!raf) raf = requestAnimationFrame(tick);
      },
    };
  };

  // One-shot reveals use IntersectionObserver: no scroll listeners, no forced layout.
  const onEnter = (els, cb, bottom = '-10%') => {
    const io = new IntersectionObserver((entries) => {
      const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target);
      batch.forEach((el) => io.unobserve(el));
      if (batch.length) cb(batch);
    }, { rootMargin: `0px 0px ${bottom} 0px` });
    els.filter(Boolean).forEach((el) => io.observe(el));
  };

  const countUp = (el, to, duration = 1.8) => {
    const width = el.textContent.trim().length;
    const show = (v) => { el.textContent = String(Math.round(v)).padStart(width, '0'); };
    if (!animate) { show(to); return; }
    const value = { v: 0 };
    gsap.to(value, { v: to, duration, ease: 'power3.out', onUpdate: () => show(value.v) });
  };

  /* ---------- Menu & section index ---------- */

  const orb = $('.orb');
  const orbMenu = $('#orb-menu');
  const setMenu = (open) => {
    if (!orb || root.classList.contains('menu-open') === open) return;
    root.classList.toggle('menu-open', open);
    orb.setAttribute('aria-expanded', String(open));
    orb.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
    orbMenu.setAttribute('aria-hidden', String(!open));
    orbMenu.inert = !open;
    if (lenis) (open ? lenis.stop() : lenis.start());
  };
  orb?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]:not(.skip)').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = $(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      scrollToEl(target);
    });
  });

  const NAV = { intro: '01', systems: '02', experience: '03', work: '04', thinking: '05', contact: '06' };
  const dockLinks = $$('[data-nav]');
  const orbN = $('[data-orb-n]');
  const setSection = (key) => {
    dockLinks.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === key));
    if (orbN && NAV[key]) orbN.textContent = NAV[key];
  };
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setSection(e.target.dataset.section); });
  }, { rootMargin: '-48% 0px -48% 0px' });
  $$('[data-section]').forEach((s) => sectionIO.observe(s));
  setSection('intro');

  if (orb) {
    let queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      orb.style.setProperty('--p', (1 - (max > 0 ? window.scrollY / max : 0)).toFixed(4));
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // The top bar steps aside while you read downward and returns when you scroll back up.
  const topbar = $('.topbar');
  if (topbar) {
    let lastY = window.scrollY;
    let queued = false;
    const update = () => {
      queued = false;
      const y = window.scrollY;
      topbar.classList.toggle('is-scrolled', y > 40);
      if (!root.classList.contains('menu-open')) topbar.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6);
      lastY = y;
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  }

  /* ---------- Cursor: a dot, and a ring that follows on a spring ---------- */

  const pointer = { x: -9999, y: -9999, active: false };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });

  if (finePointer && !reduceMotion) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    root.classList.add('has-cursor');
    const d = { x: -100, y: -100 };
    const r = { x: -100, y: -100, vx: 0, vy: 0 };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!cursor.classList.contains('is-visible')) { d.x = r.x = e.clientX; d.y = r.y = e.clientY; cursor.classList.add('is-visible'); }
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    loops.push({
      on: true,
      fn: () => {
        d.x = lerp(d.x, pointer.x, 0.5);
        d.y = lerp(d.y, pointer.y, 0.5);
        r.vx = (r.vx + (pointer.x - r.x) * 0.15) * 0.66;
        r.vy = (r.vy + (pointer.y - r.y) * 0.15) * 0.66;
        r.x += r.vx;
        r.y += r.vy;
        dot.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0)`;
        ring.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
      },
    });
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-cursor], a, button, [role="button"], [data-trait]');
      const text = el?.dataset.cursor || '';
      cursor.classList.toggle('is-label', Boolean(text));
      cursor.classList.toggle('is-hover', Boolean(el) && !text);
      if (text) label.textContent = text;
    });
  }

  if (finePointer && animate) {
    $$('[data-magnetic], .cta').forEach((el) => {
      const pull = el.classList.contains('cta') ? 0.32 : 0.25;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const b = el.getBoundingClientRect();
        xTo((e.clientX - (b.left + b.width / 2)) * pull);
        yTo((e.clientY - (b.top + b.height / 2)) * pull);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- Hero: a living network of nodes, links, packets and data fragments ---------- */

  const hero = $('.hero');
  const heroCanvas = $('[data-hero-canvas]');
  const FRAGMENTS = ['200 OK', 'pub/sub', '{ }', 'ack', 'SELECT', '→', '0x7f3a', 'GET /v1', 'event.created', '12ms', 'retry 1/3', 'cache hit', '0110 1001', 'idempotent', 'p99', 'commit'];

  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    const nodes = [];
    const frags = [];
    const packets = [];
    let w = 0;
    let h = 0;
    const count = coarse ? 36 : window.innerWidth < 1200 ? 64 : 86;
    const LINK = coarse ? 118 : 150;
    const sm = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      w = heroCanvas.clientWidth;
      h = heroCanvas.clientHeight;
      heroCanvas.width = Math.round(w * dpr);
      heroCanvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const fragment = (anywhere) => ({
      text: FRAGMENTS[(Math.random() * FRAGMENTS.length) | 0],
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 20,
      z: 0.3 + Math.random() * 0.6, vy: -(0.08 + Math.random() * 0.16), life: 0,
    });
    const seed = () => {
      nodes.length = 0;
      for (let i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * w, y: Math.random() * h, z: 0.25 + Math.random() * 0.75, vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14, ox: 0, oy: 0, sx: 0, sy: 0 });
      }
      frags.length = 0;
      for (let i = 0; i < (coarse ? 6 : 12); i++) frags.push(fragment(true));
    };
    resize();
    seed();
    window.addEventListener('resize', () => {
      const before = w;
      resize();
      if (Math.abs(w - before) > 120) seed();
    });

    const draw = (t, dt) => {
      const k = dt / 16.67;
      sm.x = lerp(sm.x, pointer.active ? pointer.x : w / 2, 0.08);
      sm.y = lerp(sm.y, pointer.active ? pointer.y : h / 2, 0.08);
      const px = sm.x;
      const py = sm.y;
      const parX = (px - w / 2) / w;
      const parY = (py - h / 2) / h;
      ctx.clearRect(0, 0, w, h);

      // The light follows the cursor.
      if (pointer.active && !coarse) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, 440);
        g.addColorStop(0, 'rgba(77, 124, 255, 0.17)');
        g.addColorStop(0.5, 'rgba(139, 108, 255, 0.05)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 440, py - 440, 880, 880);
      }

      for (const n of nodes) {
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < -40) n.x = w + 40; else if (n.x > w + 40) n.x = -40;
        if (n.y < -40) n.y = h + 40; else if (n.y > h + 40) n.y = -40;
        let sx = n.x - parX * 70 * n.z;
        let sy = n.y - parY * 46 * n.z;
        if (pointer.active) {
          const dx = sx - px;
          const dy = sy - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 34000) {
            const dist = Math.sqrt(d2) || 1;
            const f = (1 - d2 / 34000) * 28 * n.z;
            n.ox = lerp(n.ox, (dx / dist) * f, 0.12);
            n.oy = lerp(n.oy, (dy / dist) * f, 0.12);
          } else {
            n.ox = lerp(n.ox, 0, 0.06);
            n.oy = lerp(n.oy, 0, 0.06);
          }
        }
        sx += n.ox;
        sy += n.oy;
        n.sx = sx;
        n.sy = sy;
      }

      // Links, batched by strength so the stroke style only changes four times.
      const buckets = [[], [], [], []];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const lim = LINK * (a.z + b.z) * 0.6;
          const d2 = dx * dx + dy * dy;
          if (d2 < lim * lim) {
            const s = 1 - Math.sqrt(d2) / lim;
            buckets[Math.min(3, (s * 4) | 0)].push(a.sx, a.sy, b.sx, b.sy);
          }
        }
      }
      ctx.lineWidth = 1;
      buckets.forEach((arr, bi) => {
        if (!arr.length) return;
        ctx.strokeStyle = `rgba(130, 160, 255, ${0.07 + bi * 0.08})`;
        ctx.beginPath();
        for (let q = 0; q < arr.length; q += 4) { ctx.moveTo(arr[q], arr[q + 1]); ctx.lineTo(arr[q + 2], arr[q + 3]); }
        ctx.stroke();
      });

      if (pointer.active && !coarse) {
        ctx.strokeStyle = 'rgba(63, 208, 224, 0.26)';
        ctx.beginPath();
        let c = 0;
        for (const n of nodes) {
          const dx = n.sx - px;
          const dy = n.sy - py;
          if (c < 7 && dx * dx + dy * dy < 200 * 200) { ctx.moveTo(px, py); ctx.lineTo(n.sx, n.sy); c++; }
        }
        ctx.stroke();
      }

      for (const n of nodes) {
        const near = pointer.active ? Math.max(0, 1 - Math.hypot(n.sx - px, n.sy - py) / 230) : 0;
        ctx.fillStyle = near > 0
          ? `rgba(${lerp(170, 63, near) | 0}, ${lerp(185, 208, near) | 0}, 255, ${0.4 + near * 0.6})`
          : `rgba(170, 185, 230, ${0.22 + n.z * 0.45})`;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, 0.8 + n.z * 1.6 + near * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Packets of data hop between neighbours.
      if (Math.random() < 0.05 * k && packets.length < (coarse ? 3 : 8)) {
        const a = nodes[(Math.random() * nodes.length) | 0];
        let best = null;
        let bd = Infinity;
        for (const b of nodes) {
          if (b === a) continue;
          const dd = (a.sx - b.sx) ** 2 + (a.sy - b.sy) ** 2;
          if (dd > 900 && dd < bd) { bd = dd; best = b; }
        }
        if (best && bd < (LINK * 1.1) ** 2) packets.push({ a, b: best, t: 0 });
      }
      ctx.fillStyle = '#a7f0f7';
      for (let i = packets.length - 1; i >= 0; i--) {
        const pk = packets[i];
        pk.t += 0.013 * k;
        if (pk.t >= 1) { packets.splice(i, 1); continue; }
        ctx.globalAlpha = Math.sin(pk.t * Math.PI);
        ctx.beginPath();
        ctx.arc(lerp(pk.a.sx, pk.b.sx, pk.t), lerp(pk.a.sy, pk.b.sy, pk.t), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
      for (let i = 0; i < frags.length; i++) {
        const f = frags[i];
        f.y += f.vy * k;
        f.life += dt;
        if (f.y < -20) { frags[i] = fragment(false); continue; }
        const fade = Math.min(1, f.life / 1400) * Math.min(1, (f.y + 20) / 140);
        ctx.fillStyle = `rgba(150, 170, 215, ${(0.24 * f.z * fade).toFixed(3)})`;
        ctx.fillText(f.text, f.x - parX * 50 * f.z, f.y - parY * 30 * f.z);
      }
    };

    if (reduceMotion) draw(performance.now(), 16);
    else addLoop(hero, draw, '0px');
  }

  // Hero title: every letter catches the light and leans toward the cursor.
  const heroChars = $$('[data-hero-line]').map((line) => {
    const text = line.textContent;
    line.textContent = '';
    return Array.from(text).map((ch) => {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'ch';
      inner.className = 'ci';
      inner.textContent = ch;
      outer.append(inner);
      line.append(outer);
      return outer;
    });
  });
  const heroInner = heroChars.flat().map((o) => o.firstChild);
  let heroCenters = [];

  if (finePointer && animate) {
    const xTo = heroInner.map((el) => gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' }));
    const yTo = heroInner.map((el) => gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' }));
    let queued = false;
    window.addEventListener('pointermove', () => {
      if (queued || window.scrollY > window.innerHeight * 0.4) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!heroCenters.length) {
          heroCenters = heroInner.map((el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
        }
        heroInner.forEach((el, i) => {
          const [cx, cy] = heroCenters[i];
          const dx = pointer.x - cx;
          const dy = pointer.y - cy;
          const g = clamp(1 - Math.hypot(dx, dy) / 480, 0, 1);
          el.style.setProperty('--g', g.toFixed(3));
          xTo[i](dx * g * 0.045);
          yTo[i](dy * g * 0.045);
        });
      });
    }, { passive: true });
    window.addEventListener('resize', () => { heroCenters = []; });
  }

  /* ---------- Boot: "INITIALIZING SYSTEM" → "SYSTEM ONLINE", short and skippable ---------- */

  const boot = $('.boot');
  const runBoot = () => new Promise((resolve) => {
    if (!boot) { resolve(); return; }
    if (!animate) { boot.remove(); resolve(); return; }
    const logEl = $('[data-boot-log]');
    const status = $('[data-boot-status]');
    const bar = $('[data-boot-bar]');
    const lines = ['mounting interface', 'connecting 16 nodes', 'warming caches', 'routing traffic'];
    const stepMs = coarse ? 110 : 180;
    let i = 0;
    let done = false;
    let timer = 0;
    // Phones never lose their scroll to the boot screen; desktops hold it for a moment.
    if (coarse) boot.style.pointerEvents = 'none';
    else lenis?.stop();
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      $$('li', logEl).forEach((li) => li.classList.add('is-ok'));
      status.textContent = 'SYSTEM ONLINE';
      boot.classList.add('is-online');
      bar.style.transform = 'scaleX(1)';
      gsap.to(boot, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut', delay: 0.3, onComplete: () => { boot.remove(); lenis?.start(); } });
      setTimeout(resolve, 420);
    };
    const fontsReady = Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 1200))]);
    const next = () => {
      if (done) return;
      logEl.lastElementChild?.classList.add('is-ok');
      if (i < lines.length) {
        const li = document.createElement('li');
        li.textContent = `› ${lines[i]}`;
        logEl.append(li);
        i++;
        bar.style.transform = `scaleX(${((i / lines.length) * 0.9).toFixed(3)})`;
        timer = setTimeout(next, stepMs);
      } else {
        fontsReady.then(finish);
      }
    };
    next();
    ['touchstart', 'wheel', 'keydown', 'pointerdown'].forEach((type) => window.addEventListener(type, finish, { once: true, passive: true }));
  });

  if (animate) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    gsap.set(heroInner, { opacity: 0, yPercent: 32, filter: finePointer ? 'blur(14px)' : 'blur(0px)' });
    gsap.set('.hero .r', { opacity: 0, y: 18 });
    gsap.set(heroCanvas, { opacity: 0 });
    gsap.set('.topbar, .dock', { opacity: 0 });
  }

  runBoot().then(() => {
    if (!animate) return;
    gsap.to(heroInner, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.6, ease: 'expo.out', stagger: 0.05, onComplete: () => { heroCenters = []; } });
    gsap.to('.hero .r', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.08, delay: 0.5 });
    gsap.to(heroCanvas, { opacity: 1, duration: 1.8, ease: 'power2.out' });
    gsap.to('.topbar, .dock', { opacity: 1, duration: 1.2, delay: 0.6 });
  });

  /* ---------- System map ---------- */

  const TECH = [
    { id: 'java', name: 'Java', cat: 'Language', ring: 1, a: 180, text: 'The language of the core: strongly typed, fast, and built for systems that live for years.' },
    { id: 'spring', name: 'Spring Boot', cat: 'Framework', ring: 1, a: 225, text: 'The service framework — security, data access and REST in one consistent shape across every service.' },
    { id: 'micro', name: 'Microservices', cat: 'Architecture', ring: 1, a: 270, text: 'Small, independently deployable services drawn around business capabilities.' },
    { id: 'arch', name: 'Architecture', cat: 'Practice', ring: 1, a: 315, text: 'The decisions that are expensive to change — made deliberately and written down.' },
    { id: 'dist', name: 'Distributed Systems', cat: 'Architecture', ring: 1, a: 0, text: 'Many processes behaving like one: retries, idempotency and failure treated as first-class design inputs.' },
    { id: 'gcp', name: 'GCP', cat: 'Cloud', ring: 1, a: 45, text: 'The cloud underneath — managed building blocks, so the team ships product instead of plumbing.' },
    { id: 'pg', name: 'PostgreSQL', cat: 'Data', ring: 1, a: 90, text: 'The system of record. Relational, transactional and dependable.' },
    { id: 'cicd', name: 'CI/CD', cat: 'Delivery', ring: 1, a: 135, text: 'Every change built, tested and shipped automatically — small steps, often.' },
    { id: 'rest', name: 'REST APIs', cat: 'Integration', ring: 2, a: 202, text: 'Contracts between systems and partners: clear, versioned and documented.' },
    { id: 'design', name: 'System Design', cat: 'Practice', ring: 2, a: 292, text: 'Choosing boundaries, data flows and trade-offs before writing the code.' },
    { id: 'pubsub', name: 'Pub/Sub', cat: 'Cloud', ring: 2, a: 345, text: 'The event backbone. Services publish what happened; others react — loosely coupled and resilient.' },
    { id: 'run', name: 'Cloud Run', cat: 'Cloud', ring: 2, a: 28, text: 'Serverless containers: each service scales with demand, with no servers to babysit.' },
    { id: 'redis', name: 'Redis / Memcached', cat: 'Data', ring: 2, a: 68, text: 'Caches in front of hot paths — fast reads without hammering the database.' },
    { id: 'alloy', name: 'AlloyDB', cat: 'Data', ring: 2, a: 112, text: 'PostgreSQL-compatible and built for scale on Google Cloud, for when a workload outgrows a single instance.' },
    { id: 'gha', name: 'GitHub Actions', cat: 'Delivery', ring: 2, a: 145, text: 'Pipelines as code, living right next to the code they ship.' },
    { id: 'docker', name: 'Docker', cat: 'Delivery', ring: 2, a: 168, text: 'One container image, the same everywhere — laptop, pipeline and production.' },
  ];
  const TECH_LINKS = [
    ['java', 'spring'], ['java', 'micro'], ['spring', 'rest'], ['spring', 'micro'], ['micro', 'dist'], ['micro', 'docker'],
    ['docker', 'run'], ['run', 'gcp'], ['pubsub', 'gcp'], ['pubsub', 'micro'], ['pubsub', 'dist'], ['pg', 'alloy'],
    ['alloy', 'gcp'], ['redis', 'dist'], ['redis', 'pg'], ['design', 'arch'], ['arch', 'micro'], ['arch', 'dist'],
    ['cicd', 'gha'], ['gha', 'docker'], ['cicd', 'run'], ['rest', 'design'],
  ];

  const mapSvg = $('[data-map]');
  if (mapSvg) {
    const stage = $('[data-map-stage]');
    const panel = { cat: $('[data-map-cat]'), name: $('[data-map-name]'), text: $('[data-map-text]'), rel: $('[data-map-rel]') };
    const resetBtn = $('[data-map-reset]');
    const chipList = $('[data-map-chips]');
    const DEFAULT = { cat: 'Overview', name: 'Sainjal', text: panel.text.textContent };
    const STARTERS = ['java', 'micro', 'gcp', 'pg', 'cicd', 'arch'];
    const byId = Object.fromEntries(TECH.map((t) => [t.id, t]));
    const neighbours = (id) => TECH_LINKS.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
    const vb = { x: 0, y: 0, w: 1200, h: 760 };
    const applyVB = () => mapSvg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    let mode = '';
    let W = 1200;
    let H = 760;
    let nodes = [];
    let edges = [];
    let pinned = null;
    let focused = null;

    const zoomTo = (x, y, z) => {
      const w = W / z;
      const h = H / z;
      const to = { x: clamp(x - w / 2, 0, W - w), y: clamp(y - h / 2, 0, H - h), w, h };
      if (animate) gsap.to(vb, { ...to, duration: 1.1, ease: 'expo.out', overwrite: true, onUpdate: applyVB });
      else { Object.assign(vb, to); applyVB(); }
    };
    const relChips = (ids, onPick) => {
      panel.rel.textContent = '';
      ids.forEach((id) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = byId[id].name;
        b.addEventListener('click', () => onPick(id));
        li.append(b);
        panel.rel.append(li);
      });
    };
    const pin = (id) => { pinned = id; focus(id, true); };
    const focus = (id, zoom) => {
      focused = id;
      const near = new Set(neighbours(id));
      const t = byId[id];
      mapSvg.classList.add('has-focus');
      nodes.forEach((n) => {
        n.el.classList.toggle('is-focus', n.id === id);
        n.el.classList.toggle('is-hot', near.has(n.id));
        n.el.classList.toggle('is-dim', n.id !== id && !near.has(n.id));
      });
      edges.forEach((e) => e.el.classList.toggle('is-hot', !e.spoke && (e.a.id === id || e.b.id === id)));
      panel.cat.textContent = t.cat;
      panel.name.textContent = t.name;
      panel.text.textContent = t.text;
      relChips([...near], pin);
      $$('.chip', chipList).forEach((c) => c.classList.toggle('is-on', c.dataset.id === id));
      if (zoom) {
        const n = nodes.find((x) => x.id === id);
        zoomTo(n.x0, n.y0, 1.55);
        resetBtn.hidden = false;
      }
    };
    const reset = () => {
      focused = null;
      pinned = null;
      mapSvg.classList.remove('has-focus');
      nodes.forEach((n) => n.el.classList.remove('is-focus', 'is-hot', 'is-dim'));
      edges.forEach((e) => e.el.classList.remove('is-hot'));
      panel.cat.textContent = DEFAULT.cat;
      panel.name.textContent = DEFAULT.name;
      panel.text.textContent = DEFAULT.text;
      relChips(STARTERS, pin);
      $$('.chip', chipList).forEach((c) => c.classList.remove('is-on'));
      resetBtn.hidden = true;
      zoomTo(W / 2, H / 2, 1);
    };
    const pathFor = (a, b) => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx + (W / 2 - mx) * 0.18).toFixed(1)} ${(my + (H / 2 - my) * 0.18).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    };
    const place = () => {
      nodes.forEach((n) => n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`));
      edges.forEach((e) => e.el.setAttribute('d', pathFor(e.a, e.b)));
    };
    const build = () => {
      const portrait = stage.clientWidth < 680;
      const next = portrait ? 'portrait' : 'wide';
      if (next === mode) return false;
      mode = next;
      W = portrait ? 600 : 1200;
      H = portrait ? 860 : 760;
      Object.assign(vb, { x: 0, y: 0, w: W, h: H });
      applyVB();
      mapSvg.style.setProperty('--m-font', portrait ? '18px' : '13px');
      mapSvg.style.setProperty('--m-center-font', portrait ? '19px' : '15px');
      mapSvg.textContent = '';
      const defs = svgEl('defs', {}, mapSvg);
      const grad = svgEl('radialGradient', { id: 'm-core', cx: '40%', cy: '35%' }, defs);
      svgEl('stop', { offset: '0', 'stop-color': '#b9ccff' }, grad);
      svgEl('stop', { offset: '0.55', 'stop-color': '#4d7cff' }, grad);
      svgEl('stop', { offset: '1', 'stop-color': '#8b6cff' }, grad);
      const cx = W / 2;
      const cy = H / 2;
      const RADII = portrait ? { 1: [150, 205], 2: [255, 365] } : { 1: [250, 170], 2: [470, 300] };
      const gEdges = svgEl('g', {}, mapSvg);
      const gNodes = svgEl('g', {}, mapSvg);
      nodes = TECH.map((t, i) => {
        const rad = (t.a * Math.PI) / 180;
        const [rx, ry] = RADII[t.ring];
        const x0 = cx + Math.cos(rad) * rx;
        const y0 = cy + Math.sin(rad) * ry;
        return { ...t, x0, y0, x: x0, y: y0, phase: i * 1.7 };
      });
      const center = { id: 'center', x: cx, y: cy };
      edges = [];
      nodes.filter((n) => n.ring === 1).forEach((n) => edges.push({ a: center, b: n, spoke: true, el: svgEl('path', { class: 'm-spoke' }, gEdges) }));
      TECH_LINKS.forEach(([a, b]) => edges.push({ a: nodes.find((n) => n.id === a), b: nodes.find((n) => n.id === b), el: svgEl('path', { class: 'm-edge' }, gEdges) }));
      const gc = svgEl('g', { class: 'm-center', transform: `translate(${cx} ${cy})` }, gNodes);
      svgEl('circle', { class: 'ring', r: portrait ? 74 : 62 }, gc);
      svgEl('circle', { class: 'm-disc', r: portrait ? 56 : 44 }, gc);
      svgEl('text', { y: portrait ? 7 : 5 }, gc).textContent = 'SAINJAL';
      nodes.forEach((n) => {
        const g = svgEl('g', { class: 'm-node', tabindex: '0', role: 'button', 'data-cursor': 'EXPLORE', 'aria-label': `${n.name}, ${n.cat}` }, gNodes);
        const big = n.ring === 1;
        svgEl('circle', { class: 'halo', r: portrait ? (big ? 20 : 16) : (big ? 16 : 12) }, g);
        svgEl('circle', { class: 'dot', r: portrait ? (big ? 7 : 5.5) : (big ? 5.5 : 4) }, g);
        svgEl('text', { y: portrait ? 44 : 31 }, g).textContent = n.name;
        n.el = g;
        g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !pinned) focus(n.id, false); });
        g.addEventListener('click', (e) => { e.stopPropagation(); if (pinned === n.id) reset(); else pin(n.id); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pin(n.id); } });
      });
      place();
      return true;
    };

    if (chipList) {
      TECH.forEach((t) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.dataset.id = t.id;
        b.textContent = t.name;
        b.addEventListener('click', () => (pinned === t.id ? reset() : pin(t.id)));
        li.append(b);
        chipList.append(li);
      });
    }
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned && focused) reset(); });
    mapSvg.addEventListener('click', () => { if (focused) reset(); });
    resetBtn.addEventListener('click', reset);
    build();
    reset();
    window.addEventListener('resize', () => { if (build()) reset(); });
    if (!reduceMotion) {
      addLoop(stage, (t) => {
        nodes.forEach((n) => {
          n.x = n.x0 + Math.sin(t * 0.0007 + n.phase) * 5;
          n.y = n.y0 + Math.cos(t * 0.0006 + n.phase * 1.3) * 5;
        });
        place();
      });
    }
  }

  /* ---------- Case studies ---------- */

  const HOT = [[], ['client', 'api', 'svc', 'bus', 'data', 'ext'], ['svc', 'bus'], ['bus', 'data', 'ext'], ['client', 'api', 'svc', 'bus', 'data', 'ext']];
  const cases = $$('[data-case]').map((kase) => {
    const steps = $$('.step', kase);
    const nodes = $$('.dg__node', kase);
    const inspect = $('[data-inspect]', kase);
    const packets = $$('.dg__packets circle', kase);
    const tech = $$('.case__tech li', kase);
    const counts = $$('[data-case-count]', kase);
    const route = $('.route__path', kase);
    const state = { current: -1, built: false, counted: false };

    const build = () => {
      if (state.built) return;
      state.built = true;
      kase.classList.add('is-built');
      if (!animate) return;
      gsap.to(nodes, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09 });
      gsap.to(tech, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
    };
    const drawRoute = () => { if (route && animate) gsap.fromTo(route, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }); };
    const finish = () => {
      if (state.counted) return;
      state.counted = true;
      counts.forEach((c) => countUp(c, parseInt(c.dataset.caseCount, 10)));
    };
    const setStep = (i) => {
      if (i === state.current) return;
      state.current = i;
      kase.dataset.step = i;
      steps.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-done', k < i); });
      if (i >= 1) build();
      nodes.forEach((n) => n.classList.toggle('is-hot', HOT[i].includes(n.dataset.node) && i >= 2));
      kase.classList.toggle('is-flowing', i >= 2);
      if (i === 2) drawRoute();
      if (i === 4) finish();
    };

    const pick = (node) => {
      nodes.forEach((n) => n.classList.toggle('is-picked', n === node));
      const [title, text] = node.dataset.info.split('|');
      inspect.textContent = '';
      const k = document.createElement('span');
      k.className = 'mono';
      k.textContent = 'Inspect';
      const b = document.createElement('b');
      b.textContent = title;
      const p = document.createElement('span');
      p.textContent = text;
      inspect.append(k, b, p);
      if (animate) gsap.fromTo(inspect, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    };
    nodes.forEach((n) => {
      n.addEventListener('click', () => pick(n));
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n); } });
    });

    if (!reduceMotion) {
      let hidden = true;
      addLoop(kase, (t) => {
        if (!kase.classList.contains('is-flowing')) {
          if (!hidden) { packets.forEach((p) => { p.style.opacity = 0; }); hidden = true; }
          return;
        }
        hidden = false;
        packets.forEach((p, k) => {
          const ph = (t / 2600 + k * 0.5) % 1;
          p.setAttribute('cx', 210);
          p.setAttribute('cy', (74 + ph * 454).toFixed(1));
          p.style.opacity = Math.sin(ph * Math.PI).toFixed(2);
        });
      });
    }
    return { kase, steps, nodes, tech, setStep, build, drawRoute, finish };
  });

  /* ---------- Architecture lab ---------- */

  const LAB_NODES = [
    { id: 'client', name: 'Client', layer: 'edge', text: 'Web, mobile or a partner system — where every request begins.' },
    { id: 'gateway', name: 'API Gateway', layer: 'edge', text: 'One front door: routing, rate limits and TLS before anything reaches a service.' },
    { id: 'auth', name: 'Identity', layer: 'edge', text: 'Single sign-on and tokens, with role-based access decided at runtime.' },
    { id: 'orders', name: 'Order Service', layer: 'services', text: 'Owns orders end to end, and writes its data and its event in one transaction.' },
    { id: 'pricing', name: 'Pricing Service', layer: 'services', text: 'Prices each leg. Reads hot data from the cache and falls back to the database.' },
    { id: 'broker', name: 'Message Broker', layer: 'messaging', text: 'The Pub/Sub backbone. Producers never wait for consumers.' },
    { id: 'consumer', name: 'Event Consumer', layer: 'messaging', text: 'Reacts to events — idempotent, so a retry can never do damage.' },
    { id: 'cache', name: 'Cache', layer: 'data', text: 'Hot reads in microseconds; the database stays the source of truth.' },
    { id: 'db', name: 'Database', layer: 'data', text: 'The system of record. Relational and transactional.' },
    { id: 'search', name: 'Search Index', layer: 'data', text: 'A read model shaped for fast, flexible queries.' },
    { id: 'external', name: 'External APIs', layer: 'external', text: 'Carriers and partners, integrated asynchronously.' },
  ];
  const LAB_LINKS = [
    ['client', 'gateway'], ['gateway', 'auth'], ['gateway', 'orders'], ['gateway', 'pricing'], ['pricing', 'cache'], ['pricing', 'db'],
    ['orders', 'db'], ['orders', 'broker'], ['broker', 'consumer'], ['consumer', 'db'], ['consumer', 'search'], ['consumer', 'external'],
  ];
  const LAB_LAYOUT = {
    wide: { client: [90, 280], gateway: [270, 280], auth: [270, 100], orders: [470, 190], pricing: [470, 400], broker: [670, 190], consumer: [860, 190], cache: [670, 470], db: [860, 400], search: [1010, 80], external: [1010, 300] },
    tall: { client: [150, 70], gateway: [150, 220], auth: [450, 220], orders: [150, 380], pricing: [450, 380], broker: [150, 540], cache: [450, 540], consumer: [150, 700], db: [450, 700], search: [150, 860], external: [450, 860] },
  };
  const LAB_RUN = [
    ['client', 'gateway', 'POST /orders → API gateway'],
    ['gateway', 'auth', 'identity verified · access granted'],
    ['gateway', 'orders', 'order service processes the request'],
    ['orders', 'db', 'order written in the same transaction as its event'],
    ['orders', 'broker', 'event published: order.created'],
    ['broker', 'consumer', 'consumer picks up the event'],
    ['consumer', 'search', 'search index updated'],
    ['consumer', 'db', 'database updated'],
    ['consumer', 'external', 'partner notified'],
  ];
  const LAYER_NAME = { edge: 'Edge', services: 'Services', messaging: 'Messaging', data: 'Data', external: 'External' };

  const labSvg = $('[data-lab]');
  if (labSvg) {
    const canvas = $('[data-lab-canvas]');
    const ins = { layer: $('[data-lab-layer]'), name: $('[data-lab-name]'), text: $('[data-lab-text]'), links: $('[data-lab-links]') };
    const log = $('[data-lab-log]');
    const runBtn = $('[data-lab-run]');
    const off = new Set();
    let mode = '';
    let W = 1100;
    let H = 560;
    let NW = 150;
    let NH = 54;
    let nodes = {};
    let edges = [];
    let ambient = [];
    let runPacket = null;
    let drag = null;
    let running = false;

    const ctrl = (a, b) => (mode === 'tall'
      ? [[a.x, (a.y + b.y) / 2], [b.x, (a.y + b.y) / 2]]
      : [[(a.x + b.x) / 2, a.y], [(a.x + b.x) / 2, b.y]]);
    const bez = (e, t) => {
      const [c1, c2] = ctrl(e.a, e.b);
      const u = 1 - t;
      return [
        u * u * u * e.a.x + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e.b.x,
        u * u * u * e.a.y + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e.b.y,
      ];
    };
    const layout = () => {
      Object.values(nodes).forEach((n) => n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`));
      edges.forEach((e) => {
        const [c1, c2] = ctrl(e.a, e.b);
        e.el.setAttribute('d', `M${e.a.x} ${e.a.y} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e.b.x} ${e.b.y}`);
      });
    };
    const applyLayers = () => {
      Object.values(nodes).forEach((n) => n.el.classList.toggle('is-off', off.has(n.layer)));
      edges.forEach((e) => e.el.classList.toggle('is-off', off.has(e.a.layer) || off.has(e.b.layer)));
    };
    const toSvg = (e) => {
      const pt = labSvg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(labSvg.getScreenCTM().inverse());
    };
    const inspectNode = (id) => {
      const n = nodes[id];
      Object.values(nodes).forEach((m) => m.el.classList.toggle('is-picked', m.id === id));
      edges.forEach((e) => e.el.classList.toggle('is-hot', e.a.id === id || e.b.id === id));
      ins.layer.textContent = `${LAYER_NAME[n.layer]} layer`;
      ins.name.textContent = n.name;
      ins.text.textContent = n.text;
      ins.links.textContent = '';
      edges.filter((e) => e.a.id === id || e.b.id === id).forEach((e) => {
        const li = document.createElement('li');
        li.textContent = e.a.id === id ? `→ ${e.b.name}` : `← ${e.a.name}`;
        ins.links.append(li);
      });
    };

    const build = () => {
      const tall = canvas.clientWidth < 640;
      const next = tall ? 'tall' : 'wide';
      if (next === mode) return;
      mode = next;
      W = tall ? 600 : 1100;
      H = tall ? 930 : 560;
      NW = tall ? 236 : 150;
      NH = tall ? 80 : 54;
      labSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      labSvg.style.setProperty('--l-font', tall ? '25px' : '14px');
      labSvg.style.setProperty('--l-tag', tall ? '15px' : '9.5px');
      labSvg.textContent = '';
      const gE = svgEl('g', {}, labSvg);
      const gP = svgEl('g', {}, labSvg);
      const gN = svgEl('g', {}, labSvg);
      nodes = {};
      LAB_NODES.forEach((d) => {
        const [x, y] = LAB_LAYOUT[mode][d.id];
        const g = svgEl('g', { class: 'l-node', 'data-l': d.layer, tabindex: '0', role: 'button', 'data-cursor': 'EXPLORE', 'aria-label': `${d.name}, ${LAYER_NAME[d.layer]} layer` }, gN);
        svgEl('rect', { x: -NW / 2, y: -NH / 2, width: NW, height: NH, rx: tall ? 18 : 12 }, g);
        svgEl('circle', { class: 'l-dot', cx: -NW / 2 + (tall ? 22 : 15), cy: -NH / 2 + (tall ? 22 : 15), r: tall ? 6 : 3.5 }, g);
        svgEl('text', { class: 'l-name', y: tall ? 4 : 1 }, g).textContent = d.name;
        svgEl('text', { class: 'l-tag', y: tall ? 32 : 18 }, g).textContent = LAYER_NAME[d.layer];
        const n = { ...d, x, y, x0: x, y0: y, el: g };
        nodes[d.id] = n;

        g.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          g.setPointerCapture(e.pointerId);
          const p = toSvg(e);
          drag = { id: d.id, dx: n.x - p.x, dy: n.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
          g.classList.add('is-dragging');
        });
        g.addEventListener('pointermove', (e) => {
          if (!drag || drag.id !== d.id) return;
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
          if (!drag.moved) return;
          const p = toSvg(e);
          n.x = clamp(p.x + drag.dx, NW / 2, W - NW / 2);
          n.y = clamp(p.y + drag.dy, NH / 2, H - NH / 2);
          layout();
        });
        const end = () => {
          if (!drag || drag.id !== d.id) return;
          const click = !drag.moved;
          drag = null;
          g.classList.remove('is-dragging');
          if (click) inspectNode(d.id);
        };
        g.addEventListener('pointerup', end);
        g.addEventListener('pointercancel', () => { drag = null; g.classList.remove('is-dragging'); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspectNode(d.id); } });
      });
      edges = LAB_LINKS.map(([a, b]) => ({ a: nodes[a], b: nodes[b], el: svgEl('path', { class: 'l-edge' }, gE) }));
      ambient = Array.from({ length: mode === 'tall' ? 3 : 5 }, (_, i) => ({ el: svgEl('circle', { class: 'l-packet', r: tall ? 5 : 3, opacity: 0 }, gP), e: edges[(i * 3) % edges.length], t: Math.random() }));
      runPacket = svgEl('circle', { class: 'l-packet l-packet--run', r: tall ? 9 : 5.5, opacity: 0 }, gP);
      layout();
      applyLayers();
    };

    const addLog = (text, cls) => {
      log.querySelectorAll('.is-new').forEach((li) => li.classList.remove('is-new'));
      const li = document.createElement('li');
      li.textContent = text;
      if (cls) li.className = cls;
      log.append(li);
      while (log.children.length > 7) log.firstElementChild.remove();
    };
    const travel = (from, to) => new Promise((resolve) => {
      const e = edges.find((x) => (x.a.id === from && x.b.id === to) || (x.a.id === to && x.b.id === from));
      const reverse = e.a.id !== from;
      const dur = reduceMotion ? 0 : 700;
      const start = performance.now();
      runPacket.setAttribute('opacity', 1);
      const step = (now) => {
        const raw = dur ? Math.min(1, (now - start) / dur) : 1;
        const t = easeInOut(raw);
        const [x, y] = bez(e, reverse ? 1 - t : t);
        runPacket.setAttribute('cx', x.toFixed(1));
        runPacket.setAttribute('cy', y.toFixed(1));
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    const run = async () => {
      if (running) return;
      running = true;
      runBtn.disabled = true;
      log.textContent = '';
      Object.values(nodes).forEach((n) => n.el.classList.remove('is-hot', 'is-picked'));
      edges.forEach((e) => e.el.classList.remove('is-hot'));
      const t0 = performance.now();
      for (const [from, to, text] of LAB_RUN) {
        const e = edges.find((x) => (x.a.id === from && x.b.id === to) || (x.a.id === to && x.b.id === from));
        e.el.classList.add('is-hot');
        nodes[from].el.classList.add('is-hot');
        addLog(`› ${text}`, 'is-new');
        await travel(from, to);
        nodes[to].el.classList.add('is-hot');
        if (reduceMotion) await new Promise((r) => setTimeout(r, 250));
      }
      runPacket.setAttribute('opacity', 0);
      addLog(`✓ done · ${LAB_RUN.length} hops · ${Math.round(performance.now() - t0)} ms of animation · 0 lost`, 'is-done');
      setTimeout(() => {
        Object.values(nodes).forEach((n) => n.el.classList.remove('is-hot'));
        edges.forEach((e) => e.el.classList.remove('is-hot'));
        running = false;
        runBtn.disabled = false;
      }, 1400);
    };

    runBtn.addEventListener('click', run);
    $('[data-lab-reset]').addEventListener('click', () => {
      const all = Object.values(nodes);
      if (animate) {
        all.forEach((n) => gsap.to(n, { x: n.x0, y: n.y0, duration: 1, ease: 'expo.out', onUpdate: layout }));
      } else {
        all.forEach((n) => { n.x = n.x0; n.y = n.y0; });
        layout();
      }
    });
    $$('[data-layer-toggle]').forEach((b) => {
      b.addEventListener('click', () => {
        const layer = b.dataset.layerToggle;
        const on = off.has(layer);
        if (on) off.delete(layer); else off.add(layer);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
        applyLayers();
      });
    });
    build();
    window.addEventListener('resize', build);

    if (!reduceMotion) {
      addLoop(canvas, (t, dt) => {
        ambient.forEach((p) => {
          p.t += dt / 2200;
          if (p.t >= 1) {
            const choices = edges.filter((e) => !off.has(e.a.layer) && !off.has(e.b.layer));
            p.e = choices[(Math.random() * choices.length) | 0] || edges[0];
            p.t = 0;
          }
          const [x, y] = bez(p.e, p.t);
          p.el.setAttribute('cx', x.toFixed(1));
          p.el.setAttribute('cy', y.toFixed(1));
          p.el.setAttribute('opacity', (Math.sin(p.t * Math.PI) * (running ? 0.25 : 0.75)).toFixed(2));
        });
      });
    }
  }

  /* ---------- Building what's next: satellites orbit a core ---------- */

  const nextSection = $('.next');
  if (nextSection) {
    const core = $('[data-core]');
    const sats = $$('[data-sat]', core);
    const place = (t) => {
      const R = core.clientWidth * 0.5;
      sats.forEach((s, i) => {
        const a = t * 0.00016 + (i / sats.length) * Math.PI * 2;
        const depth = (Math.sin(a) + 1) / 2;
        s.style.transform = `translate(-50%, -50%) translate(${(Math.cos(a) * R).toFixed(1)}px, ${(Math.sin(a) * R * 0.34).toFixed(1)}px) scale(${(0.78 + depth * 0.32).toFixed(3)})`;
        s.style.opacity = (0.35 + depth * 0.65).toFixed(2);
        s.style.zIndex = depth > 0.5 ? 2 : 0;
      });
    };
    if (reduceMotion) place(0);
    else addLoop(nextSection, place);
  }

  /* ---------- Beyond the code ---------- */

  $$('[data-trait]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const b = card.getBoundingClientRect();
      card.style.setProperty('--x', `${(e.clientX - b.left).toFixed(0)}px`);
      card.style.setProperty('--y', `${(e.clientY - b.top).toFixed(0)}px`);
    });
    card.addEventListener('click', () => {
      card.classList.add('is-active');
      clearTimeout(card.activeTimer);
      card.activeTimer = setTimeout(() => card.classList.remove('is-active'), 1800);
    });
    const title = $('[data-scramble]', card);
    if (title && finePointer) card.addEventListener('mouseenter', () => scrambleTo(title, title.dataset.text || title.textContent));
  });
  $$('[data-scramble]').forEach((el) => { el.dataset.text = el.textContent; });
  onEnter($$('[data-scramble]'), (batch) => batch.forEach((el, i) => setTimeout(() => scrambleTo(el, el.dataset.text, 900), i * 120)), '-10%');

  const needle = $('[data-needle]');
  if (needle) {
    let angle = 0;
    let visible = false;
    const rot = follow(0, (v) => { needle.style.transform = `rotate(${v.toFixed(1)}deg)`; }, { spring: true });
    watch(needle.closest('section'), (on) => { visible = on; });
    const aim = (x, y) => {
      const b = needle.parentElement.getBoundingClientRect();
      let target = (Math.atan2(y - (b.top + b.height / 2), x - (b.left + b.width / 2)) * 180) / Math.PI + 90;
      while (target - angle > 180) target -= 360;
      while (target - angle < -180) target += 360;
      angle = target;
      rot.set(angle);
    };
    window.addEventListener('pointermove', (e) => { if (visible) aim(e.clientX, e.clientY); }, { passive: true });
  }

  const brain = $('[data-brain]');
  if (brain) {
    const track = $('.brain__track', brain);
    const note = $('[data-brain-note]', brain);
    const notes = {
      mid: "Exactly in the middle. Apparently that's rare.",
      left: 'Leaning logical — Math is winning this round.',
      right: 'Leaning creative — English takes the lead.',
      back: '…and back to the middle. Every single time.',
    };
    let mood = 'mid';
    const setMood = (m) => { if (m !== mood) { mood = m; scrambleTo(note, notes[m], 700); } };
    const pos = follow(50, (v) => {
      brain.style.setProperty('--pos', v.toFixed(2));
      brain.classList.toggle('is-left', v < 42);
      brain.classList.toggle('is-right', v > 58);
    }, { spring: true });
    const fromPointer = (e) => {
      const r = track.getBoundingClientRect();
      const v = clamp(((e.clientX - r.left) / r.width) * 100, 4, 96);
      pos.set(v);
      setMood(v < 42 ? 'left' : v > 58 ? 'right' : 'mid');
    };
    brain.addEventListener('pointermove', fromPointer);
    brain.addEventListener('pointerdown', fromPointer);
    brain.addEventListener('pointerleave', () => { pos.set(50); if (mood !== 'mid') setMood('back'); });
  }

  /* ---------- Contact: particles gather around the button ---------- */

  const contact = $('.contact');
  const cta = $('[data-cta]');
  let ctaHot = false;
  if (cta) {
    const hot = (on) => { ctaHot = on; contact.classList.toggle('is-hot', on); };
    cta.addEventListener('pointerenter', () => hot(true));
    cta.addEventListener('pointerleave', () => hot(false));
    cta.addEventListener('focus', () => hot(true));
    cta.addEventListener('blur', () => hot(false));
  }
  const cCanvas = $('[data-contact-canvas]');
  if (cCanvas && !reduceMotion) {
    const ctx = cCanvas.getContext('2d');
    const parts = [];
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      w = cCanvas.clientWidth;
      h = cCanvas.clientHeight;
      cCanvas.width = Math.round(w * dpr);
      cCanvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts.forEach((p) => { p.hx = Math.random() * w; p.hy = Math.random() * h; });
    };
    for (let i = 0; i < (coarse ? 36 : 90); i++) parts.push({ x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0, a: Math.random() * Math.PI * 2, r: 0.6 + Math.random() * 1.4 });
    resize();
    parts.forEach((p) => { p.x = p.hx; p.y = p.hy; });
    window.addEventListener('resize', resize);
    addLoop(contact, (t, dt) => {
      const k = dt / 16.67;
      ctx.clearRect(0, 0, w, h);
      let cx = 0;
      let cy = 0;
      let rad = 0;
      if (ctaHot) {
        const cb = cta.getBoundingClientRect();
        const sb = cCanvas.getBoundingClientRect();
        cx = cb.left - sb.left + cb.width / 2;
        cy = cb.top - sb.top + cb.height / 2;
        rad = cb.width * 0.62;
      }
      ctx.fillStyle = ctaHot ? 'rgba(150, 200, 255, 1)' : 'rgba(150, 170, 230, 1)';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        let tx;
        let ty;
        if (ctaHot) {
          const ang = p.a + t * 0.0005;
          const rr = rad + Math.sin(t * 0.002 + i) * 16 + (i % 6) * 7;
          tx = cx + Math.cos(ang) * rr;
          ty = cy + Math.sin(ang) * rr * 0.42;
        } else {
          tx = p.hx + Math.sin(t * 0.0003 + i) * 30;
          ty = p.hy + Math.cos(t * 0.00025 + i * 1.3) * 30;
        }
        const pull = ctaHot ? 0.014 : 0.004;
        p.vx = (p.vx + (tx - p.x) * pull) * 0.9;
        p.vy = (p.vy + (ty - p.y) * pull) * 0.9;
        p.x += p.vx * k;
        p.y += p.vy * k;
        ctx.globalAlpha = ctaHot ? 0.85 : 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }, '0px');
  }

  const sheet = $('[data-sheet]');
  const openSheet = () => {
    if (!sheet || sheet.open) return;
    sheet.showModal();
    requestAnimationFrame(() => sheet.classList.add('is-in'));
    lenis?.stop();
  };
  const closeSheet = () => {
    if (!sheet?.open) return;
    sheet.classList.remove('is-in');
    setTimeout(() => { sheet.close(); lenis?.start(); }, reduceMotion ? 0 : 600);
  };
  cta?.addEventListener('click', openSheet);
  $('[data-sheet-close]')?.addEventListener('click', closeSheet);
  sheet?.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  sheet?.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  $$('[data-copy]').forEach((b) => {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied ✓'; } catch (err) { b.textContent = 'Copy failed'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1800);
    });
  });

  /* ---------- Scroll-driven choreography, wired up after the first paint ---------- */

  const setupScroll = () => {
    // Hero: letters split apart and fall into depth as you scroll in.
    if (animate && hero) {
      const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true } });
      heroChars.forEach((line, li) => {
        const n = line.length;
        line.forEach((ch, i) => {
          const r1 = Math.random();
          const r2 = Math.random();
          const r3 = Math.random();
          const dir = (i - (n - 1) / 2) / Math.max(1, n - 1);
          const vars = {
            x: () => dir * window.innerWidth * (0.5 + r1 * 0.55),
            y: () => (li === 0 ? -1 : 1) * window.innerHeight * (0.1 + r2 * 0.3),
            scale: 1.6 + r3 * 1.8,
            rotation: (r1 - 0.5) * 28,
            opacity: 0,
            ease: 'power2.in',
            duration: 1,
          };
          // Blur is a desktop luxury; phones get the same motion without it.
          if (finePointer) { gsap.set(ch, { filter: 'blur(0px)' }); vars.filter = 'blur(12px)'; }
          tl.to(ch, vars, 0.03 * Math.abs(i - (n - 1) / 2));
        });
      });
      tl.to('.hero__statement, .hero__meta, .hero__hint', { opacity: 0, y: -40, ease: 'power1.in', duration: 0.5 }, 0)
        .to(heroCanvas, { scale: 1.35, ease: 'none', duration: 1.2 }, 0)
        .to('.hero__floor', { opacity: 0, y: 80, ease: 'none', duration: 0.8 }, 0);
    }

    // Intro: the statement assembles word by word; a few words arrive late on purpose.
    const statement = $('[data-intro-statement]');
    if (animate && statement) {
      const words = $$('.wd', statement);
      const notes = $$('[data-note]');
      if (!narrow()) {
        gsap.set(words, { opacity: 0.06, y: 46, filter: finePointer ? 'blur(10px)' : 'blur(0px)' });
        gsap.set(notes, { opacity: 0, y: 16 });
        const tl = gsap.timeline({ scrollTrigger: { trigger: '.intro', start: 'top 65%', end: 'bottom bottom', scrub: 1 } });
        words.forEach((w, i) => tl.to(w, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }, i * 0.2 + parseFloat(w.dataset.delay || 0)));
        notes.forEach((n, i) => tl.to(n, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1 + i * 0.3));
        tl.to({}, { duration: 0.6 });
      } else {
        gsap.set(words, { opacity: 0, y: 30 });
        gsap.set(notes, { opacity: 0, y: 16 });
        onEnter([statement], () => gsap.to(words, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }), '-15%');
        onEnter(notes, (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }), '-8%');
      }
    }

    // Section titles rise letter by letter; supporting pieces fade up.
    if (animate) {
      $$('[data-split-title]').forEach((el) => {
        const chars = splitTitle(el);
        gsap.set(chars, { yPercent: 110 });
        onEnter([el], () => gsap.to(chars, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.025 }), '-12%');
      });
      const fades = $$('.sec-head .kicker, .sec-sub, .map, .map__chips, .lab__frame, .trait, .brain, .contact .kicker, .contact__links, .cta, .panel--title');
      gsap.set(fades, { opacity: 0, y: 34 });
      onEnter(fades, (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09 }), '-6%');
      const lines = $$('.contact__line');
      gsap.set(lines, { opacity: 0, yPercent: 40 });
      onEnter([$('.contact__title')], () => gsap.to(lines, { opacity: 1, yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12 }), '-10%');
    }

    // Experience: a horizontal film strip on desktop, a native swipe on phones.
    const exp = $('.exp');
    if (exp) {
      const track = $('[data-exp-track]');
      const bar = $('[data-exp-bar]');
      const panels = $$('[data-panel]', exp);
      const light = (p) => {
        if (p.classList.contains('is-on')) return;
        p.classList.add('is-on');
        $$('[data-count]', p).forEach((c) => countUp(c, parseInt(c.dataset.count, 10)));
      };
      if (animate && !narrow()) {
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const setHeight = () => { exp.style.height = `${dist() + window.innerHeight}px`; };
        setHeight();
        ScrollTrigger.addEventListener('refreshInit', setHeight);
        gsap.to(track, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: exp,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
              const x = gsap.getProperty(track, 'x');
              panels.forEach((p) => { if (p.offsetLeft + x < window.innerWidth * 0.72) light(p); });
            },
          },
        });
      } else {
        onEnter(panels, (b) => b.forEach(light), '0%');
      }
    }

    // Case studies: scroll walks through Problem → Architecture → Engineering → Scale → Result.
    cases.forEach(({ kase, steps, nodes, tech, setStep, build, drawRoute, finish }) => {
      if (animate && !narrow()) {
        gsap.set(nodes, { opacity: 0.14, y: 14 });
        gsap.set(tech, { opacity: 0, y: 10 });
        const progress = $('.case__progress span', kase);
        const st = ScrollTrigger.create({
          trigger: kase,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            setStep(Math.min(4, Math.floor(self.progress * 5)));
            progress.style.transform = `scaleX(${self.progress.toFixed(4)})`;
          },
          onToggle: (self) => kase.classList.toggle('is-in', self.isActive),
        });
        $$('[data-goto]', kase).forEach((b) => b.addEventListener('click', () => {
          scrollToY(st.start + ((Number(b.dataset.goto) + 0.5) / 5) * (st.end - st.start));
        }));
        setStep(0);
      } else {
        steps.forEach((s) => s.classList.add('is-active'));
        if (animate) { gsap.set(nodes, { opacity: 0, y: 14 }); gsap.set(tech, { opacity: 0, y: 10 }); }
        onEnter([$('[data-diagram]', kase)], () => {
          build();
          kase.classList.add('is-flowing');
          nodes.forEach((n) => n.classList.add('is-hot'));
          drawRoute();
          finish();
        }, '-20%');
      }
    });

    // How I think: one statement at a time, while the light behind it shifts.
    const think = $('.think');
    if (think) {
      watch(think);
      if (animate) {
        const statements = $$('[data-think]');
        const counter = $('[data-think-n]');
        const blobs = $$('[data-blob]');
        const words = statements.map((s) => splitWords(s));
        gsap.set(words.flat(), { yPercent: 110 });
        const MIX = [[1, 0, 0], [0.3, 1, 0], [0, 0.4, 1], [1, 0.5, 0], [0, 1, 0.8]];
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: think,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1,
            onUpdate: (self) => { counter.textContent = String(Math.min(5, Math.floor(self.progress * 5) + 1)).padStart(2, '0'); },
          },
        });
        statements.forEach((s, i) => {
          const at = i * 2;
          tl.to(words[i], { yPercent: 0, duration: 0.6, ease: 'power3.out', stagger: 0.04 }, at);
          blobs.forEach((b, k) => tl.to(b, { opacity: MIX[i][k], duration: 0.9, ease: 'none' }, at));
          if (i < statements.length - 1) tl.to(words[i], { yPercent: -110, duration: 0.5, ease: 'power3.in', stagger: 0.03 }, at + 1.4);
        });
      }
    }

    // Building what's next: the core powers up, then AI + SYSTEMS + AUTOMATION.
    if (animate && nextSection) {
      const words = $$('[data-next-word]');
      const core = $('[data-core]');
      gsap.set(words, { opacity: 0, y: 50, filter: finePointer ? 'blur(10px)' : 'blur(0px)' });
      gsap.set('[data-next-text]', { opacity: 0, y: 20 });
      gsap.set(core, { scale: 0.7, opacity: 0.25 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: nextSection, start: 'top 60%', end: 'bottom bottom', scrub: 1 } });
      tl.to(core, { scale: 1, opacity: 1, duration: 1.2, ease: 'none' }, 0);
      words.forEach((w, i) => tl.to(w, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out' }, 0.5 + i * 0.35));
      tl.to('[data-next-text]', { opacity: 1, y: 0, duration: 0.5 }, 2.4).to({}, { duration: 0.4 });
    }

    if (animate && document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => ScrollTrigger.refresh());
  };

  if (animate) requestAnimationFrame(() => setTimeout(setupScroll, 0));
  else setupScroll();
})();
