/* Sainjal Poly — portfolio motion: GSAP + ScrollTrigger + Lenis.
   Everything here is progressive: without JS, or with reduced motion, the page is fully readable. */
(() => {
  'use strict';

  window.__siteBooted = true;

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const animate = hasGsap && !reduceMotion;

  /* ---------- Static bits ---------- */

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const tick = () => { clock.textContent = `${fmt.format(new Date())} IST`; };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- Smooth scroll ---------- */

  let lenis = null;
  if (animate) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.4 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ---------- Mobile menu ---------- */

  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  const setMenu = (open) => {
    if (!toggle || !menu || root.classList.contains('menu-open') === open) return;
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    $('[data-label]', toggle).textContent = open ? 'Close' : 'Menu';
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    if (lenis) (open ? lenis.stop() : lenis.start());
  };
  toggle?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- In-page links ---------- */

  const easeInOutQuint = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
  $$('a[href^="#"]:not(.skip)').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = $(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      if (lenis) lenis.scrollTo(target, { duration: 2.2, easing: easeInOutQuint });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Small delights: binary scramble, motto, Atoms ↔ Bits, brain meter ---------- */

  // Text dissolves into 0s and 1s, then resolves left to right.
  const scrambleTo = (el, text, duration = 800) => {
    if (reduceMotion) { el.textContent = text; return; }
    cancelAnimationFrame(el.scrambleFrame);
    const start = performance.now();
    const frame = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const reveal = Math.floor((1 - (1 - p) ** 2) * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) out += i < reveal || text[i] === ' ' ? text[i] : (Math.random() < 0.5 ? '0' : '1');
      el.textContent = out;
      if (p < 1) el.scrambleFrame = requestAnimationFrame(frame);
    };
    el.scrambleFrame = requestAnimationFrame(frame);
  };

  // Smoothly chases a target value; `spring` adds a little overshoot.
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
  const whenVisible = (el, cb, threshold = 0) => new IntersectionObserver(([entry]) => cb(entry.isIntersecting), { threshold }).observe(el);

  $$('[data-scramble]').forEach((el) => {
    const text = el.textContent;
    if (finePointer) el.addEventListener('mouseenter', () => scrambleTo(el, text));
    let shown = false;
    whenVisible(el, (on) => { if (on && !shown) { shown = true; scrambleTo(el, text, 1100); } }, 0.6);
  });

  const motto = $('[data-motto]');
  if (motto && !reduceMotion) {
    const phrases = ['Brain before bytes', 'Living in 0s & 1s', 'Diagrams before code', 'Left brain + right brain'];
    let i = 0;
    let visible = true;
    whenVisible(motto, (on) => { visible = on; });
    setInterval(() => {
      if (!visible || document.hidden) return;
      i = (i + 1) % phrases.length;
      scrambleTo(motto, phrases[i], 900);
    }, 3600);
  }

  const duo = $('[data-duo]');
  let duoSplit = null;
  let duoTouched = false;
  if (duo) {
    const range = $('.duo__range', duo);
    duoSplit = follow(50, (v) => {
      duo.style.setProperty('--split', v.toFixed(2));
      duo.classList.toggle('is-atoms', v > 62);
      duo.classList.toggle('is-bits', v < 38);
    }, { ease: 0.12 });
    const fromPointer = (e) => {
      duoTouched = true;
      const r = duo.getBoundingClientRect();
      duoSplit.set(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    };
    duo.addEventListener('pointermove', fromPointer);
    duo.addEventListener('pointerdown', fromPointer);
    duo.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') duoSplit.set(50); });
    range.addEventListener('input', () => { duoTouched = true; duoSplit.set(Number(range.value), true); });

    // A living field of 0s and 1s on the software side.
    const binary = $('[data-binary]', duo);
    if (binary && !reduceMotion) {
      const rows = 44;
      const cols = 48;
      const bit = () => (Math.random() < 0.5 ? '0' : '1');
      const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < 0.2 ? ' ' : bit())));
      const draw = () => { binary.textContent = grid.map((row) => row.join('')).join('\n'); };
      draw();
      let on = false;
      whenVisible(duo, (v) => { on = v; });
      setInterval(() => {
        if (!on || document.hidden) return;
        for (let k = 0; k < 60; k++) {
          const row = grid[(Math.random() * rows) | 0];
          const c = (Math.random() * cols) | 0;
          row[c] = row[c] === ' ' ? bit() : (Math.random() < 0.15 ? ' ' : (row[c] === '0' ? '1' : '0'));
        }
        draw();
      }, 110);
    }
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
      const v = Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100));
      pos.set(v);
      setMood(v < 42 ? 'left' : v > 58 ? 'right' : 'mid');
    };
    brain.addEventListener('pointermove', fromPointer);
    brain.addEventListener('pointerdown', fromPointer);
    brain.addEventListener('pointerleave', () => { pos.set(50); if (mood !== 'mid') setMood('back'); });
  }

  if (!animate) {
    if (!hasGsap) root.classList.remove('js');
    if (reduceMotion) $$('svg').forEach((svg) => svg.pauseAnimations?.());
    root.classList.add('reduced');
    $('.loader')?.remove();
    return;
  }

  /* ---------- Text splitting ---------- */

  // Wraps every word in a mask so it can rise into place. Keeps inline elements like <em>.
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

  const splitChars = (el) => {
    const text = el.textContent;
    el.textContent = '';
    return Array.from(text).map((ch) => {
      const span = document.createElement('span');
      span.className = 'c';
      span.textContent = ch;
      el.append(span);
      return span;
    });
  };

  /* ---------- Intro: counter, then the letterbox opens onto the hero ---------- */

  const loader = $('.loader');
  const heroChars = $$('[data-chars]').flatMap(splitChars);
  const heroFades = $$('[data-hero-fade]');

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  lenis?.stop();

  gsap.set(heroChars, { yPercent: 118 });
  gsap.set(heroFades, { opacity: 0, y: 24 });
  gsap.set('.hero__img', { scale: 1.28 });
  gsap.set('.hero__rule', { scaleX: 0 });
  gsap.set('.nav', { opacity: 0 });
  gsap.set('.loader__name span', { yPercent: 110 });
  gsap.set('.loader__role', { opacity: 0 });

  const imageReady = (img) => (!img || img.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }));
  const assetsReady = Promise.race([
    Promise.all([document.fonts ? document.fonts.ready : null, imageReady($('.hero__img'))]),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);

  const counter = { v: 0 };
  const countEl = $('.loader__count');
  const barEl = $('.loader__bar span');
  const preload = gsap.timeline()
    .to('.loader__name span', { yPercent: 0, duration: 1.3, ease: 'expo.out' })
    .to('.loader__role', { opacity: 1, duration: 1, ease: 'power2.out' }, 0.25)
    .to(counter, {
      v: 100,
      duration: 1.9,
      ease: 'power2.inOut',
      onUpdate: () => {
        countEl.textContent = String(Math.round(counter.v)).padStart(3, '0');
        barEl.style.transform = `scaleX(${counter.v / 100})`;
      },
    }, 0);

  const reveal = () => {
    gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => { loader.remove(); ScrollTrigger.refresh(); },
    })
      .to('.loader__inner', { yPercent: -30, opacity: 0, duration: 1, ease: 'power3.in' }, 0)
      .to('.loader__bar, .loader__count', { opacity: 0, duration: 0.6, ease: 'power2.in' }, 0)
      .to('.loader__panel--top', { yPercent: -100, duration: 1.7, ease: 'expo.inOut' }, 0.55)
      .to('.loader__panel--bottom', { yPercent: 100, duration: 1.7, ease: 'expo.inOut' }, 0.55)
      .to('.hero__img', { scale: 1, duration: 3, ease: 'expo.out' }, 0.75)
      .to(heroChars, { yPercent: 0, duration: 1.9, stagger: 0.05 }, 1.05)
      .to('.hero__rule', { scaleX: 1, duration: 1.9, ease: 'expo.inOut' }, 1.2)
      .to(heroFades, { opacity: 1, y: 0, duration: 1.6, stagger: 0.1 }, 1.5)
      .to('.nav', { opacity: 1, duration: 1.4, ease: 'power2.out' }, 1.6)
      .call(() => { loader.style.pointerEvents = 'none'; lenis?.start(); }, null, 1.6);
  };

  Promise.all([assetsReady, preload.then()]).then(reveal);

  /* ---------- Hero: layered parallax on the way out ---------- */

  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__parallax', { yPercent: 14, scale: 1.08, ease: 'none', duration: 1 }, 0)
    .to('.hero__dim', { opacity: 0.7, ease: 'none', duration: 1 }, 0)
    .to('.hero__title', { yPercent: -22, ease: 'none', duration: 1 }, 0)
    .to('.hero__content', { y: () => -window.innerHeight * 0.1, opacity: 0, ease: 'none', duration: 0.7 }, 0)
    .to('.hero__hud', { yPercent: -40, opacity: 0, ease: 'none', duration: 0.35 }, 0);

  /* ---------- Reveals ---------- */

  $$('[data-reveal-words]').forEach((el) => {
    gsap.from(splitWords(el), {
      yPercent: 115,
      duration: 1.7,
      ease: 'expo.out',
      stagger: 0.04,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });

  $$('[data-scrub-words]').forEach((el) => {
    gsap.fromTo(splitWords(el), { opacity: 0.12 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.8 },
    });
  });

  const fades = $$('[data-reveal]');
  gsap.set(fades, { opacity: 0, y: 36 });
  ScrollTrigger.batch(fades, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.6, ease: 'expo.out', stagger: 0.1, overwrite: true }),
  });

  $$('.rule').forEach((rule) => {
    gsap.fromTo(rule, { scaleX: 0 }, {
      scaleX: 1,
      duration: 1.9,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: rule.parentElement, start: 'top 92%', once: true },
    });
  });

  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const value = { v: 0 };
    el.textContent = '0';
    gsap.to(value, {
      v: end,
      duration: 2.4,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = Math.round(value.v); },
    });
  });

  /* ---------- Framed images: wipe in, then drift inside the frame ---------- */

  $$('[data-frame]').forEach((frame) => {
    const img = $('img', frame);
    gsap.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 2,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: frame, start: 'top 85%', once: true },
    });
    gsap.fromTo(img, { yPercent: -7, scale: 1.12 }, {
      yPercent: 7,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  if (duo) {
    gsap.fromTo(duo, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 2,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: duo, start: 'top 85%', once: true },
    });
    gsap.fromTo($$('img', duo), { scale: 1.12 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: duo, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    // One slow sweep to show it can be dragged, unless someone beat us to it.
    ScrollTrigger.create({
      trigger: duo,
      start: 'top 55%',
      once: true,
      onEnter: () => {
        [[600, 26], [1700, 74], [2900, 50]].forEach(([delay, v]) => setTimeout(() => { if (!duoTouched) duoSplit.set(v); }, delay));
      },
    });
  }

  $$('[data-depth]').forEach((el) => {
    const depth = parseFloat(el.dataset.depth) || 0;
    gsap.fromTo(el, { yPercent: -depth }, {
      yPercent: depth,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ---------- Image expansion ---------- */

  const expand = $('.expand');
  if (expand) {
    // Start from the card the CSS draws (framed on the face), then open it to full bleed.
    const startInset = () => {
      const css = getComputedStyle(expand);
      const v = (name) => css.getPropertyValue(name).trim();
      return `inset(${v('--card-top')} ${v('--card-x')} ${v('--card-bottom')} ${v('--card-x')} round 18px)`;
    };
    const caption = $$('.expand__caption > *');
    gsap.set(caption, { y: 40, opacity: 0 });
    gsap.timeline({ scrollTrigger: { trigger: expand, start: 'top top', end: 'bottom bottom', scrub: 1.2, invalidateOnRefresh: true } })
      .fromTo('.expand__frame', { clipPath: startInset }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', duration: 1 }, 0)
      .fromTo('.expand__img', { scale: 1.15 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .to('.expand__line--a', { xPercent: -40, opacity: 0, ease: 'none', duration: 0.6 }, 0)
      .to('.expand__line--b', { xPercent: 40, opacity: 0, ease: 'none', duration: 0.6 }, 0)
      .fromTo('.expand__shade', { opacity: 0.25 }, { opacity: 1, ease: 'none', duration: 0.35 }, 0.7)
      .to(caption, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.3, stagger: 0.06 }, 0.8)
      .to({}, { duration: 0.2 });
  }

  /* ---------- Work chapters ---------- */

  $$('.chapter__ghost').forEach((ghost) => {
    gsap.fromTo(ghost, { xPercent: 8 }, {
      xPercent: -28,
      ease: 'none',
      scrollTrigger: { trigger: ghost.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ---------- Diagrams: open up, draw their lines, then come alive ---------- */

  // A dotted copy of each connection carries particles in the direction of flow.
  $$('[data-flow]').forEach((path) => {
    const flow = path.cloneNode();
    ['pathLength', 'data-draw', 'data-flow', 'id'].forEach((attr) => flow.removeAttribute(attr));
    flow.setAttribute('class', 'flow');
    path.after(flow);
  });

  $$('.viz').forEach((viz) => {
    gsap.fromTo(viz, { clipPath: 'inset(14% 10% 14% 10%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'none',
      scrollTrigger: { trigger: viz, start: 'top 95%', end: 'top 40%', scrub: 1 },
    });
    gsap.fromTo($('.viz__zoom', viz), { scale: 1.25 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: viz, start: 'top 95%', end: 'top 30%', scrub: 1 },
    });
    gsap.timeline({ scrollTrigger: { trigger: viz, start: 'top 80%', end: 'center 55%', scrub: 1 } })
      .fromTo($$('[data-draw]', viz), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', stagger: 0.12 })
      .fromTo($$('[data-mover], .flow', viz), { opacity: 0 }, { opacity: 1, duration: 0.15 });
    gsap.from($$('[data-node]', viz), {
      scale: 0,
      opacity: 0,
      transformOrigin: '50% 50%',
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: viz, start: 'top 70%', once: true },
    });
  });

  /* ---------- Exploded stack: assembles, then highlights layer by layer ---------- */

  const iso = $('[data-iso]');
  if (iso) {
    gsap.from($$('[data-plate]', iso), {
      y: -70,
      opacity: 0,
      duration: 1.5,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: iso, start: 'top 75%', once: true },
    });

    const items = $$('.anatomy .layer[data-layer]');
    const setActive = (n) => {
      iso.classList.toggle('has-active', Boolean(n));
      $$('[data-layer]', iso).forEach((el) => el.classList.toggle('is-active', el.dataset.layer === n));
      items.forEach((el) => el.classList.toggle('is-active', el.dataset.layer === n));
    };
    let timer = null;
    let step = 0;
    let hovering = false;
    const cycle = (on) => {
      clearInterval(timer);
      timer = null;
      if (!on) { setActive(null); return; }
      timer = setInterval(() => {
        if (hovering) return;
        step = (step % items.length) + 1;
        setActive(String(step));
      }, 2600);
    };
    ScrollTrigger.create({ trigger: '.anatomy', start: 'top 70%', end: 'bottom 30%', onToggle: (self) => cycle(self.isActive) });
    [...items, ...$$('.plate', iso)].forEach((el) => {
      el.addEventListener('pointerenter', () => { hovering = true; step = Number(el.dataset.layer); setActive(el.dataset.layer); });
      el.addEventListener('pointerleave', () => { hovering = false; });
    });
  }

  /* ---------- Ideogram icons: drawn in once, redrawn on hover ---------- */

  const strokes = new Map();
  $$('[data-icon]').forEach((icon) => {
    const shapes = $$('path, circle, rect, ellipse, line', icon).filter((el) => !el.classList.contains('dash'));
    shapes.forEach((el) => el.setAttribute('pathLength', '1'));
    icon.classList.add('is-drawable');
    gsap.set(shapes, { strokeDashoffset: 1 });
    gsap.set($$('.dash', icon), { opacity: 0 });
    strokes.set(icon, shapes);
  });
  ScrollTrigger.batch('[data-icon]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => batch.forEach((icon, i) => {
      gsap.to(strokes.get(icon), { strokeDashoffset: 0, duration: 1.7, ease: 'power2.inOut', stagger: 0.09, delay: i * 0.1 });
      gsap.to($$('.dash', icon), { opacity: 1, duration: 1, delay: 0.8 + i * 0.1 });
    }),
  });
  if (finePointer) {
    strokes.forEach((shapes, icon) => {
      icon.closest('.feature, .pattern')?.addEventListener('mouseenter', () => {
        gsap.fromTo(shapes, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.05, overwrite: true });
      });
    });
  }

  $$('[data-band-img]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: img.closest('.band'), start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ---------- Marquee: slow drift, nudged by scroll speed ---------- */

  const track = $('.marquee__track');
  if (track) {
    const loop = gsap.to(track, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
    let boost = 0;
    let speed = 1;
    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
      onUpdate: (self) => { boost = Math.min(Math.abs(self.getVelocity()) / 250, 6); },
    });
    gsap.ticker.add(() => {
      speed += (1 + boost - speed) * 0.06;
      boost *= 0.9;
      loop.timeScale(speed);
    });
  }

  /* ---------- Chrome: nav, progress, wordmark ---------- */

  const nav = $('.nav');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      if (root.classList.contains('menu-open')) return;
      nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > window.innerHeight * 0.5);
    },
  });

  gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });

  gsap.fromTo('.wordmark span', { yPercent: 100 }, {
    yPercent: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.wordmark', start: 'top bottom', end: 'max', scrub: true },
  });

  /* ---------- Cursor + magnetic buttons ---------- */

  if (finePointer) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    root.classList.add('has-cursor');
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.6, ease: 'power3' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.6, ease: 'power3' });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!cursor.classList.contains('is-visible')) {
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
        cursor.classList.add('is-visible');
      }
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));

    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('a, button, [data-cursor]');
      const text = el?.dataset.cursor || '';
      cursor.classList.toggle('is-label', Boolean(text));
      cursor.classList.toggle('is-link', Boolean(el) && !text);
      if (text) label.textContent = text;
    });

    $$('[data-magnetic]').forEach((el) => {
      const pull = 0.3;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * pull);
        yTo((e.clientY - (r.top + r.height / 2)) * pull);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
