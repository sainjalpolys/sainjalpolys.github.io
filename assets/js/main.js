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
  const COLORS = ['#ff7a3d', '#14b8a6', '#4f7cff', '#ef4444', '#f5b301', '#8b5cf6'];
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

  /* ---------- Day / night ---------- */

  const themeListeners = [];
  const isNight = () => root.getAttribute('data-theme') === 'dark';
  const themeBtn = $('[data-theme-toggle]');
  const syncThemeButton = () => themeBtn?.setAttribute('aria-label', isNight() ? 'Switch to day mode' : 'Switch to night mode');
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070b18' : '#eef5ff');
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
  $$('#top, #about, #galaxy, #voyage, #work, #play, #contact').forEach((s) => new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${s.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' }).observe(s));

  /* ---------- Cursor & magnetic buttons ---------- */

  const pointer = { x: -999, y: -999 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  if (finePointer && !reduceMotion) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    root.classList.add('has-cursor');
    const d = { x: -99, y: -99 };
    const r = { x: -99, y: -99, vx: 0, vy: 0 };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !cursor.classList.contains('is-visible')) { d.x = r.x = e.clientX; d.y = r.y = e.clientY; cursor.classList.add('is-visible'); }
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    loops.push({ on: true, fn: () => {
      d.x = lerp(d.x, pointer.x, 0.55); d.y = lerp(d.y, pointer.y, 0.55);
      r.vx = (r.vx + (pointer.x - r.x) * 0.16) * 0.68; r.vy = (r.vy + (pointer.y - r.y) * 0.16) * 0.68;
      r.x += r.vx; r.y += r.vy;
      dot.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
      ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    } });
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-cursor], a, button, [role="button"]');
      const text = el?.dataset.cursor || '';
      cursor.classList.toggle('is-label', Boolean(text));
      cursor.classList.toggle('is-hover', Boolean(el) && !text);
      if (text) label.textContent = text;
    });
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

  const whenThree = (fn) => {
    if (window.THREE) { fn(window.THREE); return; }
    window.addEventListener('three-ready', () => fn(window.THREE), { once: true });
  };
  setTimeout(() => { if (!window.THREE) root.classList.add('no-webgl'); }, 9000);

  /* ---------- HERO: the 3D container port ---------- */

  const PORT_TECH = [
    ['Java', 'Backend'], ['Spring Boot', 'Backend'], ['Spring Security', 'Backend'], ['Hibernate / JPA', 'Backend'],
    ['REST APIs', 'Integration'], ['Microservices', 'Architecture'], ['Event-driven', 'Architecture'], ['RBAC', 'Security'],
    ['PostgreSQL', 'Data'], ['Elasticsearch', 'Search'], ['Apache Solr', 'Search'], ['MSSQL', 'Data'],
    ['Memcache / Redis', 'Caching'], ['Google Cloud', 'Cloud'], ['Cloud Run', 'Cloud'], ['Pub/Sub', 'Messaging'],
    ['BigQuery', 'Analytics'], ['Docker', 'Containers (the other kind)'], ['Kubernetes', 'Orchestration'], ['Jenkins', 'CI/CD'],
    ['GitHub Actions', 'CI/CD'], ['GitLab CI', 'CI/CD'], ['Maven', 'Build'], ['System design', 'Practice'],
  ];

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd9ecff, 45, 110);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
    const world = new THREE.Group();
    scene.add(world);
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
    let dirty = true;

    // Light
    const hemi = new THREE.HemisphereLight(0xdbeeff, 0x8aa0c0, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(16, 28, 14);
    sun.castShadow = !coarse;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // Low-poly sea, gently animated
    const seg = coarse ? 26 : 44;
    const waterGeo = new THREE.PlaneGeometry(140, 140, seg, seg).toNonIndexed();
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = std(0x3aa6e6, { flatShading: true, roughness: 0.3, metalness: 0.1 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.7;
    water.receiveShadow = !coarse;
    world.add(water);
    const wPos = waterGeo.attributes.position;
    const wBase = Float32Array.from(wPos.array);
    const waves = (t) => {
      const a = wPos.array;
      for (let i = 0; i < wPos.count; i++) {
        const x = wBase[i * 3];
        const z = wBase[i * 3 + 2];
        a[i * 3 + 1] = Math.sin(x * 0.32 + t * 0.9) * 0.2 + Math.cos(z * 0.28 + t * 0.7) * 0.17 + Math.sin((x + z) * 0.55 + t * 1.5) * 0.05;
      }
      wPos.needsUpdate = true;
      waterGeo.computeVertexNormals();
    };
    waves(0);

    // The island: concrete apron, quay edge, yellow safety lines, lane markings
    const islandMat = std(0xe8edf5, { roughness: 0.85 });
    const island = new THREE.Mesh(new THREE.BoxGeometry(17, 1.4, 11.5), islandMat);
    island.position.y = -0.7;
    island.receiveShadow = !coarse;
    world.add(island);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(17.5, 1.1, 12), std(0x5f6b86, { roughness: 0.9 }));
    edge.position.y = -1.05;
    world.add(edge);
    const lineMat = std(0xf5b301, { roughness: 0.5 });
    [5.55, -5.55].forEach((z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.04, 0.14), lineMat);
      m.position.set(0, 0.02, z);
      world.add(m);
    });
    const laneMat = std(0xffffff, { roughness: 0.6 });
    for (let x = -7; x <= 7; x += 1.4) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.08), laneMat);
      m.position.set(x, 0.02, -0.98);
      world.add(m);
    }

    // Containers: instanced, and every stack's top box carries a technology
    const stripes = new THREE.CanvasTexture(stripeCanvas());
    stripes.colorSpace = THREE.SRGBColorSpace;
    const boxGeo = new THREE.BoxGeometry(2.0, 0.86, 0.86);
    const rand = rng(42);
    const stacks = [];
    const ROWS = [-4.4, -3.4, -2.4, 0.4, 1.4, 2.4];
    const COLS = [-6.3, -4.1, -1.9, 0.3, 2.5, 4.7];
    let techIdx = 0;
    ROWS.forEach((z, ri) => COLS.forEach((x, ci) => {
      if ((ri === 2 || ri === 3) && (ci === 0 || ci === 5)) return; // room for the trucks
      const h = 1 + Math.floor(rand() * 3);
      const tech = techIdx < PORT_TECH.length ? PORT_TECH[techIdx++] : PORT_TECH[Math.floor(rand() * PORT_TECH.length)];
      stacks.push({ x: x + (rand() - 0.5) * 0.12, z, h, tech });
    }));
    const total = stacks.reduce((s, st) => s + st.h, 0);
    const boxes = new THREE.InstancedMesh(boxGeo, std(0xffffff, { map: stripes, roughness: 0.55, metalness: 0.15 }), total);
    boxes.castShadow = !coarse;
    boxes.receiveShadow = !coarse;
    const inst = [];
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    let k = 0;
    stacks.forEach((st, si) => {
      st.ids = [];
      for (let lvl = 0; lvl < st.h; lvl++) {
        const color = new THREE.Color(COLORS[Math.floor(rand() * COLORS.length)]);
        inst.push({ si, lvl, color, lift: 0, liftTarget: 0, vy: 0, jump: 0, spin: 0, spinV: 0 });
        dummy.position.set(st.x, 0.43 + lvl * 0.88, st.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        boxes.setMatrixAt(k, dummy.matrix);
        boxes.setColorAt(k, color);
        st.ids.push(k);
        k++;
      }
    });
    boxes.instanceMatrix.needsUpdate = true;
    world.add(boxes);
    const placeInstance = (id) => {
      const it = inst[id];
      const st = stacks[it.si];
      dummy.position.set(st.x, 0.43 + it.lvl * 0.88 + it.lift + it.jump, st.z);
      dummy.rotation.set(0, it.spin, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      boxes.setMatrixAt(id, dummy.matrix);
    };

    // Trucks waiting by the stacks
    const truck = (x, z, color, flip) => {
      const g = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.8), std(color));
      cab.position.set(0.95, 0.45, 0);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.8), std(0x2b3550));
      bed.position.set(-0.3, 0.2, 0);
      const box = new THREE.Mesh(boxGeo, std(COLORS[2], { map: stripes }));
      box.scale.set(0.85, 0.8, 0.85);
      box.position.set(-0.3, 0.64, 0);
      [cab, bed, box].forEach((m) => { m.castShadow = !coarse; g.add(m); });
      g.position.set(x, 0, z);
      if (flip) g.rotation.y = Math.PI;
      world.add(g);
      return g;
    };
    const trucks = [truck(-6.3, -0.95, 0xef4444), truck(5.6, -0.35, 0x14b8a6, true)];

    // Lamp posts that light up at night
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffc861, emissiveIntensity: 0 });
    [[-8, -5.4], [8, -5.4], [-8, 5.4], [8, 5.4]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), std(0x6b7690));
      pole.position.set(x, 1.6, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bulbMat);
      bulb.position.set(x, 3.25, z);
      world.add(pole, bulb);
    });

    // A ship-to-shore crane on the quay
    const craneMat = std(0x3f6cf0, { roughness: 0.5, metalness: 0.2 });
    const darkMat = std(0x22283a);
    const crane = new THREE.Group();
    const part = (w, h, d, x, y, z, mat = craneMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = !coarse; crane.add(m); return m; };
    [[-1.3, 4.3], [1.3, 4.3], [-1.3, 6.3], [1.3, 6.3]].forEach(([x, z]) => part(0.26, 6.2, 0.26, x, 3.1, z));
    part(2.9, 0.3, 0.3, 0, 6.2, 4.3); part(2.9, 0.3, 0.3, 0, 6.2, 6.3); part(2.9, 0.3, 0.3, 0, 2.2, 4.3); part(2.9, 0.3, 0.3, 0, 2.2, 6.3);
    part(0.34, 0.34, 11, -0.5, 6.6, 6.8); part(0.34, 0.34, 11, 0.5, 6.6, 6.8);
    part(0.2, 2.6, 0.2, 0, 7.9, 4.8);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xff2a2a, emissiveIntensity: 0.4 }));
    beacon.position.set(0, 9.3, 4.8);
    crane.add(beacon);
    const trolley = part(1.3, 0.35, 0.8, 0, 6.25, 8);
    const cable = part(0.05, 1, 0.05, 0, 5.6, 8, darkMat);
    const spreader = part(2.1, 0.12, 0.9, 0, 4.6, 8, darkMat);
    const carried = new THREE.Mesh(boxGeo, std(COLORS[4], { map: stripes, roughness: 0.55 }));
    carried.castShadow = !coarse;
    crane.add(carried);
    world.add(crane);

    // A container ship sailing around the island
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-3.6, -1.05); hullShape.lineTo(2.6, -1.05); hullShape.quadraticCurveTo(3.9, 0, 2.6, 1.05); hullShape.lineTo(-3.6, 1.05); hullShape.lineTo(-3.6, -1.05);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.1, bevelEnabled: false });
    hullGeo.rotateX(-Math.PI / 2);
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, std(0x1c2a4d, { roughness: 0.6 }));
    hull.position.y = -0.5;
    const band = new THREE.Mesh(hullGeo, std(0xef4444));
    band.scale.set(1.01, 0.25, 1.01);
    band.position.y = -0.62;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 1.6), std(0xf4f6fb));
    bridge.position.set(-2.9, 1.25, 0);
    ship.add(hull, band, bridge);
    const deckRand = rng(7);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const layers = 1 + Math.floor(deckRand() * 2);
      for (let l = 0; l < layers; l++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.82), std(COLORS[Math.floor(deckRand() * COLORS.length)], { map: stripes, roughness: 0.55 }));
        c.position.set(-1.7 + i * 1.22, 0.86 + l * 0.52, -0.43 + j * 0.86);
        ship.add(c);
      }
    }
    ship.traverse((m) => { if (m.isMesh) m.castShadow = !coarse; });
    world.add(ship);

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
      c.position.set(-30 + i * 12 + cRand() * 4, 11 + cRand() * 5, -20 + cRand() * 30);
      c.userData.speed = 0.4 + cRand() * 0.5;
      clouds.add(c);
    }
    scene.add(clouds);
    const starPos = new Float32Array(600 * 3);
    const sRand = rng(11);
    for (let i = 0; i < 600; i++) {
      const th = sRand() * Math.PI * 2;
      const ph = sRand() * 0.45 * Math.PI;
      starPos[i * 3] = Math.cos(th) * Math.sin(ph) * 120;
      starPos[i * 3 + 1] = Math.cos(ph) * 80 + 10;
      starPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * 120;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(stars);

    // A burst of confetti boxes when a container is clicked
    const burst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), 36);
    const bits = Array.from({ length: 36 }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    bits.forEach((b, i) => {
      burst.setColorAt(i, new THREE.Color(COLORS[i % 6]));
      dummy.position.set(0, -60, 0); dummy.updateMatrix();
      burst.setMatrixAt(i, dummy.matrix);
    });
    world.add(burst);
    const pop = (x, y, z) => bits.forEach((b) => {
      b.life = 1;
      b.p.set(x, y, z);
      b.v.set((Math.random() - 0.5) * 7, 4 + Math.random() * 5, (Math.random() - 0.5) * 7);
    });

    // Day / night palette
    const DAY = { hemiSky: 0xdbeeff, hemiGround: 0x8aa0c0, hemiI: 1.15, sun: 0xffffff, sunI: 2.3, fog: 0xd9ecff, water: 0x3aa6e6, island: 0xe8edf5, exposure: 1.05 };
    const NIGHT = { hemiSky: 0x5a6fc0, hemiGround: 0x1a2340, hemiI: 1.0, sun: 0xb8c6ff, sunI: 1.25, fog: 0x0b1433, water: 0x17468f, island: 0x6a7591, exposure: 1.1 };
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
      bulbMat.emissiveIntensity = t * 3;
      stars.material.opacity = t;
      cloudMat.opacity = lerp(0.95, 0.12, t);
      dirty = true;
    };
    themeListeners.push((night) => {
      if (hasGsap && !reduceMotion) gsap.to(mood, { night: night ? 1 : 0, duration: 1.2, ease: 'power2.inOut', onUpdate: applyMood });
      else { mood.night = night ? 1 : 0; applyMood(); }
    });

    // Camera: slow orbit, drag to spin, scroll to rise away
    const view = { theta: 0.65, phi: 0.98, radius: 36, vTheta: 0, vPhi: 0, scroll: 0 };
    const layout = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Push the port right on wide screens and up on narrow ones, so the words have room.
      if (w > 900) camera.setViewOffset(w * 1.42, h, 0, 0, w, h);
      else camera.setViewOffset(w, h * 1.5, 0, h * 0.5, w, h);
      view.radius = w > 900 ? 42 : w > 600 ? 48 : 54;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    layout();
    window.addEventListener('resize', layout);
    applyMood();

    // Pointer: drag to rotate, hover for a tooltip, click to make a container jump
    const tip = $('[data-tip]');
    const tipName = $('[data-tip-name]');
    const tipCat = $('[data-tip-cat]');
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tipAt = new THREE.Vector3();
    let hoverStack = -1;
    let drag = null;
    let tipTimer = 0;
    const topId = (si) => stacks[si].ids[stacks[si].ids.length - 1];
    const setHover = (si) => {
      if (si === hoverStack) return;
      if (hoverStack >= 0) {
        const id = topId(hoverStack);
        inst[id].liftTarget = 0;
        boxes.setColorAt(id, inst[id].color);
      }
      hoverStack = si;
      if (si >= 0) {
        const id = topId(si);
        inst[id].liftTarget = 0.42;
        boxes.setColorAt(id, tmpColor.copy(inst[id].color).lerp(white, 0.22));
        tipName.textContent = stacks[si].tech[0];
        tipCat.textContent = stacks[si].tech[1];
        tip.classList.add('is-on');
      } else tip.classList.remove('is-on');
      boxes.instanceColor.needsUpdate = true;
      dirty = true;
    };
    const pick = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(boxes, false)[0];
      return hit ? inst[hit.instanceId].si : -1;
    };
    const placeTip = () => {
      if (hoverStack < 0) return;
      const id = topId(hoverStack);
      const st = stacks[hoverStack];
      tipAt.set(st.x, 0.9 + inst[id].lvl * 0.88 + inst[id].lift + inst[id].jump, st.z);
      world.localToWorld(tipAt);
      tipAt.project(camera);
      const r = canvas.getBoundingClientRect();
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
        return;
      }
      if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
    });
    const endDrag = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasClick = !drag.moved;
      drag = null;
      hero.classList.remove('is-dragging');
      if (!wasClick || e.type !== 'pointerup') return;
      const si = pick(e.clientX, e.clientY);
      setHover(si);
      if (si < 0) return;
      const id = topId(si);
      inst[id].vy = 7.5;
      inst[id].spinV = (Math.random() < 0.5 ? -1 : 1) * 9;
      const st = stacks[si];
      pop(st.x, 1 + inst[id].lvl * 0.88, st.z);
      clearTimeout(tipTimer);
      if (e.pointerType !== 'mouse') tipTimer = setTimeout(() => setHover(-1), 2400);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) setHover(-1); });

    if (animate) {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: (self) => { view.scroll = self.progress; dirty = true; } });
    }

    const target = new THREE.Vector3(0, 0.6, 0.8);
    const render = (t, dt) => {
      if (!reduceMotion) {
        if (!drag) {
          view.theta += 0.05 * dt + view.vTheta;
          view.vTheta *= 0.92;
          view.phi = clamp(view.phi + view.vPhi, 0.72, 1.28);
          view.vPhi *= 0.9;
        }
        waves(t);
        const a = t * 0.07;
        ship.position.set(Math.cos(a) * 15, Math.sin(t * 1.4) * 0.08, Math.sin(a) * 11.5);
        ship.rotation.set(Math.sin(t * 1.1) * 0.025, -a - Math.PI / 2, Math.sin(t * 0.9) * 0.03);
        crane.position.x = Math.sin(t * 0.18) * 4.5;
        const shuttle = (Math.sin(t * 0.55) + 1) / 2;
        const hoist = (Math.sin(t * 1.1) + 1) / 2;
        trolley.position.z = lerp(5, 10.2, shuttle);
        spreader.position.set(0, lerp(1.3, 5.6, hoist), trolley.position.z);
        carried.position.set(0, spreader.position.y - 0.5, trolley.position.z);
        cable.scale.y = Math.max(0.1, 6.2 - spreader.position.y);
        cable.position.set(0, (6.2 + spreader.position.y) / 2, trolley.position.z);
        beacon.material.emissiveIntensity = (Math.sin(t * 4) > 0.6 ? 2.5 : 0.3) * (0.3 + mood.night);
        trucks[0].position.x = -6.3 + Math.sin(t * 0.3) * 0.5;
        clouds.children.forEach((c) => { c.position.x += c.userData.speed * dt; if (c.position.x > 40) c.position.x = -40; });
        dirty = true;
      }

      let changed = false;
      inst.forEach((it, id) => {
        if (it.vy || it.jump > 0) {
          it.vy -= 22 * dt;
          it.jump = Math.max(0, it.jump + it.vy * dt);
          it.spin += it.spinV * dt;
          if (it.jump === 0 && it.vy < 0) { it.vy = 0; it.spin = Math.round(it.spin / Math.PI) * Math.PI; it.spinV = 0; }
          placeInstance(id);
          changed = true;
        }
        if (Math.abs(it.liftTarget - it.lift) > 0.001) {
          it.lift += (it.liftTarget - it.lift) * Math.min(1, dt * 12);
          placeInstance(id);
          changed = true;
        }
      });
      if (changed) { boxes.instanceMatrix.needsUpdate = true; dirty = true; }
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
      if (alive) { burst.instanceMatrix.needsUpdate = true; dirty = true; }

      if (!dirty) return;
      const radius = view.radius + view.scroll * 16;
      const phi = view.phi - view.scroll * 0.3;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(view.theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(view.theta),
      );
      camera.lookAt(target);
      world.position.y = -view.scroll * 3;
      renderer.render(scene, camera);
      placeTip();
      dirty = false;
    };
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

  /* ---------- Tech galaxy: a 3D sphere of logos ---------- */

  const GALAXY = [
    ['Java', 'backend', 'openjdk'], ['Spring Boot', 'backend', 'springboot'], ['Spring Security', 'backend', 'springsecurity'], ['Hibernate / JPA', 'backend', 'hibernate'],
    ['Maven', 'backend', 'apachemaven'], ['OpenFeign', 'backend', null, 'OF'], ['REST APIs', 'architecture', 'openapiinitiative'], ['Microservices', 'architecture', null, 'μS'],
    ['Event-driven', 'architecture', null, 'EV'], ['Distributed systems', 'architecture', null, 'DS'], ['Domain-driven design', 'architecture', null, 'DDD'], ['RBAC / ACL', 'architecture', null, 'AC'],
    ['Design patterns', 'architecture', null, 'DP'], ['JWT', 'architecture', 'jsonwebtokens'], ['Google Cloud', 'cloud', 'googlecloud'], ['Cloud Run', 'cloud', null, 'CR'],
    ['Pub/Sub', 'cloud', 'googlepubsub'], ['BigQuery', 'cloud', 'googlebigquery'], ['Cloud Storage', 'cloud', 'googlecloudstorage'], ['Docker', 'cloud', 'docker'],
    ['Kubernetes', 'cloud', 'kubernetes'], ['PostgreSQL', 'data', 'postgresql'], ['Elasticsearch', 'data', 'elasticsearch'], ['Apache Solr', 'data', 'apachesolr'],
    ['MSSQL', 'data', null, 'SQL'], ['Redis / Memcache', 'data', 'redis'], ['NoSQL', 'data', null, 'NoS'], ['Jenkins', 'devops', 'jenkins'],
    ['GitHub Actions', 'devops', 'githubactions'], ['GitLab CI', 'devops', 'gitlab'], ['Git', 'devops', 'git'], ['Swagger / OpenAPI', 'devops', 'swagger'],
    ['IntelliJ IDEA', 'ai', 'intellijidea'], ['Eclipse', 'ai', 'eclipseide'], ['Selenium', 'ai', 'selenium'], ['Python', 'ai', 'python'],
    ['JavaScript', 'ai', 'javascript'], ['OpenCV', 'ai', 'opencv'], ['GenAI & LLMs', 'ai', null, 'AI'], ['Data structures & algorithms', 'backend', null, 'DSA'],
  ];
  const CAT_NAME = { backend: 'Backend', architecture: 'Architecture', cloud: 'Cloud & containers', data: 'Data & search', devops: 'DevOps & delivery', ai: 'AI, ML & tools' };
  const galaxyStage = $('[data-galaxy]');
  if (galaxyStage) {
    const readCat = $('[data-galaxy-cat]');
    const readName = $('[data-galaxy-name]');
    readName.textContent = `${GALAXY.length} technologies`;
    const N = GALAXY.length;
    const tiles = GALAXY.map(([name, cat, slug, abbr], i) => {
      const el = document.createElement('div');
      el.className = 'gtile';
      el.dataset.cat = cat;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${name} — ${CAT_NAME[cat]}`);
      const svg = slug && iconSvg(slug);
      if (svg) el.append(svg);
      else {
        const t = document.createElement('span');
        t.className = 'gtile__txt';
        t.textContent = abbr;
        el.append(t);
        el.style.background = `color-mix(in srgb, ${COLORS[i % 6]} 20%, var(--surface))`;
      }
      el.addEventListener('pointerenter', () => { readCat.textContent = CAT_NAME[cat]; readName.textContent = name; el.classList.add('is-hot'); });
      el.addEventListener('pointerleave', () => el.classList.remove('is-hot'));
      galaxyStage.append(el);
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return { el, cat, v: [Math.cos(th) * rad, y, Math.sin(th) * rad], lit: true };
    });
    tintIcons();

    const spin = { rx: -0.25, ry: 0, vx: 0, vy: 0.004 };
    $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      const filter = b.dataset.filter;
      $$('[data-filter]').forEach((x) => x.classList.toggle('is-on', x === b));
      tiles.forEach((t) => { t.lit = filter === 'all' || t.cat === filter; });
      readCat.textContent = filter === 'all' ? 'Everything' : CAT_NAME[filter];
      readName.textContent = `${tiles.filter((t) => t.lit).length} technologies`;
      spin.vy += 0.05;
      if (reduceMotion) drawGalaxy();
    }));

    let gDrag = null;
    galaxyStage.addEventListener('pointerdown', (e) => { gDrag = { x: e.clientX, y: e.clientY, id: e.pointerId }; if (e.pointerType === 'mouse') galaxyStage.setPointerCapture(e.pointerId); });
    galaxyStage.addEventListener('pointermove', (e) => {
      if (!gDrag || gDrag.id !== e.pointerId) return;
      spin.vy = (e.clientX - gDrag.x) * 0.006;
      spin.vx = e.pointerType === 'mouse' ? (e.clientY - gDrag.y) * 0.004 : 0;
      gDrag.x = e.clientX; gDrag.y = e.clientY;
      if (reduceMotion) { spin.ry += spin.vy; spin.rx = clamp(spin.rx + spin.vx, -1.1, 1.1); drawGalaxy(); }
    });
    const gEnd = () => { gDrag = null; };
    galaxyStage.addEventListener('pointerup', gEnd);
    galaxyStage.addEventListener('pointercancel', gEnd);

    function drawGalaxy() {
      const R = Math.min(galaxyStage.clientWidth, galaxyStage.clientHeight) * 0.4;
      const cy = Math.cos(spin.ry); const sy = Math.sin(spin.ry);
      const cx = Math.cos(spin.rx); const sx = Math.sin(spin.rx);
      tiles.forEach((t) => {
        const [x0, y0, z0] = t.v;
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y2 = y0 * cx - z1 * sx;
        const z2 = y0 * sx + z1 * cx;
        const depth = (z2 + 1) / 2;
        t.el.style.transform = `translate3d(${(x1 * R).toFixed(1)}px, ${(y2 * R).toFixed(1)}px, 0) scale(${(0.55 + depth * 0.6).toFixed(3)})`;
        t.el.style.opacity = ((t.lit ? 0.25 : 0.06) + depth * (t.lit ? 0.75 : 0.12)).toFixed(3);
        t.el.style.zIndex = Math.round(depth * 100);
      });
    }
    drawGalaxy();
    if (!reduceMotion) {
      addLoop(galaxyStage, () => {
        if (!gDrag) { spin.vy = lerp(spin.vy, 0.0045, 0.02); spin.vx = lerp(spin.vx, 0, 0.05); }
        spin.ry += spin.vy;
        spin.rx = clamp(spin.rx + spin.vx, -1.1, 1.1);
        drawGalaxy();
      });
    }
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.2));
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
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), new THREE.MeshStandardMaterial({ color: 0x2b3550, roughness: 0.8 }));
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
  whenThree((THREE) => { try { buildGame(THREE); } catch (e) { console.warn('Game unavailable:', e); } });

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
    const pops = $$('.holo, .flip, .deck, .play__board, .dock__sea, .galaxy__stage');
    gsap.set(pops, { opacity: 0, scale: 0.92, y: 40 });
    onEnter(pops, (b) => gsap.to(b, { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'back.out(1.4)', stagger: 0.1, clearProps: 'transform' }), '-8%');
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => ScrollTrigger.refresh());
  };
  requestAnimationFrame(() => setTimeout(setupReveals, 0));
})();
