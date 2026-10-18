/* Sainjal Poly — Portfolio v4: "Containers. Both kinds."
   Three.js (3D port + Stack Overflow game), GSAP + ScrollTrigger, Lenis, CSS 3D.
   Progressive: without WebGL or JS the page still reads; reduced motion is respected. */
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
  const narrow = () => window.innerWidth <= 700;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const animate = hasGsap && !reduceMotion;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const COLORS = ['#e76f51', '#2a9d8f', '#264653', '#f4a261', '#e9c46a', '#8ab17d'];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: this visit only */ } },
  };
  // Deterministic randomness, so the port looks the same on every visit.
  const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- One frame loop; each visual runs only while it is on screen ---------- */

  const loops = [];
  const watch = (el, onChange, margin = '100px') => {
    if (!el) return;
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
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) for (const l of loops) if (l.on) l.fn(now / 1000, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // CSS animations pause in sections that are off screen too (.is-offscreen in main.css).
  $$('.ticker, #about, #chain, #galaxy, #voyage, #work, #think, #contact, .footer').forEach((el) => watch(el));

  /* ---------- Day / night ---------- */

  const themeListeners = [];
  const isNight = () => root.getAttribute('data-theme') === 'dark';
  const themeBtn = $('[data-theme-toggle]');
  const syncThemeButton = () => themeBtn?.setAttribute('aria-label', isNight() ? 'Switch to day mode' : 'Switch to night mode');
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121212' : '#fbf6ee');
    store.set('theme', theme);
    syncThemeButton();
    themeListeners.forEach((fn) => fn(theme === 'dark'));
  };
  syncThemeButton();
  themeBtn?.addEventListener('click', () => {
    const next = isNight() ? 'light' : 'dark';
    if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
    const b = themeBtn.getBoundingClientRect();
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(() => applyTheme(next)).ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' });
    });
  });

  /* ---------- Smooth scroll on desktop; phones keep native scrolling ---------- */

  let lenis = null;
  if (animate) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (window.Lenis && !coarse) {
      lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const scrollToEl = (el) => {
    if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: easeInOut });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  /* ---------- Menu, anchors, top bar, progress ship ---------- */

  const menuBtn = $('.menu-btn');
  const menu = $('#menu');
  const setMenu = (open) => {
    if (!menuBtn || root.classList.contains('menu-open') === open) return;
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    if (lenis) (open ? lenis.stop() : lenis.start());
  };
  menuBtn?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  $$('a[href^="#"]:not(.skip)').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    scrollToEl(target);
  }));

  const topbar = $('.topbar');
  const progressLine = $('[data-progress-line]');
  const progressShip = $('[data-progress-ship]');
  let lastY = window.scrollY;
  let scrollQueued = false;
  const onScroll = () => {
    scrollQueued = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? y / max : 0;
    progressLine.style.transform = `scaleX(${p.toFixed(4)})`;
    progressShip.style.left = `${(p * 100).toFixed(2)}%`;
    topbar.classList.toggle('is-scrolled', y > 30);
    if (!root.classList.contains('menu-open')) topbar.classList.toggle('is-hidden', y > lastY && y > innerHeight * 0.8);
    lastY = y;
  };
  window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const navLinks = $$('.nav a');
  $$('#top, #about, #chain, #galaxy, #voyage, #work, #play, #contact').forEach((s) => new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${s.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' }).observe(s));

  /* ---------- Cursor & magnetic buttons ---------- */

  const pointer = { x: -999, y: -999 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  if (finePointer && !reduceMotion) {
    // A real pointer that changes with what it is over: an arrow, a pointing hand on things you can
    // click, a text bar over words, the caret in fields — plus a small badge saying what a click does.
    const cursor = $('.cursor');
    const pos = $('.cursor__pos');
    const badge = $('.cursor__badge');
    const badgePath = $('.cursor__badge path');
    const beam = $('.cursor__beam');
    const ripple = $('.cursor__ripple');
    const ICONS = {
      go: 'M5 12h14M13 6l6 6-6 6',
      prev: 'M19 12H5M11 6l-6 6 6 6',
      out: 'M7 17 17 7M9 7h8v8',
      down: 'M12 5v14M6 13l6 6 6-6',
      up: 'M12 19V5M6 11l6-6 6 6',
      save: 'M12 4v11M7 10l5 5 5-5M5 20h14',
      mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
      play: 'M8 5v14l11-7z',
      spin: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
      grab: 'M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
      box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
      horn: 'M4 10v4h3l5 4V6l-5 4zM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
      zap: 'M13 3 5 14h6l-1 7 8-11h-6z',
      flip: 'M4 9h13l-3-3M20 15H7l3 3',
      drop: 'M7 5l5 5 5-5M7 12l5 5 5-5',
      send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
      slide: 'M8 7l-5 5 5 5M16 7l5 5-5 5M3 12h18',
      sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
      moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
      filter: 'M4 5h16l-6 7v6l-4 2v-8z',
      close: 'M6 6l12 12M18 6 6 18',
      info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 7.5h.01',
    };
    const CAPTION_ICON = { Top: 'up', Download: 'save', Play: 'play', Open: 'out', Flip: 'flip', Spin: 'spin', Drop: 'drop', 'Ship it': 'send', Write: 'mail' };
    // Areas you drag rather than click keep the arrow; everything clickable gets the hand.
    const DRAGGED = new Set(['spin', 'slide', 'grab']);
    const ownText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    const offerOf = (el) => {
      if (el.closest('.is-dragging') || el.querySelector('.is-dragging')) return { shape: 'arrow', icon: 'grab', logo: null };
      const href = el.getAttribute('href') || '';
      let icon = el.dataset.cursorIcon || CAPTION_ICON[el.dataset.cursor || ''] || null;
      let logo = null;
      if (el.matches('[data-theme-toggle]')) icon = isNight() ? 'sun' : 'moon';
      else if (/linkedin\.com/.test(href)) logo = 'linkedin';
      else if (/github\.com/.test(href)) logo = 'github';
      if (!icon && !logo) {
        if (href.startsWith('mailto:')) icon = 'mail';
        else if (el.hasAttribute('download')) icon = 'save';
        else if (href === '#top') icon = 'up';
        else if (href.startsWith('#')) icon = 'down';
        else if (/^https?:/.test(href)) icon = 'out';
        else if (el.matches('[data-deck-prev]')) icon = 'prev';
        else if (el.matches('[data-deck-next]')) icon = 'go';
        else if (el.matches('[data-sheet-close]')) icon = 'close';
        else if (el.matches('[data-filter]')) icon = 'filter';
      }
      return { shape: DRAGGED.has(icon) ? 'arrow' : 'hand', icon: logo ? null : icon, logo };
    };
    const contextOf = (target) => {
      if (!(target instanceof Element)) return { kind: 'pointer', shape: 'arrow' };
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return { kind: 'typing' };
      const el = target.closest('[data-cursor], a, button, [role="button"], summary');
      if (el) return { kind: 'pointer', el, ...offerOf(el) };
      if (ownText(target)) return { kind: 'text', size: clamp(parseFloat(getComputedStyle(target).fontSize) * 1.15, 14, 72) };
      return { kind: 'pointer', shape: 'arrow' };
    };
    let ctx = {};
    let lastTarget = null;
    const apply = (next) => {
      const prevBadge = ctx.kind === 'pointer' ? ctx.logo || ctx.icon : null;
      ctx = next;
      const pointing = next.kind === 'pointer';
      cursor.classList.toggle('is-arrow', pointing && next.shape === 'arrow');
      cursor.classList.toggle('is-hand', pointing && next.shape === 'hand');
      cursor.classList.toggle('is-text', next.kind === 'text');
      cursor.classList.toggle('is-typing', next.kind === 'typing');
      const mark = pointing ? next.logo || next.icon : null;
      cursor.classList.toggle('has-badge', Boolean(mark));
      if (mark && mark !== prevBadge) {
        const logo = next.logo && window.SI?.[next.logo];
        badgePath.setAttribute('d', logo ? logo.d : ICONS[next.icon]);
        badge.classList.toggle('is-logo', Boolean(logo));
        if (prevBadge) { badge.classList.remove('is-pop'); void badge.offsetWidth; badge.classList.add('is-pop'); }
      }
      if (next.kind === 'text') beam.style.setProperty('--bh', `${next.size.toFixed(1)}px`);
    };
    apply({ kind: 'pointer', shape: 'arrow' });
    root.classList.add('has-cursor');
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') cursor.classList.add('is-visible'); }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('pointerover', (e) => { lastTarget = e.target; apply(contextOf(e.target)); });
    themeListeners.push(() => { if (lastTarget) apply(contextOf(lastTarget)); });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      cursor.classList.add('is-down');
      ripple.style.translate = `${e.clientX}px ${e.clientY}px`;
      ripple.classList.remove('is-on');
      void ripple.offsetWidth;
      ripple.classList.add('is-on');
    });
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    // A modal dialog sits in the top layer, above the custom cursor, so the system cursor returns while it is open.
    const sheetEl = $('[data-sheet]');
    if (sheetEl) new MutationObserver(() => root.classList.toggle('has-cursor', !sheetEl.open)).observe(sheetEl, { attributes: true, attributeFilter: ['open'] });
    let px = 0;
    let py = 0;
    let tilt = 0;
    loops.push({ on: true, fn: (t, dt) => {
      // Live areas (the 3D port, the card deck) change what they offer as you move or drag
      if (ctx.el) {
        const offer = offerOf(ctx.el);
        if (offer.shape !== ctx.shape || offer.icon !== ctx.icon || offer.logo !== ctx.logo) apply({ ...ctx, ...offer });
      }
      // The pointer sits exactly on the mouse and leans slightly into fast moves; at rest it does nothing
      const vx = pointer.x - px;
      if (!vx && pointer.y === py && Math.abs(tilt) < 0.01) return;
      px = pointer.x;
      py = pointer.y;
      tilt = lerp(tilt, clamp(vx * 0.5, -9, 9), Math.min(1, 12 * dt));
      pos.style.translate = `${pointer.x}px ${pointer.y}px`;
      pos.style.rotate = `${tilt.toFixed(2)}deg`;
      if (ctx.kind === 'text') beam.style.translate = `${pointer.x}px ${pointer.y}px`;
    } });
    if (animate) {
      $$('[data-magnetic]').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
        el.addEventListener('pointermove', (e) => {
          const b = el.getBoundingClientRect();
          xTo((e.clientX - b.left - b.width / 2) * 0.3);
          yTo((e.clientY - b.top - b.height / 2) * 0.4);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }
  }

  /* ---------- Small helpers ---------- */

  const splitWords = (el) => {
    const words = [];
    const walk = (node) => Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const mask = document.createElement('span');
          const word = document.createElement('span');
          mask.className = 'w'; word.className = 'wi'; word.textContent = part;
          mask.append(word); frag.append(mask); words.push(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    });
    walk(el);
    return words;
  };
  // Chases a target with a little overshoot.
  const spring = (initial, render, k = 0.09, damp = 0.78) => {
    let x = initial; let target = initial; let vel = 0; let raf = 0;
    const tick = () => {
      vel = (vel + (target - x) * k) * damp; x += vel;
      const done = Math.abs(target - x) < 0.01 && Math.abs(vel) < 0.01;
      if (done) { x = target; vel = 0; }
      render(x);
      raf = done ? 0 : requestAnimationFrame(tick);
    };
    return { set(v) { target = v; if (reduceMotion) { x = v; render(x); return; } if (!raf) raf = requestAnimationFrame(tick); } };
  };
  const onEnter = (els, cb, bottom = '-10%') => {
    const io = new IntersectionObserver((entries) => {
      const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target);
      batch.forEach((el) => io.unobserve(el));
      if (batch.length) cb(batch);
    }, { rootMargin: `0px 0px ${bottom} 0px` });
    els.filter(Boolean).forEach((el) => io.observe(el));
  };
  const countUp = (el, to) => {
    if (!animate) { el.textContent = to; return; }
    const v = { n: 0 };
    gsap.to(v, { n: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(v.n); } });
  };
  const toast = (el, html, ms = 3200) => {
    el.innerHTML = html;
    el.classList.add('is-on');
    clearTimeout(el.hideTimer);
    el.hideTimer = setTimeout(() => el.classList.remove('is-on'), ms);
  };
  const iconSvg = (slug) => {
    const icon = window.SI?.[slug];
    if (!icon) return null;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', icon.d);
    svg.dataset.hex = icon.hex;
    svg.append(path);
    return svg;
  };
  // Dark brand marks would vanish at night, so they switch to a light ink.
  const tintIcons = () => $$('svg[data-hex]').forEach((svg) => {
    const hex = svg.dataset.hex;
    const n = parseInt(hex, 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    svg.firstChild.setAttribute('fill', isNight() && lum < 0.3 ? '#e6ebf8' : `#${hex}`);
  });
  themeListeners.push(tintIcons);

  /* ---------- Loader ---------- */

  const boot = $('.boot');
  const bootDone = new Promise((resolve) => {
    if (!boot) { resolve(); return; }
    if (reduceMotion || !hasGsap) { boot.remove(); resolve(); return; }
    if (coarse) boot.style.pointerEvents = 'none';
    else lenis?.stop();
    const pct = $('[data-boot-pct]');
    const text = $('[data-boot-text]');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pct.textContent = '100%';
      text.textContent = 'All aboard!';
      gsap.to(boot, { yPercent: -100, duration: 0.9, ease: 'expo.inOut', delay: 0.25, onComplete: () => { boot.remove(); lenis?.start(); } });
      setTimeout(resolve, 450);
    };
    const v = { n: 0 };
    gsap.to(v, { n: 100, duration: coarse ? 0.9 : 1.2, ease: 'power2.inOut', onUpdate: () => { pct.textContent = `${Math.round(v.n)}%`; } });
    Promise.all([
      document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : null,
      new Promise((r) => setTimeout(r, coarse ? 900 : 1250)),
    ]).then(finish);
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, finish, { once: true, passive: true }));
  });

  /* ---------- Hero intro ---------- */

  const heroName = $('[data-hero-name]');
  const nameChars = [];
  if (heroName) {
    const text = heroName.textContent;
    heroName.textContent = '';
    text.split(' ').forEach((word, wi) => {
      if (wi) heroName.append(' ');
      const w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      Array.from(word).forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.append(s); nameChars.push(s); });
      heroName.append(w);
    });
  }
  if (animate) {
    gsap.set(nameChars, { yPercent: 120, rotate: 12 });
    gsap.set('[data-hero-in]', { opacity: 0, y: 24 });
  }
  bootDone.then(() => {
    if (!animate) return;
    gsap.to(nameChars, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'back.out(1.8)', stagger: 0.045, clearProps: 'transform' });
    gsap.to('[data-hero-in]', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.25 });
  });

  /* ---------- Shared container-stripe texture ---------- */

  const stripeCanvas = () => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let x = 4; x < 128; x += 9) g.fillRect(x, 0, 3, 64);
    g.fillStyle = 'rgba(0, 0, 0, 0.18)'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 60, 128, 4);
    return c;
  };

  // Each 3D scene is built in a task of its own, so the page can paint in between.
  const whenThree = (fn) => {
    const run = () => setTimeout(() => fn(window.THREE), 0);
    if (window.THREE) run();
    else window.addEventListener('three-ready', run, { once: true });
  };
  setTimeout(() => { if (!window.THREE) root.classList.add('no-webgl'); }, 9000);

  /* ---------- HERO sky: a far range and a working coastline, drifting as the port turns ---------- */

  const horizonEl = $('.hero__horizon');
  const rangeSvg = (far) => {
    const W = 1600;
    const H = far ? 200 : 120;
    const r = rng(far ? 5 : 9);
    const ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    const wave = (x, n, p) => Math.sin((x / W) * 6.283 * n + p);
    const ridge = (x) => (far
      ? Math.max(10, 72 + 38 * wave(x, 2, ph[0]) + 26 * wave(x, 5, ph[1]) + 12 * wave(x, 11, ph[2]))
      : 16 + 8 * wave(x, 3, ph[0]) + 5 * wave(x, 8, ph[1]));
    const paths = [];
    let d = `M0 ${H}`;
    for (let x = 0; x <= W; x += far ? 40 : 50) d += `L${x} ${(H - ridge(x) - (x % W ? (r() - 0.5) * (far ? 16 : 4) : 0)).toFixed(1)}`;
    paths.push(`${d}L${W} ${H}Z`);
    if (!far) {
      const rect = (x, y, w, h) => paths.push(`M${x} ${y}h${w}v${h}h${-w}Z`);
      // A small town
      for (let x = 170; x < 430;) {
        const w = 14 + Math.round(r() * 16);
        const h = 18 + Math.round(r() * (x > 250 && x < 350 ? 62 : 34));
        rect(x, H - ridge(x) - h + 4, w, h + 30);
        x += w + 2 + Math.round(r() * 4);
      }
      // A lighthouse
      const lx = 640;
      const base = H - ridge(lx) + 4;
      paths.push(`M${lx - 9} ${base}L${lx - 5} ${base - 62}h10L${lx + 9} ${base}Z`);
      rect(lx - 8, base - 72, 16, 9);
      paths.push(`M${lx - 9} ${base - 72}L${lx} ${base - 82}L${lx + 9} ${base - 72}Z`);
      // Wind turbines
      [860, 935, 1010].forEach((x, i) => {
        const b = H - ridge(x) + 2;
        const top = b - 66 - i * 4;
        rect(x - 1.5, top, 3, b - top + 20);
        [0.3 + i, 2.39 + i, 4.48 + i].forEach((a) => {
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          paths.push(`M${x - dy * 2} ${top + dx * 2}L${(x + dx * 28 - dy * 0.6).toFixed(1)} ${(top + dy * 28 + dx * 0.6).toFixed(1)}L${(x + dx * 28 + dy * 0.6).toFixed(1)} ${(top + dy * 28 - dx * 0.6).toFixed(1)}L${x + dy * 2} ${top - dx * 2}Z`);
        });
      });
      // Ship-to-shore cranes at the far terminal
      [1210, 1300, 1390].forEach((x) => {
        const b = H - ridge(x) + 4;
        rect(x, b - 52, 4, 52);
        rect(x + 26, b - 52, 4, 52);
        rect(x - 34, b - 58, 96, 6);
        rect(x + 22, b - 74, 4, 16);
        paths.push(`M${x + 24} ${b - 74}L${x - 30} ${b - 58}h6L${x + 24} ${b - 70}Z`);
        rect(x + 6, b - 66, 14, 8);
      });
      // Stacked boxes on the quay
      for (let x = 1180; x < 1440; x += 22) rect(x, H - ridge(x) - 8 - Math.round(r() * 2) * 7, 20, 30);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths.map((p) => `<path d="${p}"/>`).join('')}</svg>`;
  };
  const ranges = $$('[data-range]').map((el) => ({ el, far: el.dataset.range === 'far', tile: 0 }));
  ranges.forEach((rg) => {
    rg.el.style.setProperty('--range', `url("data:image/svg+xml,${encodeURIComponent(rangeSvg(rg.far))}")`);
    rg.el.classList.add('is-drawn');
  });
  const sizeRanges = () => ranges.forEach((rg) => {
    rg.tile = rg.el.offsetHeight * (rg.far ? 8 : 1600 / 120);
    rg.el.style.setProperty('--tile', `${rg.tile.toFixed(1)}px`);
  });
  sizeRanges();
  window.addEventListener('resize', sizeRanges);
  let skyTheta = NaN;
  let skyY = NaN;
  // Far land shifts slower than the near shore, so turning the port turns the world.
  const skyDrift = (theta) => {
    if (Math.abs(theta - skyTheta) < 0.0004) return;
    skyTheta = theta;
    ranges.forEach((rg) => {
      if (!rg.tile) return;
      // Whole pixels only: the land drifts a few pixels a second, so most frames need no update at all.
      const x = Math.round(-((((theta * (rg.far ? 130 : 300)) % rg.tile) + rg.tile) % rg.tile));
      if (x === rg.x) return;
      rg.x = x;
      rg.el.style.transform = `translate3d(${x}px, 0, 0)`;
    });
  };
  const skyHorizon = (y) => {
    if (!horizonEl || Math.abs(y - skyY) < 0.5) return;
    skyY = y;
    horizonEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  };

  /* ---------- HERO: an intermodal container port in 3D ---------- */

  const PORT_TECH = [
    ['Java', 'Backend', 'My first language — and still my daily driver.'],
    ['Spring Boot', 'Backend', 'The backbone of nearly every service I’ve shipped.'],
    ['Spring Security', 'Backend', 'Logins, tokens and who may do what.'],
    ['Hibernate / JPA', 'Backend', 'Objects in, tables out — tuned for big data sets.'],
    ['REST APIs', 'Integration', 'Clean contracts between systems and partners.'],
    ['Microservices', 'Architecture', 'Small services, clear boundaries, independent deploys.'],
    ['Event-driven', 'Architecture', 'Something happens, the right systems react.'],
    ['RBAC', 'Security', 'Roles and permissions, right down to the field.'],
    ['PostgreSQL', 'Data', 'Reliable relational storage, carefully indexed.'],
    ['Elasticsearch', 'Search', 'Fast search and filters across large data sets.'],
    ['Apache Solr', 'Search', 'Full-text search for the classic stack.'],
    ['MSSQL', 'Data', 'Enterprise data, stored procedures and all.'],
    ['Memcache / Redis', 'Caching', 'Hot data kept close, so screens fly.'],
    ['Google Cloud', 'Cloud', 'Where the cloud-native platforms live.'],
    ['Cloud Run', 'Cloud', 'Serverless containers that scale on demand.'],
    ['Pub/Sub', 'Messaging', 'Messages between services, at any volume.'],
    ['BigQuery', 'Analytics', 'Analytics across the whole operation.'],
    ['Docker', 'Containers · the software kind', 'The other kind of container. I ship those too.'],
    ['Kubernetes', 'Orchestration', 'A crane for software containers.'],
    ['Jenkins', 'CI/CD', 'Build, test, deploy — on repeat.'],
    ['GitHub Actions', 'CI/CD', 'Pipelines that live right next to the code.'],
    ['GitLab CI', 'CI/CD', 'From commit to production, automatically.'],
    ['Maven', 'Build', 'Builds, dependencies and multi-module projects.'],
    ['System design', 'Practice', 'Boxes and arrows that hold up in production.'],
    ['Distributed systems', 'Architecture', 'Many machines, behaving like one.'],
    ['Domain-driven design', 'Architecture', 'Code that speaks the language of logistics.'],
    ['Caching', 'Performance', 'The fastest query is the one you never run.'],
    ['Code review', 'Practice', 'Better code, shared knowledge, fewer surprises.'],
    ['Data structures', 'Foundations', 'The right structure makes the hard part easy.'],
    ['Algorithms', 'Foundations', 'Routing, planning and the maths behind them.'],
    ['Design docs', 'Practice', 'Write it down, agree, then build.'],
    ['GenAI & LLMs', 'Next port', 'The next port of call.'],
  ];
  const TECH_SLUG = {
    Java: 'openjdk', 'Spring Boot': 'springboot', 'Spring Security': 'springsecurity', 'Hibernate / JPA': 'hibernate', 'REST APIs': 'openapiinitiative',
    PostgreSQL: 'postgresql', Elasticsearch: 'elasticsearch', 'Apache Solr': 'apachesolr', 'Memcache / Redis': 'redis', 'Google Cloud': 'googlecloud',
    'Cloud Run': 'googlecloud', 'Pub/Sub': 'googlepubsub', BigQuery: 'googlebigquery', Docker: 'docker', Kubernetes: 'kubernetes', Jenkins: 'jenkins',
    'GitHub Actions': 'githubactions', 'GitLab CI': 'gitlab', Maven: 'apachemaven',
  };
  const MODE_TIPS = {
    train: ['Rail', 'Intermodal train on the causeway'],
    shunter: ['Shunting', 'Yard moves on the siding'],
    truck: ['Truck', 'Pre- and on-carriage'],
    barge: ['Barge', 'Inland waterways'],
    vessel: ['Deep sea', 'Vessel at the berth'],
    crane: ['Port', 'Quay crane · load & discharge'],
    depot: ['Depot', 'Empties, storage & repairs'],
  };

  // What the cursor offers on each vehicle in the port
  const NUDGES = {
    train: ['Toot!', 'horn'], shunter: ['Toot!', 'horn'], truck: ['Honk!', 'horn'], barge: ['Hoot!', 'horn'],
    vessel: ['Sound the horn', 'horn'], crane: ['Nudge the crane', 'zap'], depot: ['Shake it', 'zap'],
  };

  const buildPort = (THREE) => {
    const canvas = $('[data-port]');
    const hero = $('.hero');
    if (!canvas) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { root.classList.add('no-webgl'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    // Distance fades things out to transparent rather than to a colour: the far sea melts into the sky painted behind the canvas.
    THREE.ShaderChunk.fog_fragment = [
      '#ifdef USE_FOG',
      '  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );',
      '  #ifdef OPAQUE',
      '    gl_FragColor *= 1.0 - fogFactor;',
      '  #else',
      '    gl_FragColor.a *= 1.0 - fogFactor;',
      '  #endif',
      '#endif',
    ].join('\n');
    scene.fog = new THREE.Fog(0xfbe3cc, 55, 135);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
    const world = new THREE.Group();
    scene.add(world);
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
    const cast = (m) => { m.castShadow = !coarse; return m; };
    const stripes = new THREE.CanvasTexture(stripeCanvas());
    stripes.colorSpace = THREE.SRGBColorSpace;
    const boxGeo = new THREE.BoxGeometry(2.0, 0.86, 0.86);
    const boxMat = (c) => std(c, { map: stripes, roughness: 0.55, metalness: 0.12 });
    const ease = (x) => x * x * (3 - 2 * clamp(x, 0, 1));
    const seg01 = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
    const vehicles = [];
    const tag = (obj, key) => { obj.userData.tip = key; obj.userData.kick = 0; vehicles.push(obj); return obj; };
    let dirty = true;

    // Warm light
    const hemi = new THREE.HemisphereLight(0xfff0e0, 0xa89a8a, 1.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1e0, 2.4);
    sun.position.set(18, 30, 12);
    sun.castShadow = !coarse;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 110 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // A teal, low-poly sea
    // The waves run on the GPU: a vertex shader lifts the sea, and flat shading takes its facets
    // from screen-space derivatives, so the CPU never touches a vertex.
    const seg = coarse ? 32 : 48;
    const waterGeo = new THREE.PlaneGeometry(160, 160, seg, seg);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = std(0x3aa597, { flatShading: true, roughness: 0.32, metalness: 0.08 });
    const waveTime = { value: 0 };
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaveTime = waveTime;
      shader.vertexShader = `uniform float uWaveTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'transformed.y += sin(position.x * 0.3 + uWaveTime * 0.9) * 0.2 + cos(position.z * 0.27 + uWaveTime * 0.7) * 0.17 + sin((position.x + position.z) * 0.55 + uWaveTime * 1.5) * 0.05;',
      ].join('\n'));
    };
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.7;
    water.receiveShadow = !coarse;
    water.frustumCulled = false;
    world.add(water);
    const waves = (t) => { waveTime.value = t; };

    // The terminal: apron, quay edge, safety lines, lane markings
    const islandMat = std(0xefe6da, { roughness: 0.88 });
    const island = new THREE.Mesh(new THREE.BoxGeometry(17, 1.4, 11.5), islandMat);
    island.position.y = -0.7;
    island.receiveShadow = !coarse;
    world.add(island);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(17.5, 1.1, 12), std(0x7d7268, { roughness: 0.9 }));
    edge.position.y = -1.05;
    world.add(edge);
    const lineMat = std(0xe9c46a, { roughness: 0.5 });
    [5.6, -5.62].forEach((z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.04, 0.14), lineMat); m.position.set(0, 0.02, z); world.add(m); });
    const dummy = new THREE.Object3D();

    // Shared vehicle parts
    const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 14);
    wheelGeo.rotateX(Math.PI / 2);
    const railWheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12);
    railWheelGeo.rotateX(Math.PI / 2);
    const tyreMat = std(0x1f1d1b, { roughness: 0.9 });
    const steelMat = std(0x55504a, { metalness: 0.6, roughness: 0.4 });
    const darkMat = std(0x2b2724);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x23323a, roughness: 0.15, metalness: 0.5 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe2a0, emissiveIntensity: 0.2 });
    const box3 = (w, h, d, x, y, z, mat, parent) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); parent.add(m); return m; };

    // Container branding: a logo and a name on each side, drawn into one texture atlas
    const ATLAS_C = 4;
    const ATLAS_R = 8;
    const CELL_W = coarse ? 256 : 512;
    const CELL_H = CELL_W / 4;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = CELL_W * ATLAS_C;
    atlasCanvas.height = CELL_H * ATLAS_R;
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const drawAtlas = () => {
      const g = atlasCanvas.getContext('2d');
      g.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
      g.fillStyle = '#ffffff';
      PORT_TECH.forEach(([name], i) => {
        const cx = (i % ATLAS_C) * CELL_W;
        const cy = Math.floor(i / ATLAS_C) * CELL_H;
        const pad = CELL_H * 0.16;
        let x = cx + pad;
        const icon = window.SI?.[TECH_SLUG[name]];
        if (icon) {
          const s = (CELL_H * 0.62) / 24;
          g.save();
          g.translate(x, cy + CELL_H * 0.19);
          g.scale(s, s);
          g.fill(new Path2D(icon.d));
          g.restore();
          x += CELL_H * 0.62 + pad * 0.8;
        }
        const label = name.toUpperCase();
        let size = CELL_H * 0.42;
        g.font = `800 ${size}px "Bricolage Grotesque", "Inter", system-ui, sans-serif`;
        const room = cx + CELL_W - pad - x;
        const w = g.measureText(label).width;
        if (w > room) { size *= room / w; g.font = `800 ${size}px "Bricolage Grotesque", "Inter", system-ui, sans-serif`; }
        g.textBaseline = 'middle';
        g.fillText(label, x, cy + CELL_H * 0.52);
      });
      atlas.needsUpdate = true;
      dirty = true;
    };
    // Drawn once the display font is in; the labels stay hidden until the boxes land anyway.
    if (!document.fonts || document.fonts.status === 'loaded') drawAtlas();
    else document.fonts.ready.then(drawAtlas);
    const labelLight = new THREE.MeshStandardMaterial({ map: atlas, transparent: true, alphaTest: 0.25, roughness: 0.6 });
    const labelDark = new THREE.MeshStandardMaterial({ map: atlas, color: 0x2a2520, transparent: true, alphaTest: 0.25, roughness: 0.6 });
    const labelGeo = (cell) => {
      const geo = new THREE.PlaneGeometry(1.84, 0.46);
      const uv = geo.attributes.uv;
      const col = cell % ATLAS_C;
      const row = Math.floor(cell / ATLAS_C);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / ATLAS_C, 1 - (row + 1 - uv.getY(i)) / ATLAS_R);
      return geo;
    };
    const lightOf = (hex) => { const c = new THREE.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.55; };
    // Both long sides of a container, as one group that can follow it around
    const brand = (cell, boxColor, scaleX = 1) => {
      const g = new THREE.Group();
      const geo = labelGeo(cell);
      const mat = lightOf(boxColor) ? labelDark : labelLight;
      [1, -1].forEach((side) => {
        const p = new THREE.Mesh(geo, mat);
        p.position.z = side * 0.434;
        p.rotation.y = side > 0 ? 0 : Math.PI;
        p.scale.x = scaleX;
        g.add(p);
      });
      return g;
    };

    // Roads: a two-lane road bridge from the mainland, through the terminal, around a turning loop
    const asphalt = std(0x3b3835, { roughness: 0.95 });
    const roadStrip = (w, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 1.6), asphalt); m.position.set(x, 0.016, z); m.receiveShadow = !coarse; world.add(m); };
    roadStrip(14.6, -1.45, -0.7);
    const roadBridge = new THREE.Mesh(new THREE.BoxGeometry(62, 0.8, 2.1), std(0xb8aa96, { roughness: 0.95 }));
    roadBridge.position.set(-39.7, -0.4, -0.7);
    roadBridge.receiveShadow = !coarse;
    world.add(roadBridge);
    roadStrip(62, -39.7, -0.7);
    const loopRoad = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.03, 40), asphalt);
    loopRoad.position.set(7.1, 0.016, -0.7);
    loopRoad.receiveShadow = !coarse;
    const loopGrass = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.14, 32), std(0x8ab17d, { roughness: 0.9 }));
    loopGrass.position.set(7.1, 0.07, -0.7);
    const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), std(0x6d9a5f, { flatShading: true }));
    tree.position.set(7.1, 0.5, -0.7);
    world.add(loopRoad, loopGrass, cast(tree));
    const dashCount = Math.round((5.2 + 70) / 1.1);
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.035, 0.06), std(0xf6eee2, { roughness: 0.6 }), dashCount);
    for (let i = 0; i < dashCount; i++) { dummy.position.set(-70 + i * 1.1, 0.034, -0.7); dummy.updateMatrix(); dashes.setMatrixAt(i, dummy.matrix); }
    world.add(dashes);
    // The trucks' route: in on one lane, round the loop, out on the other
    const R = 0.95;
    const loopPts = [-2.5, -1.7, -0.85, 0, 0.85, 1.7, 2.5].map((a) => new THREE.Vector3(7.1 + Math.cos(a) * R, 0, -0.7 + Math.sin(a) * R));
    const truckRoute = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-72, 0, -1.08), new THREE.Vector3(-20, 0, -1.08), new THREE.Vector3(4.6, 0, -1.08),
      ...loopPts,
      new THREE.Vector3(4.6, 0, -0.32), new THREE.Vector3(-20, 0, -0.32), new THREE.Vector3(-72, 0, -0.32),
    ], false, 'centripetal');
    const routeLen = truckRoute.getLength();

    // Rail: a causeway behind the terminal, plus a siding on it
    const railMat = std(0x6b5f55, { metalness: 0.5, roughness: 0.4 });
    const causeway = new THREE.Mesh(new THREE.BoxGeometry(120, 0.9, 1.9), std(0xb8aa96, { roughness: 0.95 }));
    causeway.position.set(0, -0.35, -7.05);
    causeway.receiveShadow = !coarse;
    world.add(causeway);
    const railPair = (x0, len, z, y) => [z - 0.29, z + 0.29].forEach((rz) => { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), railMat); r.position.set(x0, y, rz); world.add(r); });
    railPair(0, 120, -7.05, 0.15);
    railPair(-1.2, 14, -5.0, 0.05);
    const sleeperCount = coarse ? 90 : 150;
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.95), std(0x7a6a5a), sleeperCount);
    for (let i = 0; i < sleeperCount; i++) {
      dummy.position.set(-60 + i * (120 / sleeperCount), 0.09, -7.05);
      dummy.updateMatrix();
      sleepers.setMatrixAt(i, dummy.matrix);
    }
    world.add(sleepers);

    const bogie = (x, parent, wheels) => {
      box3(0.72, 0.14, 0.62, x, 0.26, 0, darkMat, parent);
      if (coarse) return;
      [-0.22, 0.22].forEach((dx) => [-0.34, 0.34].forEach((z) => {
        const w = new THREE.Mesh(railWheelGeo, steelMat);
        w.position.set(x + dx, 0.18, z);
        parent.add(w);
        wheels.push(w);
      }));
    };
    const trainWheels = [];
    const wagon = (len, color, cell, wheels) => {
      const g = new THREE.Group();
      box3(len + 0.2, 0.12, 0.8, 0, 0.38, 0, darkMat, g);
      bogie(-len * 0.34, g, wheels);
      bogie(len * 0.34, g, wheels);
      const box = cast(new THREE.Mesh(boxGeo, boxMat(color)));
      box.scale.x = len / 2;
      box.position.y = 0.87;
      g.add(box);
      if (cell >= 0) { const b = brand(cell, color, len / 2); b.position.y = 0.87; g.add(b); }
      return g;
    };
    const locomotive = (bodyColor, accent, wheels, len = 3) => {
      const g = new THREE.Group();
      box3(len, 0.16, 0.86, 0, 0.38, 0, darkMat, g);
      box3(len - 0.75, 0.62, 0.86, -0.3, 0.76, 0, std(bodyColor), g);
      box3(len - 0.74, 0.1, 0.88, -0.3, 0.6, 0, std(accent), g);
      box3(0.74, 0.86, 0.9, len / 2 - 0.42, 0.87, 0, std(accent), g);
      box3(0.26, 0.42, 0.84, len / 2 + 0.02, 0.62, 0, std(accent), g);
      box3(0.04, 0.26, 0.72, len / 2 - 0.04, 1.05, 0, glassMat, g);
      box3(0.42, 0.22, 0.92, len / 2 - 0.42, 1.05, 0, glassMat, g);
      box3(len - 0.9, 0.08, 0.66, -0.35, 1.11, 0, steelMat, g);
      [-0.9, -0.3].forEach((x) => { const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), darkMat); fan.position.set(x, 1.17, 0); g.add(fan); });
      box3(0.03, 0.08, 0.16, len / 2 + 0.16, 0.66, 0, lampMat, g);
      bogie(-len * 0.3, g, wheels);
      bogie(len * 0.3, g, wheels);
      return g;
    };
    const train = new THREE.Group();
    train.add(locomotive(0xf6eee2, 0xe76f51, trainWheels));
    const tRand = rng(19);
    for (let i = 0; i < 6; i++) {
      const color = COLORS[Math.floor(tRand() * COLORS.length)];
      const w = wagon(2.4, color, i, trainWheels);
      w.position.x = -1.5 - 1.45 - i * 2.75;
      train.add(w);
    }
    train.position.set(-40, 0.1, -7.05);
    world.add(tag(train, 'train'));

    const shunterWheels = [];
    const shunter = new THREE.Group();
    const sLoco = locomotive(0xe9c46a, 0x264653, shunterWheels, 2.2);
    shunter.add(sLoco);
    [0, 1].forEach((i) => {
      const color = COLORS[(i * 3 + 1) % 6];
      const w = wagon(2, color, 12 + i * 5, shunterWheels);
      w.position.set(-2.35 - i * 2.35, 0, 0);
      shunter.add(w);
    });
    shunter.position.set(-1, -0.05, -5.0);
    world.add(tag(shunter, 'shunter'));

    // The yard: every stack's top box carries a technology
    const rand = rng(42);
    const stacks = [];
    const ROWS = [-3.9, -2.95, -2.0, 0.6, 1.55, 2.5];
    const COLS = [-6.3, -4.1, -1.9, 0.3, 2.5, 4.7];
    let techIdx = 0;
    ROWS.forEach((z) => COLS.forEach((x) => {
      const h = 1 + Math.floor(rand() * 3);
      stacks.push({ x: x + (rand() - 0.5) * 0.1, z, h, tech: PORT_TECH[techIdx++ % PORT_TECH.length] });
    }));
    const total = stacks.reduce((n, st) => n + st.h, 0);
    const boxes = new THREE.InstancedMesh(boxGeo, std(0xffffff, { map: stripes, roughness: 0.55, metalness: 0.12 }), total);
    boxes.castShadow = !coarse;
    boxes.receiveShadow = !coarse;
    boxes.frustumCulled = false;
    // Boxes start parked out of sight, so give raycasting fixed bounds that cover the whole yard.
    boxes.boundingSphere = new THREE.Sphere(new THREE.Vector3(-0.8, 3, -0.7), 16);
    const inst = [];
    const tmpColor = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    stacks.forEach((st, si) => {
      st.ids = [];
      for (let lvl = 0; lvl < st.h; lvl++) {
        const color = new THREE.Color(COLORS[Math.floor(rand() * COLORS.length)]);
        const id = inst.length;
        const dist = Math.hypot(st.x + 1, st.z);
        inst.push({ si, lvl, color, lift: 0, vy: 0, jump: 0, spin: 0, spinV: 0, drop: 0, dvy: 0, sq: 0, start: dist * 0.11 + lvl * 0.16 + rand() * 0.12, live: !animate });
        boxes.setColorAt(id, color);
        st.ids.push(id);
      }
    });
    const placeInstance = (id) => {
      const it = inst[id];
      const st = stacks[it.si];
      if (!it.live) {
        dummy.position.set(st.x, -50, st.z);
        dummy.scale.setScalar(0.0001);
      } else {
        dummy.position.set(st.x, 0.43 + it.lvl * 0.88 + it.lift + it.jump + it.drop, st.z);
        dummy.scale.set(1 + it.sq * 0.12, 1 - it.sq * 0.22, 1 + it.sq * 0.12);
      }
      dummy.rotation.set(0, it.spin, 0);
      dummy.updateMatrix();
      boxes.setMatrixAt(id, dummy.matrix);
    };
    stacks.forEach((st) => {
      const top = inst[st.ids[st.ids.length - 1]];
      st.label = brand(PORT_TECH.indexOf(st.tech), '#' + top.color.getHexString());
      st.label.visible = !animate;
      world.add(st.label);
    });
    const placeLabels = () => stacks.forEach((st) => {
      const it = inst[st.ids[st.ids.length - 1]];
      st.label.visible = it.live;
      st.label.position.set(st.x, 0.43 + it.lvl * 0.88 + it.lift + it.jump + it.drop, st.z);
      st.label.rotation.y = it.spin;
      st.label.scale.set(1 + it.sq * 0.12, 1 - it.sq * 0.22, 1 + it.sq * 0.12);
    });
    inst.forEach((_, id) => placeInstance(id));
    placeLabels();
    boxes.instanceMatrix.needsUpdate = true;
    world.add(boxes);

    // Containers rain into the yard, wave by wave, once the loader is gone.
    let introAt = -1;
    bootDone.then(() => { if (!animate) return; introAt = performance.now() / 1000 + 0.2; inst.forEach((it) => { it.drop = 10 + it.lvl * 0.6; it.dvy = 0; }); });

    // Trucks: tractor units with trailers, driving the road loop
    const makeTruck = (color, boxColor) => {
      const g = new THREE.Group();
      const wheels = [];
      const paint = std(color, { roughness: 0.45, metalness: 0.2 });
      box3(2.95, 0.12, 0.6, 0.12, 0.31, 0, darkMat, g);
      box3(0.62, 0.64, 0.78, 1.18, 0.66, 0, paint, g);
      box3(0.44, 0.2, 0.74, 1.06, 1.08, 0, paint, g);
      box3(0.03, 0.26, 0.66, 1.5, 0.78, 0, glassMat, g);
      box3(0.3, 0.2, 0.8, 1.3, 0.78, 0, glassMat, g);
      box3(0.08, 0.14, 0.8, 1.52, 0.34, 0, darkMat, g);
      [-0.27, 0.27].forEach((z) => box3(0.03, 0.08, 0.14, 1.565, 0.44, z, lampMat, g));
      [-0.34, 0.34].forEach((z) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), steelMat); s.position.set(0.86, 0.98, z); g.add(s); });
      box3(2.22, 0.1, 0.82, -0.36, 0.43, 0, darkMat, g);
      const box = cast(new THREE.Mesh(boxGeo, boxMat(boxColor)));
      box.scale.set(1.05, 1, 0.95);
      box.position.set(-0.36, 0.91, 0);
      g.add(box);
      [[1.2, 0.36], [0.62, 0.36], [-1.05, 0.36], [-1.4, 0.36]].forEach(([x, z]) => [z, -z].forEach((zz) => {
        const w = new THREE.Mesh(wheelGeo, tyreMat);
        w.position.set(x, 0.17, zz);
        g.add(w);
        wheels.push(w);
      }));
      world.add(tag(g, 'truck'));
      return g;
    };
    const trucks = [makeTruck(0xe76f51, COLORS[1]), makeTruck(0x2a9d8f, COLORS[4]), makeTruck(0xf6eee2, COLORS[0])];
    trucks.forEach((tr, i) => { tr.userData.u = i / trucks.length; });

    // A depot of empties with its office
    const depot = new THREE.Group();
    const office = cast(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.5), std(0xf6eee2)));
    office.position.set(7.4, 0.55, -3.6);
    const roof = cast(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.7), std(0xe76f51)));
    roof.position.set(7.4, 1.17, -3.6);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x3b4a52, emissive: 0xffc27a, emissiveIntensity: 0 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.02), windowMat);
    win.position.set(7.4, 0.7, -2.84);
    depot.add(office, roof, win);
    [[7.0, 1.75], [7.95, 1.75], [7.0, 3.9], [7.95, 3.9]].forEach(([x, z], i) => {
      for (let l = 0; l < (i % 3 === 0 ? 2 : 1); l++) {
        const e = cast(new THREE.Mesh(boxGeo, boxMat(i % 2 ? 0xcfc4b4 : 0xb9ad9b)));
        e.rotation.y = Math.PI / 2;
        e.position.set(x, 0.43 + l * 0.88, z);
        depot.add(e);
      }
    });
    world.add(tag(depot, 'depot'));

    // Lamp posts, warm at night
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffb45e, emissiveIntensity: 0 });
    [[-8.1, -5.45], [8.1, -5.45], [-8.1, 5.45], [8.1, 5.45], [-0.6, -5.45]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), std(0x6b625a));
      pole.position.set(x, 1.6, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bulbMat);
      bulb.position.set(x, 3.25, z);
      world.add(pole, bulb);
    });

    // A vessel at the berth
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-7.6, -1.45); hullShape.lineTo(5.8, -1.45); hullShape.quadraticCurveTo(8.3, 0, 5.8, 1.45); hullShape.lineTo(-7.6, 1.45); hullShape.lineTo(-7.6, -1.45);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.5, bevelEnabled: false });
    hullGeo.rotateX(-Math.PI / 2);
    const vessel = new THREE.Group();
    const hull = cast(new THREE.Mesh(hullGeo, std(0x264653, { roughness: 0.6 })));
    hull.position.y = -0.9;
    const band = new THREE.Mesh(hullGeo, std(0xe76f51));
    band.scale.set(1.004, 0.18, 1.02);
    band.position.y = -0.95;
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf6eee2, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.7 });
    const bridge = cast(new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 2.5), bridgeMat));
    bridge.position.set(-6.6, 1.75, 0);
    const funnel = cast(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.8), std(0xe76f51)));
    funnel.position.set(-7.0, 3.2, 0);
    vessel.add(hull, band, bridge, funnel);
    const dRand = rng(7);
    const deckSpots = [];
    [-4.6, -2.5, -0.4, 1.7, 3.8].forEach((x) => [-0.95, 0, 0.95].forEach((z) => {
      const tiers = Math.floor(dRand() * 3.4);
      for (let l = 0; l < tiers; l++) deckSpots.push([x, 0.6 + 0.43 + l * 0.88, z, COLORS[Math.floor(dRand() * 6)]]);
    }));
    const deck = new THREE.InstancedMesh(boxGeo, std(0xffffff, { map: stripes, roughness: 0.55 }), deckSpots.length);
    deck.castShadow = !coarse;
    deckSpots.forEach(([x, y, z, c], i) => { dummy.position.set(x, y, z); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); deck.setMatrixAt(i, dummy.matrix); deck.setColorAt(i, new THREE.Color(c)); });
    vessel.add(deck);
    vessel.position.set(0.2, 0, 10.6);
    world.add(tag(vessel, 'vessel'));

    // An inland barge passing by
    const barge = new THREE.Group();
    const bHull = cast(new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.55, 2.2), std(0x3c3833)));
    bHull.position.y = -0.3;
    const bHouse = cast(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.6), std(0xf6eee2)));
    bHouse.position.set(-3.6, 0.45, 0);
    barge.add(bHull, bHouse);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const c = cast(new THREE.Mesh(boxGeo, boxMat(COLORS[(i + j * 2 + 2) % 6])));
      c.position.set(-1.6 + i * 2.1, 0.4, -0.47 + j * 0.94);
      barge.add(c);
    }
    barge.position.set(0, 0, 19);
    world.add(tag(barge, 'barge'));

    // The quay crane, really working the ship
    const craneMat = std(0xe76f51, { roughness: 0.5, metalness: 0.15 });
    const crane = new THREE.Group();
    const part = (w, h, d, x, y, z, mat = craneMat) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); crane.add(m); return m; };
    [[-1.3, 4.3], [1.3, 4.3], [-1.3, 6.3], [1.3, 6.3]].forEach(([x, z]) => part(0.26, 6.2, 0.26, x, 3.1, z));
    part(2.9, 0.3, 0.3, 0, 6.2, 4.3); part(2.9, 0.3, 0.3, 0, 6.2, 6.3); part(2.9, 0.3, 0.3, 0, 2.2, 4.3); part(2.9, 0.3, 0.3, 0, 2.2, 6.3);
    part(0.34, 0.34, 11.4, -0.5, 6.6, 7.0); part(0.34, 0.34, 11.4, 0.5, 6.6, 7.0);
    part(1.7, 0.9, 1.5, 0, 7.25, 5.3, std(0xf6eee2));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3a2a, emissiveIntensity: 0.4 }));
    beacon.position.set(0, 7.85, 5.3);
    crane.add(beacon);
    const trolley = part(1.3, 0.35, 0.8, 0, 6.25, 3.6, darkMat);
    const cable = part(0.05, 1, 0.05, 0, 5, 3.6, darkMat);
    const spreader = part(2.1, 0.12, 0.9, 0, 5.8, 3.6, darkMat);
    const carried = cast(new THREE.Mesh(boxGeo, boxMat(COLORS[0])));
    [trolley, cable, spreader, carried, beacon].forEach((m) => { m.userData.keep = true; });
    carried.visible = false;
    crane.add(carried);
    world.add(tag(crane, 'crane'));
    const SLOTS = [-5.6, -3.3, -1.0, 1.3, 3.6];
    const quay = SLOTS.map((x, i) => {
      const m = cast(new THREE.Mesh(boxGeo, boxMat(COLORS[(i * 2 + 1) % 6])));
      m.position.set(x, 0.43, 3.6);
      m.visible = false;
      m.userData.keep = true;
      world.add(m);
      return m;
    });
    const CYCLE = 7.6;
    const LAND_Z = 3.6;
    const SEA_Z = 10.6;
    const HIGH = 5.8;
    const SHIP_Y = 2.75;
    const LAND_Y = 0.93;
    const workCrane = (t) => {
      const n = SLOTS.length;
      const cycleT = t % (CYCLE * n);
      const slot = Math.floor(cycleT / CYCLE);
      const u = cycleT - slot * CYCLE;
      const fromX = SLOTS[(slot - 1 + n) % n];
      crane.position.x = lerp(fromX, SLOTS[slot], ease(seg01(u, 0, 1.8)));
      let z = LAND_Z;
      let y = HIGH;
      if (u >= 1.8 && u < 2.8) z = lerp(LAND_Z, SEA_Z, ease(seg01(u, 1.8, 2.8)));
      else if (u >= 2.8 && u < 4.6) z = SEA_Z;
      else if (u >= 4.6 && u < 5.6) z = lerp(SEA_Z, LAND_Z, ease(seg01(u, 4.6, 5.6)));
      if (u >= 2.8 && u < 3.8) y = lerp(HIGH, SHIP_Y, ease(seg01(u, 2.8, 3.6)));
      else if (u >= 3.8 && u < 4.6) y = lerp(SHIP_Y, HIGH, ease(seg01(u, 3.8, 4.6)));
      else if (u >= 5.6 && u < 6.6) y = lerp(HIGH, LAND_Y, ease(seg01(u, 5.6, 6.4)));
      else if (u >= 6.6) y = lerp(LAND_Y, HIGH, ease(seg01(u, 6.6, 7.6)));
      trolley.position.z = z;
      spreader.position.set(0, y, z);
      cable.scale.y = Math.max(0.1, 6.15 - y);
      cable.position.set(0, (6.15 + y) / 2, z);
      carried.visible = u >= 3.65 && u < 6.5;
      if (carried.visible) { carried.material.color.copy(quay[slot].material.color); carried.position.set(0, y - 0.5, z); }
      quay.forEach((q, i) => {
        // Boxes land on the quay one per slot; a new round clears them away.
        const placed = i < slot || (i === slot && u >= 6.5);
        q.visible = placed || (slot === 0 && u < 0.6);
        if (slot === 0 && u < 0.6) q.scale.setScalar(Math.max(0.001, 1 - u / 0.6));
        else q.scale.setScalar(1);
        q.position.y = 0.43 + (i === slot && u >= 6.5 && u < 6.9 ? Math.sin(seg01(u, 6.5, 6.9) * Math.PI) * 0.12 : 0);
      });
    };

    // Clouds by day, stars by night
    const clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.95 });
    const cRand = rng(3);
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + cRand() * 0.7, 0), cloudMat);
        puff.position.set(j * 1.2 - 1.2, cRand() * 0.4, cRand() * 0.6);
        c.add(puff);
      }
      c.position.set(-34 + i * 13 + cRand() * 4, 19 + cRand() * 6, -34 + cRand() * 16);
      c.userData.speed = 0.4 + cRand() * 0.5;
      clouds.add(c);
    }
    scene.add(clouds);
    const starPos = new Float32Array(600 * 3);
    const sRand = rng(11);
    for (let i = 0; i < 600; i++) {
      const th = sRand() * Math.PI * 2;
      const ph = sRand() * 0.45 * Math.PI;
      starPos[i * 3] = Math.cos(th) * Math.sin(ph) * 130;
      starPos[i * 3 + 1] = Math.cos(ph) * 85 + 10;
      starPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * 130;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6e8, size: 0.45, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(stars);

    // Fewer draw calls: parts that never move on their own are baked into one mesh per material,
    // inside whatever does move (a train, a truck, a label), so each object costs a handful of draws.
    [islandMat, windowMat, bulbMat, bridgeMat, lampMat, cloudMat].forEach((m) => { m.userData.live = true; });
    const matKey = (m) => (m.userData.live ? m.uuid : [m.type, m.color?.getHex(), m.roughness, m.metalness, m.map?.uuid, m.flatShading, m.transparent, m.opacity, m.alphaTest, m.emissive?.getHex(), m.emissiveIntensity, m.side].join('|'));
    const ATTRS = ['position', 'normal', 'uv'];
    const mergeGeometries = (geos) => {
      const out = new THREE.BufferGeometry();
      ATTRS.forEach((name) => {
        const size = geos[0].attributes[name].itemSize;
        const arr = new Float32Array(geos.reduce((n, g) => n + g.attributes[name].count * size, 0));
        let off = 0;
        geos.forEach((g) => { arr.set(g.attributes[name].array, off); off += g.attributes[name].count * size; });
        out.setAttribute(name, new THREE.BufferAttribute(arr, size));
      });
      return out;
    };
    const bake = (root, parts) => {
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const buckets = new Map();
      parts.forEach((m) => {
        if (!m.isMesh || m.isInstancedMesh || m.userData.keep || !ATTRS.every((a) => m.geometry.attributes[a])) return;
        const key = matKey(m.material);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(m);
      });
      buckets.forEach((meshes) => {
        if (meshes.length < 2) return;
        const geos = meshes.map((m) => (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
        const merged = new THREE.Mesh(mergeGeometries(geos), meshes[0].material);
        merged.castShadow = meshes.some((m) => m.castShadow);
        merged.receiveShadow = meshes.some((m) => m.receiveShadow);
        meshes.forEach((m) => m.removeFromParent());
        root.add(merged);
      });
      root.children.filter((o) => o.isGroup && !o.children.length).forEach((o) => o.removeFromParent());
    };
    const partsOf = (root) => { const list = []; root.traverse((o) => { if (o !== root) list.push(o); }); return list; };
    bake(world, world.children.filter((o) => o.isMesh && o !== water));
    [train, shunter, ...trucks, depot, vessel, barge, crane].forEach((g) => bake(g, partsOf(g)));
    clouds.children.forEach((c) => bake(c, c.children));
    stacks.forEach((st) => bake(st.label, st.label.children));

    // Confetti boxes for clicks
    const burst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
    const bits = Array.from({ length: 40 }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    bits.forEach((b, i) => { burst.setColorAt(i, new THREE.Color(COLORS[i % 6])); dummy.position.set(0, -60, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); burst.setMatrixAt(i, dummy.matrix); });
    burst.frustumCulled = false;
    world.add(burst);
    const pop = (p) => bits.forEach((b) => {
      b.life = 1;
      b.p.copy(p);
      b.v.set((Math.random() - 0.5) * 7, 4 + Math.random() * 5, (Math.random() - 0.5) * 7);
    });

    // Day / night
    const DAY = { hemiSky: 0xfff0e0, hemiGround: 0xa89a8a, hemiI: 1.2, sun: 0xfff1e0, sunI: 2.4, fog: 0xfbe3cc, water: 0x3aa597, island: 0xefe6da, exposure: 1.05 };
    const NIGHT = { hemiSky: 0x6b6a9a, hemiGround: 0x2a2226, hemiI: 1.0, sun: 0xcfc9ff, sunI: 1.15, fog: 0x1d1b28, water: 0x1f5a5c, island: 0x7a726b, exposure: 1.08 };
    const ca = new THREE.Color();
    const cb = new THREE.Color();
    const mix = (a, b, t) => ca.set(a).lerp(cb.set(b), t);
    const mood = { night: isNight() ? 1 : 0 };
    const applyMood = () => {
      const t = mood.night;
      hemi.color.copy(mix(DAY.hemiSky, NIGHT.hemiSky, t));
      hemi.groundColor.copy(mix(DAY.hemiGround, NIGHT.hemiGround, t));
      hemi.intensity = lerp(DAY.hemiI, NIGHT.hemiI, t);
      sun.color.copy(mix(DAY.sun, NIGHT.sun, t));
      sun.intensity = lerp(DAY.sunI, NIGHT.sunI, t);
      scene.fog.color.copy(mix(DAY.fog, NIGHT.fog, t));
      waterMat.color.copy(mix(DAY.water, NIGHT.water, t));
      islandMat.color.copy(mix(DAY.island, NIGHT.island, t));
      renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, t);
      bulbMat.emissiveIntensity = t * 3.2;
      windowMat.emissiveIntensity = t * 1.6;
      lampMat.emissiveIntensity = 0.2 + t * 2.4;
      bridgeMat.emissiveIntensity = t * 0.35;
      stars.material.opacity = t;
      cloudMat.opacity = lerp(0.95, 0.1, t);
      dirty = true;
    };
    themeListeners.push((night) => {
      if (hasGsap && !reduceMotion) gsap.to(mood, { night: night ? 1 : 0, duration: 1.2, ease: 'power2.inOut', onUpdate: applyMood });
      else { mood.night = night ? 1 : 0; applyMood(); }
    });

    // Camera: slow orbit, drag to spin, scroll to rise away
    const view = { theta: 0.62, phi: 1.1, radius: 41, vTheta: 0, vPhi: 0, scroll: 0 };
    const size = { width: 1, height: 1 };
    const layout = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      size.width = w;
      size.height = h;
      renderer.setSize(w, h, false);
      // The port sits right of the words on wide screens and above them on narrow ones. The camera's
      // aspect has to match the whole offset view, or the scene comes out stretched.
      const wide = w > 900;
      const fullW = wide ? w * 1.3 : w;
      const fullH = wide ? h : h * 1.3;
      camera.aspect = fullW / fullH;
      camera.fov = wide ? 34 : 42;
      camera.setViewOffset(fullW, fullH, 0, wide ? 0 : h * 0.3, w, h);
      view.radius = wide ? 41 : w > 600 ? 58 : 74;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    layout();
    window.addEventListener('resize', layout);
    applyMood();

    // Pointer: the yard ripples under the cursor; hover shows what a box or vehicle is; clicks send a shockwave.
    const tip = $('[data-tip]');
    const tipName = $('[data-tip-name]');
    const tipCat = $('[data-tip-cat]');
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const tipAt = new THREE.Vector3();
    const cursor = { on: false, x: 0, z: 0 };
    const pulses = [];
    let hover = null;
    let drag = null;
    let tipTimer = 0;
    const topId = (si) => stacks[si].ids[stacks[si].ids.length - 1];
    const aim = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };
    const groundAt = () => {
      ground.constant = -(world.position.y + 0.9);
      if (!raycaster.ray.intersectPlane(ground, hitPoint)) return null;
      return { x: hitPoint.x - world.position.x, z: hitPoint.z - world.position.z };
    };
    const pick = () => {
      const hit = raycaster.intersectObject(boxes, false)[0];
      if (hit && inst[hit.instanceId].live) return { kind: 'box', si: inst[hit.instanceId].si, point: hit.point.clone() };
      const vh = raycaster.intersectObjects(vehicles, true)[0];
      if (!vh) return null;
      let o = vh.object;
      while (o && !o.userData.tip) o = o.parent;
      return o ? { kind: 'veh', obj: o, point: vh.point.clone() } : null;
    };
    const same = (a, b) => (a && b && a.kind === b.kind && (a.kind === 'box' ? a.si === b.si : a.obj === b.obj)) || (!a && !b);
    const setHover = (h) => {
      if (same(h, hover)) return;
      if (hover?.kind === 'box') boxes.setColorAt(topId(hover.si), inst[topId(hover.si)].color);
      hover = h;
      [canvas.dataset.cursor, canvas.dataset.cursorIcon] = !h ? ['Drag to spin', 'spin'] : h.kind === 'box' ? [`Unbox ${stacks[h.si].tech[0]}`, 'box'] : NUDGES[h.obj.userData.tip];
      if (!h) { tip.classList.remove('is-on'); }
      else {
        if (h.kind === 'box') {
          const id = topId(h.si);
          boxes.setColorAt(id, tmpColor.copy(inst[id].color).lerp(white, 0.25));
          [tipName.textContent, tipCat.textContent] = stacks[h.si].tech;
        } else [tipName.textContent, tipCat.textContent] = MODE_TIPS[h.obj.userData.tip];
        tip.classList.add('is-on');
      }
      boxes.instanceColor.needsUpdate = true;
      dirty = true;
    };
    // Unboxing: click a container and its technology pops out on a beam of light
    const ub = $('[data-unbox]');
    const ubLogo = $('[data-unbox-logo]');
    const ubName = $('[data-unbox-name]');
    const ubCat = $('[data-unbox-cat]');
    const ubLine = $('[data-unbox-line]');
    const ubBar = $('[data-unbox-bar]');
    const ubCount = $('[data-unbox-count]');
    let seen;
    try { seen = new Set(JSON.parse(store.get('unboxed') || '[]')); } catch (e) { seen = new Set(); }
    let opened = null;
    let unboxTimer = 0;
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 4;
    beamCanvas.height = 128;
    const bg = beamCanvas.getContext('2d');
    const grad = bg.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    bg.fillStyle = grad;
    bg.fillRect(0, 0, 4, 128);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.95, 7, 28, 1, true).translate(0, 3.5, 0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(beamCanvas), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.visible = false;
    beam.renderOrder = 5;
    beam.userData = { si: 0, t0: -99 };
    world.add(beam);
    const svgNS = 'http://www.w3.org/2000/svg';
    const closeUnbox = () => {
      clearTimeout(unboxTimer);
      opened = null;
      ub.classList.remove('is-on');
      tip.classList.remove('is-hidden');
    };
    const unbox = (si) => {
      const tech = stacks[si].tech;
      const [name, cat, line] = tech;
      const icon = window.SI?.[TECH_SLUG[name]];
      const tint = icon ? `#${icon.hex}` : COLORS[PORT_TECH.indexOf(tech) % COLORS.length];
      ubLogo.style.setProperty('--tint', tint);
      ubLogo.replaceChildren();
      if (icon) {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', icon.d);
        svg.append(path);
        ubLogo.append(svg);
      } else {
        const words = name.split(/[\s/&-]+/).filter(Boolean);
        const b = document.createElement('b');
        b.textContent = (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : name.slice(0, 2)).toUpperCase();
        ubLogo.append(b);
      }
      ubName.textContent = name;
      ubCat.textContent = cat;
      ubLine.textContent = line;
      seen.add(name);
      store.set('unboxed', JSON.stringify([...seen]));
      const n = Math.min(seen.size, PORT_TECH.length);
      ubCount.textContent = n >= PORT_TECH.length ? `All ${n} unboxed — that’s the whole stack!` : `Unboxed ${n} of ${PORT_TECH.length} · keep going`;
      ubBar.style.transform = `scaleX(${n / PORT_TECH.length})`;
      ub.classList.remove('is-on');
      void ub.offsetWidth;
      ub.classList.add('is-on');
      opened = { si, w: ub.offsetWidth, h: ub.offsetHeight };
      tip.classList.add('is-hidden');
      beam.material.color.set(tint);
      beam.userData.t0 = performance.now() / 1000;
      beam.userData.si = si;
      beam.visible = true;
      clearTimeout(unboxTimer);
      unboxTimer = setTimeout(closeUnbox, 5200);
      dirty = true;
    };
    const boxTop = (si, v, extra) => {
      const it = inst[topId(si)];
      return v.set(stacks[si].x, 0.43 + it.lvl * 0.88 + it.lift + it.jump + it.drop + extra, stacks[si].z);
    };
    const placeUnbox = () => {
      if (!opened) return;
      world.localToWorld(boxTop(opened.si, tipAt, 0.7)).project(camera);
      const r = size;
      const half = opened.w / 2 + 10;
      ub.style.left = `${clamp(((tipAt.x + 1) / 2) * r.width, half, r.width - half).toFixed(1)}px`;
      ub.style.top = `${Math.max(opened.h + 96, ((1 - tipAt.y) / 2) * r.height).toFixed(1)}px`;
    };
    const placeTip = () => {
      if (!hover) return;
      if (hover.kind === 'box') {
        const id = topId(hover.si);
        const st = stacks[hover.si];
        tipAt.set(st.x, 0.95 + inst[id].lvl * 0.88 + inst[id].lift + inst[id].jump, st.z);
        world.localToWorld(tipAt);
      } else {
        hover.obj.getWorldPosition(tipAt);
        tipAt.y += hover.obj.userData.tip === 'crane' ? 8.4 : hover.obj.userData.tip === 'vessel' ? 4 : 2;
      }
      tipAt.project(camera);
      const r = size;
      tip.style.left = `${(((tipAt.x + 1) / 2) * r.width).toFixed(1)}px`;
      tip.style.top = `${(((1 - tipAt.y) / 2) * r.height).toFixed(1)}px`;
    };

    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, moved: false, id: e.pointerId };
      if (e.pointerType === 'mouse') canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(e.clientX - drag.sx) > 4) { drag.moved = true; hero.classList.add('is-dragging'); }
        if (drag.moved) {
          view.vTheta = -dx * 0.0065;
          view.vPhi = e.pointerType === 'mouse' ? dy * 0.003 : 0;
          view.theta += view.vTheta;
          view.phi = clamp(view.phi + view.vPhi, 0.72, 1.28);
          dirty = true;
        }
        drag.x = e.clientX; drag.y = e.clientY;
      }
      if (e.pointerType !== 'mouse') return;
      aim(e.clientX, e.clientY);
      const g = groundAt();
      cursor.on = Boolean(g);
      if (g) { cursor.x = g.x; cursor.z = g.z; }
      if (!drag?.moved) setHover(pick());
    });
    const endDrag = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasClick = !drag.moved;
      drag = null;
      hero.classList.remove('is-dragging');
      if (!wasClick || e.type !== 'pointerup') return;
      aim(e.clientX, e.clientY);
      const h = pick();
      setHover(h);
      const g = groundAt();
      if (g) { pulses.push({ x: g.x, z: g.z, t0: performance.now() / 1000 }); if (pulses.length > 4) pulses.shift(); }
      if (h) {
        if (h.kind === 'box') {
          const id = topId(h.si);
          inst[id].vy = 7.5;
          inst[id].spinV = (Math.random() < 0.5 ? -1 : 1) * 9;
          unbox(h.si);
        } else h.obj.userData.kick = 1;
        pop(world.worldToLocal(h.point.clone()));
      } else closeUnbox();
      clearTimeout(tipTimer);
      if (e.pointerType !== 'mouse') tipTimer = setTimeout(() => setHover(null), 2400);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) { cursor.on = false; setHover(null); } });

    if (animate) {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: (self) => { view.scroll = self.progress; dirty = true; } });
    }

    const target = new THREE.Vector3(0, 0.4, 3.4);
    const fwd = new THREE.Vector3();
    const upv = new THREE.Vector3();
    const hz = new THREE.Vector3();
    // Where the fading sea is mostly gone: the painted land sits on that line.
    const placeHorizon = () => {
      const depth = lerp(scene.fog.near, scene.fog.far, 0.62);
      fwd.subVectors(target, camera.position).normalize();
      upv.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const s = (water.position.y + world.position.y - camera.position.y - fwd.y * depth) / upv.y;
      hz.copy(camera.position).addScaledVector(fwd, depth).addScaledVector(upv, s).project(camera);
      skyHorizon(((1 - hz.y) / 2) * size.height);
    };
    const render = (t, dt) => {
      if (!reduceMotion) {
        if (!drag) {
          view.theta += 0.045 * dt + view.vTheta;
          view.vTheta *= 0.92;
          view.phi = clamp(view.phi + view.vPhi, 0.72, 1.28);
          view.vPhi *= 0.9;
        }
        waves(t);
        workCrane(t);
        // Vehicles: kicks fade, then each moves on its own path
        vehicles.forEach((v) => { v.userData.kick = Math.max(0, v.userData.kick - dt * 1.4); });
        const trainStep = dt * (3.2 + train.userData.kick * 9);
        train.userData.x = (train.userData.x ?? -40) + trainStep;
        if (train.userData.x > 64) train.userData.x = -64;
        train.position.x = train.userData.x;
        const sx = 0.6 + Math.sin(t * 0.32) * 3.2;
        shunter.position.x = sx;
        shunter.position.y = -0.05 + Math.sin(shunter.userData.kick * Math.PI) * 0.5;
        trucks.forEach((tr) => {
          const step = dt * (2.6 + tr.userData.kick * 4);
          tr.userData.u = (tr.userData.u + step / routeLen) % 1;
          const p = truckRoute.getPointAt(tr.userData.u);
          const tan = truckRoute.getTangentAt(tr.userData.u);
          tr.position.set(p.x, Math.sin(tr.userData.kick * Math.PI) * 0.7, p.z);
          tr.rotation.y = Math.atan2(-tan.z, tan.x);
        });
        barge.position.x = ((t * 1.5 + 30) % 120) - 60;
        barge.position.y = Math.sin(t * 1.2) * 0.07;
        barge.rotation.z = Math.sin(t * 0.9) * 0.02 + barge.userData.kick * Math.sin(t * 20) * 0.08;
        vessel.position.y = Math.sin(t * 0.8) * 0.05;
        vessel.rotation.x = Math.sin(t * 0.7) * 0.012 + vessel.userData.kick * Math.sin(t * 16) * 0.05;
        depot.position.y = Math.sin(depot.userData.kick * Math.PI) * 0.25;
        crane.rotation.z = crane.userData.kick * Math.sin(t * 18) * 0.015;
        beacon.material.emissiveIntensity = (Math.sin(t * 4) > 0.6 ? 2.5 : 0.3) * (0.3 + mood.night);
        clouds.children.forEach((c) => { c.position.x += c.userData.speed * dt; if (c.position.x > 42) c.position.x = -42; });
        dirty = true;
      }

      // The yard: arrival drop, cursor ripple, shockwaves, hover lift, click jumps
      const now = performance.now() / 1000;
      const introT = introAt < 0 ? -1 : now - introAt;
      const live = pulses.filter((p) => now - p.t0 < 2.6);
      pulses.length = 0;
      pulses.push(...live);
      let changed = false;
      inst.forEach((it, id) => {
        const st = stacks[it.si];
        if (!it.live) {
          if (introT >= it.start) { it.live = true; changed = true; } else return;
        }
        if (it.drop > 0 || it.dvy !== 0) {
          it.dvy -= 34 * dt;
          it.drop += it.dvy * dt;
          if (it.drop <= 0) {
            it.drop = 0;
            if (it.dvy < -3) { it.sq = Math.min(1, -it.dvy / 16); it.dvy = -it.dvy * 0.3; } else it.dvy = 0;
          }
          changed = true;
        }
        if (it.sq > 0.001) { it.sq *= Math.exp(-dt * 9); changed = true; } else it.sq = 0;
        let lift = 0;
        const amp = 0.35 + it.lvl * 0.55;
        if (cursor.on && !reduceMotion) {
          const d2 = (st.x - cursor.x) ** 2 + (st.z - cursor.z) ** 2;
          lift += 0.6 * Math.exp(-d2 / 11) * amp;
        }
        live.forEach((p) => {
          const age = now - p.t0;
          const d = Math.hypot(st.x - p.x, st.z - p.z);
          lift += 1.2 * Math.exp(-((d - age * 8) ** 2) / 1.6) * (1 - age / 2.6) * amp;
        });
        if (hover?.kind === 'box' && hover.si === it.si && id === topId(it.si)) lift += 0.4;
        if (Math.abs(lift - it.lift) > 0.0008) { it.lift += (lift - it.lift) * Math.min(1, dt * 10); changed = true; }
        if (it.vy || it.jump > 0) {
          it.vy -= 22 * dt;
          it.jump = Math.max(0, it.jump + it.vy * dt);
          it.spin += it.spinV * dt;
          if (it.jump === 0 && it.vy < 0) { it.vy = 0; it.spin = Math.round(it.spin / Math.PI) * Math.PI; it.spinV = 0; it.sq = 0.6; }
          changed = true;
        }
      });
      if (changed) { inst.forEach((_, id) => placeInstance(id)); placeLabels(); boxes.instanceMatrix.needsUpdate = true; dirty = true; }

      let alive = false;
      bits.forEach((b, i) => {
        if (b.life <= 0) return;
        alive = true;
        b.life -= dt * 0.9;
        b.v.y -= 16 * dt;
        b.p.addScaledVector(b.v, dt);
        dummy.position.copy(b.p);
        if (b.life <= 0) dummy.position.set(0, -60, 0);
        dummy.rotation.set(t * 5 + i, t * 3, 0);
        dummy.scale.setScalar(Math.max(0.001, b.life));
        dummy.updateMatrix();
        burst.setMatrixAt(i, dummy.matrix);
      });
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      if (alive) { burst.instanceMatrix.needsUpdate = true; dirty = true; }
      if (beam.visible) {
        const a = now - beam.userData.t0;
        boxTop(beam.userData.si, beam.position, 0.43);
        beam.scale.set(1, Math.min(1, a / 0.35) + 0.001, 1);
        beam.material.opacity = a < 0.35 ? (a / 0.35) * 0.8 : Math.max(0, 0.8 - (a - 0.35) * 0.45);
        beam.visible = beam.material.opacity > 0;
        dirty = true;
      }

      if (!dirty || !ready) return;
      // Hold the frame rate: if this device keeps missing frames, render fewer pixels.
      if (now > tuneFrom) {
        tune.sum += dt;
        if (++tune.frames === 90) {
          if (tune.sum / tune.frames > 0.024 && tune.ratio > 1) {
            tune.ratio = Math.max(1, tune.ratio - 0.25);
            renderer.setPixelRatio(tune.ratio);
            layout();
          }
          tune.sum = 0;
          tune.frames = 0;
        }
      }
      const radius = view.radius + view.scroll * 18;
      const phi = view.phi - view.scroll * 0.3;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(view.theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(view.theta),
      );
      camera.lookAt(target);
      world.position.y = -view.scroll * 3;
      scene.fog.near = radius + 10;
      scene.fog.far = radius + 38;
      if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = reduceMotion || (frameNo++ & 1) === 0;
      renderer.render(scene, camera);
      placeTip();
      placeUnbox();
      placeHorizon();
      skyDrift(view.theta);
      dirty = false;
    };
    // Compile every shader in the background before the first frame, so the page never freezes while the port appears.
    let ready = typeof renderer.compileAsync !== 'function';
    let frameNo = 0;
    let tuneFrom = Infinity;
    const tune = { frames: 0, sum: 0, ratio: renderer.getPixelRatio() };
    if (!ready) {
      beam.visible = true;
      renderer.compileAsync(scene, camera).catch(() => {}).then(() => {
        beam.visible = false;
        ready = true;
        dirty = true;
        tuneFrom = performance.now() / 1000 + 3;
      });
    } else tuneFrom = performance.now() / 1000 + 3;
    addLoop(hero, render, '0px');
    render(0, 0.016);
  };
  whenThree((THREE) => { try { buildPort(THREE); } catch (e) { console.warn('3D port unavailable:', e); root.classList.add('no-webgl'); } });

  /* ---------- About: flip card, brain meter, tilting stats ---------- */

  $$('[data-flip]').forEach((card) => {
    const flip = () => card.classList.toggle('is-flipped');
    card.addEventListener('click', flip);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });

  const brain = $('[data-brain]');
  if (brain) {
    const track = $('.brain__track', brain);
    const note = $('[data-brain-note]', brain);
    const NOTES = {
      mid: 'Exactly in the middle. Apparently that’s rare.',
      left: 'Leaning logical — Math is winning this round.',
      right: 'Leaning creative — English takes the lead.',
      back: '…and back to the middle. Every single time.',
    };
    let mood = 'start';
    const say = (m) => { if (m !== mood) { mood = m; note.textContent = NOTES[m]; } };
    const pos = spring(50, (v) => {
      brain.style.setProperty('--pos', v.toFixed(2));
      brain.classList.toggle('is-left', v < 42);
      brain.classList.toggle('is-right', v > 58);
    });
    let dragging = false;
    const move = (e) => {
      const r = track.getBoundingClientRect();
      const v = clamp(((e.clientX - r.left) / r.width) * 100, 3, 97);
      pos.set(v);
      say(v < 42 ? 'left' : v > 58 ? 'right' : 'mid');
    };
    brain.addEventListener('pointerdown', (e) => { dragging = true; brain.setPointerCapture(e.pointerId); move(e); });
    brain.addEventListener('pointermove', (e) => { if (dragging || e.pointerType === 'mouse') move(e); });
    const release = () => { dragging = false; pos.set(50); if (mood !== 'mid' && mood !== 'start') say('back'); };
    brain.addEventListener('pointerup', release);
    brain.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') release(); });
  }

  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-y * 14).toFixed(2)}deg) rotateY(${(x * 16).toFixed(2)}deg) translateZ(10px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  onEnter($$('[data-count]'), (b) => b.forEach((el) => countUp(el, parseInt(el.dataset.count, 10))), '-5%');

  /* ---------- The whole chain: a container rides from master data to invoice ---------- */

  const flow = $('[data-flow]');
  if (flow) {
    const steps = $$('.step', flow);
    const dots = steps.map((s) => $('.step__dot', s));
    const token = $('[data-flow-token]', flow);
    const line = $('.flow__line', flow);
    const rail = $('.flow__rail', flow);
    const nEl = $('[data-flow-n]');
    const nameEl = $('[data-flow-name]');
    const textEl = $('[data-flow-text]');
    const n = steps.length;
    let ends = [0, 0];
    let vertical = false;
    let active = -1;
    const measure = () => {
      vertical = narrow();
      const r = rail.getBoundingClientRect();
      const a = dots[0].getBoundingClientRect();
      const b = dots[n - 1].getBoundingClientRect();
      ends = vertical ? [a.top + a.height / 2 - r.top, b.top + b.height / 2 - r.top] : [a.left + a.width / 2 - r.left, b.left + b.width / 2 - r.left];
    };
    const show = (i) => {
      if (i === active) return;
      active = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      nEl.textContent = String(i + 1).padStart(2, '0');
      nameEl.textContent = $('b', steps[i]).textContent;
      textEl.textContent = steps[i].dataset.detail;
      token.style.backgroundColor = COLORS[i % COLORS.length];
    };
    const setP = (p) => {
      const at = lerp(ends[0], ends[1], p);
      token.style.transform = vertical ? `translateY(${(at - 20).toFixed(1)}px)` : `translateX(${at.toFixed(1)}px)`;
      line.style.setProperty('--p', p.toFixed(3));
      steps.forEach((s, k) => s.classList.toggle('is-on', p >= k / (n - 1) - 0.01));
      show(Math.round(p * (n - 1)));
    };
    steps.forEach((s, k) => $('button', s).addEventListener('click', () => setP(k / (n - 1))));
    measure();
    window.addEventListener('resize', measure);
    if (animate) {
      ScrollTrigger.create({ trigger: flow, start: 'top 80%', end: 'bottom 45%', onRefresh: measure, onUpdate: (self) => setP(self.progress) });
      setP(0);
    } else setP(1);
  }

  /* ---------- Tech galaxy: six constellations of tools, every one labelled ---------- */

  const skills = $('[data-skills]');
  if (skills) {
    const section = $('#galaxy');
    const cards = $$('.skill', skills);
    const tipEl = $('[data-skill-tip]');
    const [tipName, tipCat, tipNote] = ['b', 'span', 'p'].map((s) => $(s, tipEl));
    // Brand marks from the Simple Icons set replace their placeholders
    $$('[data-si]', skills).forEach((ph) => {
      const svg = iconSvg(ph.dataset.si);
      if (svg) ph.replaceWith(svg);
    });
    tintIcons();

    // Cards rise into view and their tools pop in; the counts tick up
    if (animate) {
      skills.classList.add('is-armed');
      onEnter(cards, (batch) => batch.forEach((c) => c.classList.add('is-in')), '-8%');
    }
    onEnter($$('[data-count]', section), (batch) => batch.forEach((el) => countUp(el, Number(el.dataset.count))), '-8%');

    // What each tool is for: hover, focus or tap
    let tipFor = null;
    let tipTimer = 0;
    const showTip = (tool) => {
      tipName.textContent = tool.textContent.trim();
      tipCat.textContent = $('h3', tool.closest('.skill')).textContent;
      tipNote.textContent = tool.dataset.note || '';
      const r = tool.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      const centre = r.left + r.width / 2 - s.left;
      const half = tipEl.offsetWidth / 2 + 8;
      const left = clamp(centre, half, s.width - half);
      tipEl.style.left = `${left.toFixed(1)}px`;
      tipEl.style.top = `${(r.top - s.top).toFixed(1)}px`;
      tipEl.style.setProperty('--ax', `${(centre - left).toFixed(1)}px`);
      tipFor?.classList.remove('is-tip');
      tipFor = tool;
      tool.classList.add('is-tip');
      tipEl.classList.add('is-on');
    };
    const hideTip = () => {
      clearTimeout(tipTimer);
      tipFor?.classList.remove('is-tip');
      tipFor = null;
      tipEl.classList.remove('is-on');
    };
    skills.addEventListener('pointerover', (e) => { const t = e.target.closest('.tool'); if (t && e.pointerType === 'mouse') showTip(t); });
    skills.addEventListener('pointerout', (e) => { const t = e.target.closest('.tool'); if (t && e.pointerType === 'mouse' && !t.contains(e.relatedTarget)) hideTip(); });
    skills.addEventListener('click', (e) => {
      const t = e.target.closest('.tool');
      if (!t) return;
      showTip(t);
      clearTimeout(tipTimer);
      tipTimer = setTimeout(hideTip, 3000);
    });
    skills.addEventListener('focusin', (e) => { const t = e.target.closest('.tool'); if (t) showTip(t); });
    skills.addEventListener('focusout', hideTip);
    window.addEventListener('scroll', () => { if (tipFor && !finePointer) hideTip(); }, { passive: true });

    // A soft spotlight follows the pointer across each card
    if (finePointer) {
      cards.forEach((c) => c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
        c.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      }));
    }

    // Picking an area lights its card and dims the rest
    const filters = $$('[data-filter]', section);
    filters.forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.filter;
      hideTip();
      filters.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      skills.classList.toggle('is-filtered', f !== 'all');
      cards.forEach((c) => c.classList.toggle('is-focus', c.dataset.cat === f));
      const focus = cards.find((c) => c.dataset.cat === f);
      if (focus && window.innerWidth <= 1000) focus.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));
  }

  /* ---------- The voyage: a ship sails through the career ports ---------- */

  const voyage = $('#voyage');
  if (voyage) {
    const track = $('[data-voyage-track]');
    const svg = $('[data-voyage-svg]');
    const route = $('[data-voyage-route]');
    const done = $('[data-voyage-done]');
    const boat = $('[data-voyage-boat]');
    const ports = $$('.port', voyage);
    const pin = $('.voyage__pin', voyage);
    const GAP = 420;
    const START = 300;
    let length = 1;
    let portAt = [];
    let mode = '';
    let progress = 0;

    const update = (p) => {
      progress = p;
      const L = p * length;
      done.style.strokeDashoffset = `${(length - L).toFixed(1)}`;
      const pt = route.getPointAtLength(L);
      if (mode === 'h') {
        const ahead = route.getPointAtLength(Math.min(length, L + 6));
        const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        boat.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${(angle * 0.6).toFixed(1)}deg)`;
        const maxShift = Math.max(0, track.offsetWidth - innerWidth);
        track.style.transform = `translate3d(${clamp(innerWidth * 0.42 - pt.x, -maxShift, 0).toFixed(1)}px, 0, 0)`;
      } else {
        boat.style.transform = `translate(0, ${(pt.y + 30).toFixed(1)}px) rotate(90deg)`;
      }
      ports.forEach((port, i) => port.classList.toggle('is-reached', p >= portAt[i] - 0.004));
    };

    const build = () => {
      mode = narrow() ? 'v' : 'h';
      if (mode === 'h') {
        pin.style.position = 'sticky';
        pin.style.top = '0';
        const H = track.clientHeight;
        const W = START * 2 + GAP * (ports.length - 1);
        track.style.width = `${W}px`;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.style.height = '';
        const mid = H * 0.56;
        const amp = Math.min(90, H * 0.12);
        const pts = ports.map((p, i) => [START + i * GAP, mid + (i % 2 ? amp : -amp)]);
        ports.forEach((p, i) => {
          p.style.left = `${pts[i][0]}px`;
          p.style.top = `${pts[i][1]}px`;
          p.dataset.side = i % 2 ? 'down' : 'up';
        });
        let d = `M 40 ${mid} C ${(40 + pts[0][0]) / 2} ${mid}, ${pts[0][0] - 120} ${pts[0][1]}, ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1];
          const [x1, y1] = pts[i];
          d += ` C ${x0 + GAP / 2} ${y0}, ${x1 - GAP / 2} ${y1}, ${x1} ${y1}`;
        }
        const [lx, ly] = pts[pts.length - 1];
        d += ` C ${lx + 160} ${ly}, ${W - 120} ${mid}, ${W - 40} ${mid}`;
        route.setAttribute('d', d);
        done.setAttribute('d', d);
        // Tall enough to sail the whole route while the section is pinned.
        voyage.style.height = `${Math.round(W - innerWidth + innerHeight * 1.3)}px`;
      } else {
        voyage.style.height = '';
        pin.style.position = '';
        track.style.width = '';
        ports.forEach((p) => { p.style.left = ''; p.style.top = ''; p.dataset.side = ''; });
        const H = $('.ports', voyage).offsetHeight + 60;
        svg.setAttribute('viewBox', `0 0 4 ${H}`);
        svg.style.height = `${H}px`;
        route.setAttribute('d', `M 2 0 V ${H}`);
        done.setAttribute('d', `M 2 0 V ${H}`);
      }
      length = route.getTotalLength();
      done.style.strokeDasharray = `${length}`;
      portAt = ports.map((p) => {
        if (mode === 'v') return (p.offsetTop + 30) / length;
        const px = parseFloat(p.style.left);
        let lo = 0; let hi = length;
        for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (route.getPointAtLength(m).x < px) lo = m; else hi = m; }
        return lo / length;
      });
      update(progress);
    };

    if (animate) {
      build();
      ScrollTrigger.create({
        trigger: voyage,
        start: () => (mode === 'h' ? 'top top' : 'top 60%'),
        end: () => (mode === 'h' ? 'bottom bottom' : 'bottom 70%'),
        invalidateOnRefresh: true,
        onUpdate: (self) => update(self.progress),
      });
      ScrollTrigger.addEventListener('refresh', () => { if ((narrow() ? 'v' : 'h') !== mode) build(); });
      window.addEventListener('resize', () => { build(); ScrollTrigger.refresh(); });
      ScrollTrigger.refresh();
    } else {
      build();
      update(1);
    }
  }

  /* ---------- Work: holographic cards that tilt and flip ---------- */

  $$('[data-holo]').forEach((card) => {
    const logos = $('[data-logos]', card);
    logos?.dataset.logos.split(' ').forEach((slug) => {
      const svg = iconSvg(slug);
      if (!svg) return;
      const s = document.createElement('span');
      s.append(svg);
      logos.append(s);
    });
    const flip = () => card.classList.toggle('is-flipped');
    card.addEventListener('click', flip);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    if (finePointer && !reduceMotion) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    }
  });
  tintIcons();

  /* ---------- Play: Stack Overflow ---------- */

  const FACTS = [
    [3, '8+ years shipping enterprise Java &amp; Spring.'],
    [6, 'Promoted 4 times at one company — Associate SE to Associate Solution Architect.'],
    [10, 'Built a fully dynamic RBAC engine: roles change, code doesn’t.'],
    [14, '5+ partner integrations: routes, bookings, tracking, documents.'],
    [18, 'Exactly between left- and right-brained. English &amp; Math, both.'],
    [24, 'You stack like an architect. <b>We should talk →</b>'],
  ];
  const unlockList = $('[data-unlocks]');
  const opened = new Set((store.get('stack-unlocked') || '').split(',').filter(Boolean).map(Number));
  const renderUnlocks = () => {
    if (!unlockList) return;
    unlockList.innerHTML = FACTS.map(([lvl, text]) => (opened.has(lvl)
      ? `<li class="unlock is-open"><b>Level ${lvl}</b>${text}</li>`
      : `<li class="unlock"><b>Level ${lvl}</b>Locked — stack higher</li>`)).join('');
  };
  renderUnlocks();

  const buildGame = (THREE) => {
    const canvas = $('[data-game]');
    const board = $('.play__board');
    if (!canvas) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xfff4e8, 0xa8998a, 1.25));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6);
    dl.position.set(6, 12, 4);
    scene.add(dl);
    const stripes = new THREE.CanvasTexture(stripeCanvas());
    stripes.colorSpace = THREE.SRGBColorSpace;
    const H = 0.5;
    const scoreEl = $('[data-score]');
    const bestEl = $('[data-best]');
    const overlay = $('[data-overlay]');
    const overK = $('[data-over-k]');
    const overT = $('[data-over-t]');
    const perfectEl = $('[data-perfect]');
    const toastEl = $('[data-toast]');
    const startBtn = $('[data-start]');
    let best = parseInt(store.get('stack-best') || '0', 10);
    bestEl.textContent = best;

    const state = { stack: [], falling: [], moving: null, playing: false, camY: 2, score: 0, combo: 0, dir: 1, speed: 4 };
    const block = (w, d, x, y, z, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], map: stripes, roughness: 0.55, metalness: 0.1 }));
      m.position.set(x, y, z);
      scene.add(m);
      return { m, w, d };
    };
    const dispose = (m) => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); };
    const clear = () => {
      [...state.stack, ...state.falling].forEach((b) => dispose(b.m));
      if (state.moving) dispose(state.moving.m);
      state.stack = []; state.falling = []; state.moving = null;
    };
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), new THREE.MeshStandardMaterial({ color: 0x4a443d, roughness: 0.85 }));
    base.position.set(0, -3.25, 0);
    scene.add(base);

    const draw = () => {
      cam.position.set(9, state.camY + 9, 9);
      cam.lookAt(0, state.camY, 0);
      renderer.render(scene, cam);
    };
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const a = w / h;
      const d = 5.2;
      Object.assign(cam, { left: -d * a, right: d * a, top: d, bottom: -d });
      cam.updateProjectionMatrix();
      draw();
    };

    const spawn = () => {
      const top = state.stack[state.stack.length - 1];
      const axis = state.stack.length % 2 ? 'x' : 'z';
      const b = block(top.w, top.d, axis === 'x' ? -7 : top.m.position.x, state.stack.length * H, axis === 'z' ? -7 : top.m.position.z, state.stack.length);
      b.axis = axis;
      state.dir = 1;
      state.moving = b;
      state.speed = Math.min(9, 4 + state.stack.length * 0.12);
    };
    const start = () => {
      clear();
      state.stack.push(block(3, 3, 0, 0, 0, 0));
      state.score = 0; state.combo = 0; state.camY = 2;
      scoreEl.textContent = '0';
      overlay.classList.add('is-hidden');
      state.playing = true;
      spawn();
      canvas.focus({ preventScroll: true });
    };
    const over = () => {
      state.playing = false;
      if (state.score > best) { best = state.score; store.set('stack-best', String(best)); bestEl.textContent = best; }
      overK.textContent = state.score >= 10 ? 'Shipshape!' : state.score >= 5 ? 'Nice stacking!' : 'Overboard!';
      overT.textContent = `You stacked ${state.score} container${state.score === 1 ? '' : 's'}. Best: ${best}.`;
      startBtn.innerHTML = 'Play again <span aria-hidden="true">↻</span>';
      setTimeout(() => overlay.classList.remove('is-hidden'), 650);
    };
    const drop = () => {
      if (!state.playing || !state.moving) return;
      const mv = state.moving;
      const top = state.stack[state.stack.length - 1];
      const ax = mv.axis;
      const size = ax === 'x' ? top.w : top.d;
      let delta = mv.m.position[ax] - top.m.position[ax];
      const overlap = size - Math.abs(delta);
      state.moving = null;
      if (overlap <= 0) {
        state.falling.push({ m: mv.m, vy: 0, vr: 2, ax });
        over();
        return;
      }
      if (Math.abs(delta) < 0.12) {
        mv.m.position[ax] = top.m.position[ax];
        state.combo++;
        perfectEl.textContent = state.combo >= 3 ? `Perfect ×${state.combo}!` : 'Perfect!';
        perfectEl.classList.remove('is-on'); void perfectEl.offsetWidth; perfectEl.classList.add('is-on');
        state.stack.push(mv);
      } else {
        state.combo = 0;
        const centre = top.m.position[ax] + delta / 2;
        const y = mv.m.position.y;
        dispose(mv.m);
        const placed = block(ax === 'x' ? overlap : top.w, ax === 'z' ? overlap : top.d, ax === 'x' ? centre : top.m.position.x, y, ax === 'z' ? centre : top.m.position.z, state.stack.length);
        state.stack.push(placed);
        const cut = Math.abs(delta);
        const off = Math.sign(delta) * (overlap / 2 + cut / 2);
        const f = block(ax === 'x' ? cut : top.w, ax === 'z' ? cut : top.d, ax === 'x' ? centre + off : top.m.position.x, y, ax === 'z' ? centre + off : top.m.position.z, state.stack.length - 1);
        state.falling.push({ m: f.m, vy: 0, vr: Math.sign(delta) * 2.5, ax });
      }
      state.score = state.stack.length - 1;
      scoreEl.textContent = state.score;
      FACTS.forEach(([lvl, text]) => {
        if (state.score !== lvl) return;
        toast(toastEl, `🔓 <b>Level ${lvl}</b> — ${text}`);
        if (!opened.has(lvl)) { opened.add(lvl); store.set('stack-unlocked', [...opened].join(',')); renderUnlocks(); }
      });
      spawn();
    };

    startBtn.addEventListener('click', start);
    board.addEventListener('pointerdown', (e) => { if (state.playing && !e.target.closest('button')) { e.preventDefault(); drop(); } });
    let inView = false;
    document.addEventListener('keydown', (e) => {
      if (!inView || (e.code !== 'Space' && e.key !== ' ')) return;
      if (e.target.closest('input, textarea, button, a')) return;
      e.preventDefault();
      if (state.playing) drop();
      else if (!overlay.classList.contains('is-hidden')) start();
    });

    const tick = (t, dt) => {
      let active = false;
      if (state.moving) {
        const p = state.moving.m.position;
        const ax = state.moving.axis;
        p[ax] += state.dir * state.speed * dt;
        if (p[ax] > 6) state.dir = -1;
        if (p[ax] < -6) state.dir = 1;
        active = true;
      }
      state.falling = state.falling.filter((f) => {
        f.vy -= 18 * dt;
        f.m.position.y += f.vy * dt;
        if (f.ax === 'x') f.m.rotation.z -= f.vr * dt; else f.m.rotation.x += f.vr * dt;
        if (f.m.position.y < state.camY - 14) { dispose(f.m); return false; }
        return true;
      });
      if (state.falling.length) active = true;
      const targetY = Math.max(2, state.stack.length * H - 1);
      if (Math.abs(targetY - state.camY) > 0.01) { state.camY = lerp(state.camY, targetY, Math.min(1, dt * 5)); active = true; }
      if (active) draw();
    };
    watch($('#play'), (on) => { inView = on; });
    addLoop(board, tick, '0px');
    // A short idle stack, so the board isn't empty before you play.
    for (let i = 0; i < 6; i++) state.stack.push(block(3 - i * 0.12, 3 - i * 0.08, (i % 2) * 0.12, i * H, ((i + 1) % 2) * 0.1, i));
    state.camY = 2.5;
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(board);
    resize();
  };
  // The game is built when the browser is idle after the intro, or as its section comes near —
  // whichever happens first — so it costs nothing while the page loads.
  const playSection = $('#play');
  if (playSection) {
    let built = false;
    const kick = () => {
      if (built) return;
      built = true;
      near.disconnect();
      whenThree((THREE) => { try { buildGame(THREE); } catch (e) { console.warn('Game unavailable:', e); } });
    };
    const near = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) kick(); }, { rootMargin: '1000px 0px' });
    near.observe(playSection);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    setTimeout(() => idle(kick, { timeout: 4000 }), 5000);
  }

  /* ---------- How I think: a swipeable deck ---------- */

  const deck = $('[data-deck]');
  if (deck) {
    let order = $$('.dcard', deck);
    const count = $('[data-deck-count]');
    const total = order.length;
    let shown = 0;
    const layout = () => {
      order.forEach((c, i) => {
        c.style.zIndex = total - i;
        c.style.transform = `translate3d(0, ${i * 14}px, 0) scale(${(1 - i * 0.05).toFixed(2)}) rotate(${i ? (i % 2 ? 2.5 : -2.5) * Math.min(i, 3) : 0}deg)`;
        c.style.opacity = i > 3 ? '0' : '1';
        c.setAttribute('aria-hidden', String(i !== 0));
      });
      count.textContent = `${(shown % total) + 1} / ${total}`;
    };
    const next = (dir = 1) => {
      if (dir > 0) { order.push(order.shift()); shown = (shown + 1) % total; } else { order.unshift(order.pop()); shown = (shown - 1 + total) % total; }
      layout();
    };
    let dragC = null;
    deck.addEventListener('pointerdown', (e) => {
      const card = order[0];
      if (!card.contains(e.target)) return;
      dragC = { card, x: e.clientX, y: e.clientY, dx: 0, dy: 0, id: e.pointerId };
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-dragging');
    });
    deck.addEventListener('pointermove', (e) => {
      if (!dragC || dragC.id !== e.pointerId) return;
      dragC.dx = e.clientX - dragC.x;
      dragC.dy = e.clientY - dragC.y;
      dragC.card.style.transform = `translate3d(${dragC.dx}px, ${dragC.dy * 0.4}px, 0) rotate(${(dragC.dx * 0.06).toFixed(2)}deg)`;
    });
    const release = () => {
      if (!dragC) return;
      const { card, dx, dy } = dragC;
      card.classList.remove('is-dragging');
      dragC = null;
      if (Math.abs(dx) > 100) {
        card.style.transform = `translate3d(${Math.sign(dx) * innerWidth}px, ${dy}px, 0) rotate(${Math.sign(dx) * 30}deg)`;
        card.style.opacity = '0';
        setTimeout(() => next(1), 280);
      } else layout();
    };
    deck.addEventListener('pointerup', release);
    deck.addEventListener('pointercancel', release);
    $('[data-deck-next]').addEventListener('click', () => next(1));
    $('[data-deck-prev]').addEventListener('click', () => next(-1));
    layout();
  }

  /* ---------- Contact: load a container, sail it home, open the sheet ---------- */

  const sheet = $('[data-sheet]');
  const shipBtn = $('[data-ship-msg]');
  const dockShip = $('[data-dock-ship]');
  const openSheet = () => {
    if (!sheet || sheet.open) return;
    sheet.showModal();
    requestAnimationFrame(() => sheet.classList.add('is-in'));
    lenis?.stop();
  };
  const closeSheet = () => {
    if (!sheet?.open) return;
    sheet.classList.remove('is-in');
    setTimeout(() => {
      sheet.close();
      lenis?.start();
      dockShip.classList.remove('is-loaded');
      if (animate) gsap.fromTo(dockShip, { x: -260 }, { x: 0, duration: 1.4, ease: 'power3.out' });
    }, reduceMotion ? 0 : 400);
  };
  let shipping = false;
  shipBtn?.addEventListener('click', () => {
    if (shipping) return;
    if (!animate) { dockShip.classList.add('is-loaded'); openSheet(); return; }
    shipping = true;
    const from = $('[data-cargo]').getBoundingClientRect();
    const to = $('[data-msg-slot]').getBoundingClientRect();
    const box = document.createElement('i');
    Object.assign(box.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: '26px', height: '14px', borderRadius: '3px', background: COLORS[4], zIndex: 260, pointerEvents: 'none' });
    document.body.append(box);
    const dx = to.left + to.width / 2 - (from.left + 13);
    const dy = to.top + to.height / 2 - (from.top + 7);
    gsap.timeline({
      onComplete: () => {
        box.remove();
        dockShip.classList.add('is-loaded');
        gsap.to(dockShip, { x: 340, duration: 1.1, ease: 'power2.in', onComplete: () => { shipping = false; openSheet(); } });
      },
    })
      .to(box, { x: dx, duration: 0.8, ease: 'power1.inOut' }, 0)
      .to(box, { y: dy - 80, duration: 0.4, ease: 'power2.out' }, 0)
      .to(box, { y: dy, duration: 0.4, ease: 'bounce.out' }, 0.4)
      .to(box, { rotation: 360, duration: 0.8, ease: 'power1.inOut' }, 0);
  });
  $('[data-sheet-close]')?.addEventListener('click', closeSheet);
  sheet?.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  sheet?.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied ✓'; } catch (err) { b.textContent = 'Copy failed'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  }));

  /* ---------- Easter egg: type "docker" (or click the logo five times) ---------- */

  const rain = $('[data-rain]');
  const makeItRain = () => {
    if (!rain || reduceMotion) return;
    for (let i = 0; i < 42; i++) {
      const c = document.createElement('i');
      c.style.setProperty('--c', COLORS[i % 6]);
      c.style.left = `${Math.random() * 100}%`;
      rain.append(c);
      c.animate([
        { transform: `translateY(0) rotate(${Math.random() * 90}deg)` },
        { transform: `translateY(${innerHeight + 80}px) rotate(${360 + Math.random() * 360}deg)` },
      ], { duration: 1600 + Math.random() * 1600, delay: Math.random() * 900, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'both' }).finished.then(() => c.remove());
    }
  };
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-6);
    if (typed === 'docker') { typed = ''; makeItRain(); }
  });
  let clicks = 0;
  let clickTimer = 0;
  $('.brand')?.addEventListener('click', () => {
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1500);
    if (clicks >= 5) { clicks = 0; makeItRain(); }
  });

  /* ---------- Reveals, wired after the first paint ---------- */

  const setupReveals = () => {
    if (!animate) return;
    $$('[data-words]').forEach((el) => {
      const words = splitWords(el);
      gsap.set(words, { yPercent: 110, rotate: 4 });
      onEnter([el], () => gsap.to(words, { yPercent: 0, rotate: 0, duration: 1, ease: 'back.out(1.6)', stagger: 0.035 }), '-12%');
    });
    const fades = $$('[data-reveal]');
    gsap.set(fades, { opacity: 0, y: 30 });
    onEnter(fades, (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }), '-6%');
    const pops = $$('.holo, .flip, .deck, .play__board, .dock__sea');
    gsap.set(pops, { opacity: 0, scale: 0.92, y: 40 });
    onEnter(pops, (b) => gsap.to(b, { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'back.out(1.4)', stagger: 0.1, clearProps: 'transform' }), '-8%');
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => ScrollTrigger.refresh());
  };
  requestAnimationFrame(() => setTimeout(setupReveals, 0));
})();
