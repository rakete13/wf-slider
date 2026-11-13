/*!
 * WF Slider v1.0.0
 * Attribut-basierte Slider für Webflow, CMS und statisch
 *
 * Benötigt: gsap (Core). Keine Plugins.
 *
 * Nutzung: data-slider="carousel" | "fade" | "thumbs" an den Wrapper.
 * API: WFSlider.init(scope) · WFSlider.destroy(scope) · WFSlider.refresh() · WFSlider.get(elOderId)
 */
(() => {
  'use strict';
  if (window.WFSlider) return;

  const VERSION = '1.0.0';

  /* ------------------------------------------------------------------ */
  /*  Konfiguration (überschreibbar über window.WFSliderConfig vor dem   */
  /*  Laden des Skripts)                                                  */
  /* ------------------------------------------------------------------ */
  const userCfg = window.WFSliderConfig || {};
  const cfg = Object.assign(
    {
      duration: 0.8, // carousel: Dauer einer Bewegung
      fadeDuration: 1, // fade: Dauer der Überblendung
      ease: 'power3.out',
      autoplay: 5, // Sekunden, wenn data-slider-autoplay ohne Wert gesetzt ist
      distance: '2rem', // Weg der Inhalts-Animationen (data-slider-anim)
      mobileBreakpoint: 768,
      autoInit: true,
      debug: false,
    },
    userCfg
  );
  cfg.labels = Object.assign(
    {
      slider: 'Slider',
      thumbs: 'Vorschaubilder',
      slide: 'Slide',
      of: 'von',
      prev: 'Vorherige Slide',
      next: 'Nächste Slide',
      goto: 'Slide {n} anzeigen',
      pause: 'Autoplay pausieren',
      play: 'Autoplay starten',
    },
    userCfg.labels || {}
  );

  const html = document.documentElement;
  const warn = (...a) => console.warn('[WFSlider]', ...a);

  /* ------------------------------------------------------------------ */
  /*  Helfer                                                             */
  /* ------------------------------------------------------------------ */
  const num = (v, fb) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fb;
  };
  // data-slider-x="" oder ="true" → true, ="false" oder fehlend → false
  const bool = (v) => v !== undefined && v !== 'false';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (a, b) => ((a % b) + b) % b;
  const now = () => performance.now();

  const toPx = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    const unit = String(v).trim().replace(/^-?[\d.]+/, '');
    if (unit === 'rem' || unit === 'em') return n * parseFloat(getComputedStyle(html).fontSize);
    if (unit === 'vw') return (n * window.innerWidth) / 100;
    if (unit === 'vh') return (n * window.innerHeight) / 100;
    return n;
  };

  // Elemente, die zu genau diesem Slider gehören (nicht zu einem verschachtelten)
  const own = (root, sel) => Array.from(root.querySelectorAll(sel)).filter((el) => el.closest('[data-slider]') === root);

  const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isEditable = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');

  // Merkt sich Ausgangszustände, damit destroy() alles sauber zurücksetzt
  const restorer = () => {
    const styles = new Map();
    const fns = [];
    return {
      style(el) {
        if (el && !styles.has(el)) styles.set(el, el.getAttribute('style'));
        return el;
      },
      origDisplay(el) {
        const s = styles.has(el) ? styles.get(el) : el.getAttribute('style');
        const m = s && /(?:^|;)\s*display\s*:\s*([^;!]+)/.exec(s);
        return m ? m[1].trim() : '';
      },
      attr(el, name, value) {
        const old = el.getAttribute(name);
        fns.push(() => (old === null ? el.removeAttribute(name) : el.setAttribute(name, old)));
        el.setAttribute(name, value);
      },
      cls(el, c) {
        if (el.classList.contains(c)) return;
        el.classList.add(c);
        fns.push(() => el.classList.remove(c));
      },
      add(fn) {
        fns.push(fn);
      },
      run() {
        while (fns.length) fns.pop()();
        styles.forEach((s, el) => (s === null ? el.removeAttribute('style') : el.setAttribute('style', s)));
        styles.clear();
      },
    };
  };

  // Webflow baut Buttons oft als Div oder Link Block: so werden sie bedienbar
  const makeButton = (el, label, fn, R, on) => {
    const tag = el.tagName;
    const native = tag === 'BUTTON' || (tag === 'A' && el.hasAttribute('href'));
    if (!native) {
      R.attr(el, 'role', 'button');
      if (!el.hasAttribute('tabindex')) R.attr(el, 'tabindex', '0');
    }
    if (tag === 'BUTTON' && !el.hasAttribute('type')) R.attr(el, 'type', 'button');
    if (label && !el.hasAttribute('aria-label') && !el.textContent.trim()) R.attr(el, 'aria-label', label);
    on(el, 'click', (e) => {
      if (tag === 'A') e.preventDefault();
      fn(e);
    });
    if (!native || tag === 'A')
      on(el, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn(e);
        }
      });
  };

  const ENGINES = {};
  const F = {}; // optionale Bausteine (autoplay, anim)

  /* ------------------------------------------------------------------ */
  /*  Engine: carousel (auch Grundlage für thumbs)                       */
  /*  Loop ohne Klone: die echten Slides werden einzeln verschoben, so    */
  /*  bleiben Webflow Interactions, Lightboxen und IDs intakt.            */
  /* ------------------------------------------------------------------ */
  /*@block carousel,thumbs*/
  ENGINES.carousel = (c) => {
    const { track, viewport, slides, o, R } = c;
    const n = slides.length;
    const st = { p: 0 };
    let L = [];
    let W = [];
    let T = 0;
    let off = 0;
    let vpW = 0;
    let maxPos = 0;
    let maxW = 0;
    let lo = 0;
    let loopOn = false;
    let active = false;
    let snaps = [{ pos: 0, slide: 0 }];
    let tween = null;
    let goal = null; // Snap-Index, zu dem gerade animiert wird
    let measured = false;

    R.style(track);
    slides.forEach(R.style);
    R.style(viewport);
    R.style(c.root);
    // In Flex- und Grid-Eltern würde der Slider sonst so breit wie alle Slides zusammen
    c.root.style.minWidth = '0';
    viewport.style.minWidth = '0';
    if (!o.overflowVisible) viewport.style.overflow = 'hidden';

    const alignPos = (i) =>
      o.align === 'center' ? off + L[i] + W[i] / 2 - vpW / 2 : o.align === 'end' ? off + L[i] + W[i] - vpW : L[i];

    const xOf = (i) => (loopOn ? mod(L[i] - st.p - lo, T) + lo : L[i] - st.p);

    const nearest = (p) => {
      let best = 0;
      let bd = Infinity;
      snaps.forEach((s, i) => {
        const d = loopOn ? Math.abs(mod(p - s.pos + T / 2, T) - T / 2) : Math.abs(s.pos - p);
        if (d < bd - 0.5) {
          bd = d;
          best = i;
        }
      });
      return best;
    };
    const index = () => (active ? nearest(st.p) : 0);

    // Zielposition einer Snap-Stelle; im Loop die nächstgelegene Wiederholung in Laufrichtung
    const target = (i, dir, ref) => {
      const s = snaps[i].pos;
      if (!loopOn) return s;
      ref = ref === undefined ? st.p : ref;
      let t = s + T * Math.round((ref - s) / T);
      if (dir > 0 && t < ref - 0.5) t += T;
      if (dir < 0 && t > ref + 0.5) t -= T;
      return t;
    };

    const snapOfSlide = (i) => {
      if (!active) return 0;
      if (loopOn) return clamp(i, 0, n - 1);
      return nearest(clamp(alignPos(clamp(i, 0, n - 1)), 0, maxPos));
    };

    const render = () => {
      if (!active) {
        track.style.transform = '';
        slides.forEach((s) => (s.style.transform = ''));
      } else if (!loopOn) {
        track.style.transform = `translate3d(${-st.p}px,0,0)`;
      } else {
        slides.forEach((s, i) => (s.style.transform = `translate3d(${xOf(i) - L[i]}px,0,0)`));
      }
      // sichtbare Slides markieren (zum Gestalten und für Inhalts-Animationen)
      const a = -off;
      const b = vpW - off;
      slides.forEach((s, i) => {
        const x = active ? xOf(i) : L[i];
        s.classList.toggle('is-in-view', !measured || (x + W[i] > a + 1 && x < b - 1));
      });
      c.onRender();
    };

    const animate = (t, dur, ease, g) => {
      if (tween) tween.kill();
      tween = null;
      goal = g === undefined ? null : g;
      if (c.reduce || dur === 0) {
        st.p = t;
        render();
        return;
      }
      tween = gsap.to(st, {
        p: t,
        duration: dur === undefined ? o.duration : dur,
        ease: ease || o.ease,
        onUpdate: render,
        onComplete: () => {
          tween = null;
          goal = null;
          if (loopOn) st.p = mod(st.p, T); // Zahl klein halten, Darstellung bleibt gleich
        },
      });
    };

    const measure = () => {
      const keep = measured && active ? snaps[goal === null ? index() : goal].slide : c.startSlide;
      if (tween) tween.kill();
      tween = null;
      goal = null;
      track.style.transform = '';
      slides.forEach((s) => (s.style.transform = ''));

      const vr = viewport.getBoundingClientRect();
      const vl = vr.left + viewport.clientLeft;
      const rects = slides.map((s) => s.getBoundingClientRect());
      const first = rects[0];
      const last = rects[n - 1];
      L = rects.map((r) => r.left - first.left);
      W = rects.map((r) => r.width);
      maxW = Math.max(...W);
      const gap = n > 1 ? Math.max(0, rects[1].left - rects[0].right) : 0;
      vpW = viewport.clientWidth;
      off = first.left - vl;
      const padR = parseFloat(getComputedStyle(track).paddingRight) || 0;
      const contentEnd = last.right - vl + padR;
      maxPos = Math.max(0, contentEnd - vpW);
      T = last.right - first.left + gap;
      lo = -off - maxW;

      active = n > 1 && contentEnd > vpW + 1;
      loopOn = active && o.loop && T >= vpW + maxW;
      c.info = { loopBlocked: o.loop && active && !loopOn, wraps: rects.some((r) => Math.abs(r.top - first.top) > 2), zero: W.some((w) => w < 1) };

      if (!active) snaps = [{ pos: 0, slide: 0 }];
      else if (loopOn) snaps = slides.map((_, i) => ({ pos: alignPos(i), slide: i }));
      else {
        snaps = [];
        slides.forEach((_, i) => {
          const p = clamp(alignPos(i), 0, maxPos);
          if (!snaps.length || Math.abs(p - snaps[snaps.length - 1].pos) > 1) snaps.push({ pos: p, slide: i });
        });
      }
      measured = true;
      st.p = active ? target(snapOfSlide(keep), 0, loopOn ? alignPos(clamp(keep, 0, n - 1)) : undefined) : 0;

      viewport.style.cursor = active && o.drag && finePointer() ? 'grab' : '';
      viewport.style.touchAction = active && o.drag ? 'pan-y' : '';
      render();
      return active;
    };

    let dragStart = 0;
    return {
      measure,
      index,
      goal: () => (tween && goal !== null ? goal : index()),
      count: () => snaps.length,
      slideOf: (i) => snaps[clamp(i, 0, snaps.length - 1)].slide,
      snapOfSlide,
      active: () => active,
      loop: () => loopOn,
      go: (i, dir, instant) => {
        if (!active) return;
        i = clamp(i, 0, snaps.length - 1);
        animate(target(i, dir), instant ? 0 : undefined, undefined, i);
      },
      progress: () => (!active ? 0 : loopOn ? index() / Math.max(1, n - 1) : maxPos ? clamp(st.p / maxPos, 0, 1) : 0),
      visibleCount: () => Math.max(1, slides.filter((s, i) => xOf(i) >= -off - 1 && xOf(i) + W[i] <= vpW - off + 1).length),
      // Slide i komplett ins Bild holen (Thumbnails, Tastatur-Fokus)
      reveal: (i, instant) => {
        if (!active) return;
        const x = xOf(i);
        let t = null;
        if (x < -off - 1) t = st.p + x + off;
        else if (x + W[i] > vpW - off + 1) t = st.p + x + W[i] - (vpW - off);
        if (t === null) return;
        if (!loopOn) t = clamp(t, 0, maxPos);
        animate(t, instant ? 0 : undefined);
      },
      inView: (i) => {
        const x = xOf(i);
        return x >= -off - 1 && x + W[i] <= vpW - off + 1;
      },
      drag: {
        start() {
          if (tween) tween.kill();
          tween = null;
          goal = null;
          dragStart = st.p;
        },
        move(dx) {
          let p = dragStart - dx;
          if (!loopOn) {
            if (p < 0) p *= 0.35;
            else if (p > maxPos) p = maxPos + (p - maxPos) * 0.35;
          }
          st.p = p;
          render();
        },
        end(dx, v, startIdx) {
          const proj = st.p - v * 0.28; // Schwung
          if (!o.snap) {
            animate(loopOn ? proj : clamp(proj, 0, maxPos), 0.9, 'power3.out');
            return;
          }
          let i = nearest(proj);
          const dir = dx < 0 ? 1 : -1;
          // kurzer Wisch: mindestens eine Slide weiter
          if (i === startIdx && Math.abs(dx) > 30) i = loopOn ? mod(i + dir, snaps.length) : clamp(i + dir, 0, snaps.length - 1);
          const t = loopOn ? target(i, 0, proj) : snaps[i].pos;
          const dist = Math.abs(t - st.p);
          animate(t, clamp(dist / 1600 + 0.35, 0.4, o.duration), 'power3.out', i);
        },
      },
      wheel(dx) {
        if (tween) tween.kill();
        tween = null;
        st.p = loopOn ? st.p + dx : clamp(st.p + dx, 0, maxPos);
        render();
      },
      wheelEnd() {
        if (o.snap) animate(target(index(), 0), 0.5, 'power3.out');
      },
      destroy() {
        if (tween) tween.kill();
        gsap.killTweensOf(st);
      },
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Engine: fade                                                       */
  /* ------------------------------------------------------------------ */
  /*@block fade*/
  ENGINES.fade = (c) => {
    const { track, slides, o, R } = c;
    const n = slides.length;
    let cur = clamp(c.startSlide, 0, n - 1);
    R.style(track);
    slides.forEach(R.style);
    track.style.display = 'grid';
    slides.forEach((s, i) => {
      s.style.gridArea = '1 / 1 / 2 / 2';
      gsap.set(s, { autoAlpha: i === cur ? 1 : 0, zIndex: i === cur ? 2 : 1 });
      s.classList.toggle('is-in-view', i === cur);
    });

    const go = (i, dir, instant) => {
      i = o.loop ? mod(i, n) : clamp(i, 0, n - 1);
      if (i === cur) return;
      const prev = slides[cur];
      const next = slides[i];
      const prevIdx = cur;
      cur = i;
      gsap.killTweensOf(slides);
      slides.forEach((s) => {
        if (s !== prev && s !== next) gsap.set(s, { autoAlpha: 0, zIndex: 1 });
      });
      gsap.set(prev, { zIndex: 1 });
      gsap.set(next, { zIndex: 2 });
      const leave = () => {
        gsap.set(prev, { autoAlpha: 0 });
        prev.classList.remove('is-in-view');
        c.onLeave(prevIdx);
      };
      next.classList.add('is-in-view');
      if (instant || c.reduce) {
        gsap.set(next, { autoAlpha: 1 });
        leave();
      } else {
        gsap.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: o.duration, ease: 'power2.inOut', onComplete: leave });
      }
      c.onRender();
    };

    return {
      measure: () => n > 1,
      index: () => cur,
      count: () => n,
      slideOf: (i) => i,
      snapOfSlide: (i) => i,
      active: () => n > 1,
      loop: () => o.loop,
      go,
      progress: () => cur / Math.max(1, n - 1),
      visibleCount: () => 1,
      reveal: () => {},
      inView: (i) => i === cur,
      swipe: true,
      destroy() {
        gsap.killTweensOf(slides);
      },
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Autoplay mit Pause bei Hover, Fokus, außerhalb des Bildschirms,     */
  /*  im Hintergrund-Tab und per Pause-Button                             */
  /* ------------------------------------------------------------------ */
  /*@block autoplay*/
  F.autoplay = (secs, onTick, onDraw) => {
    const reasons = new Set();
    const prog = { t: 0 };
    let tw = null;
    const start = () => {
      if (tw) tw.kill();
      prog.t = 0;
      onDraw(0);
      tw = gsap.to(prog, {
        t: 1,
        duration: secs,
        ease: 'none',
        onUpdate: () => onDraw(prog.t),
        onComplete: () => {
          onTick();
          start();
        },
      });
      if (reasons.size) tw.pause();
    };
    return {
      start,
      pause(r) {
        reasons.add(r);
        if (tw) tw.pause();
      },
      resume(r) {
        reasons.delete(r);
        if (!reasons.size && tw) tw.resume();
      },
      has: (r) => reasons.has(r),
      kill() {
        if (tw) tw.kill();
        tw = null;
      },
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Inhalts-Animationen in Slides: data-slider-anim="fade-up" …        */
  /*  fade: bei jedem Wechsel neu · carousel: einmal, wenn sichtbar       */
  /* ------------------------------------------------------------------ */
  /*@block anim*/
  F.anim = (slides, R) => {
    const from = (el) => {
      const d = toPx(el.dataset.sliderAnimDistance || cfg.distance);
      switch (el.dataset.sliderAnim) {
        case 'fade-in':
          return { opacity: 0 };
        case 'fade-down':
          return { opacity: 0, y: -d };
        case 'fade-left':
          return { opacity: 0, x: d };
        case 'fade-right':
          return { opacity: 0, x: -d };
        case 'scale-in':
          return { opacity: 0, scale: 0.92 };
        case 'blur-in':
          return { opacity: 0, filter: 'blur(12px)' };
        case 'clip-up':
          return { clipPath: 'inset(100% 0% 0% 0%)' };
        default:
          return { opacity: 0, y: d };
      }
    };
    const TO = { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', clipPath: 'inset(0% 0% 0% 0%)' };
    const per = slides.map((s) => Array.from(s.querySelectorAll('[data-slider-anim]')));
    const all = per.flat();
    all.forEach((el) => {
      R.style(el);
      gsap.set(el, from(el));
    });
    const played = new Set();
    const play = (i, delay) => {
      const els = per[i] || [];
      gsap.killTweensOf(els);
      els.forEach((el, k) => {
        const f = from(el);
        const t = { duration: num(el.dataset.sliderAnimDuration, 0.8), ease: el.dataset.sliderAnimEase || 'power3.out' };
        Object.keys(f).forEach((p) => (t[p] = TO[p]));
        t.delay = (delay || 0) + k * num(el.dataset.sliderAnimStagger, 0.1) + num(el.dataset.sliderAnimDelay, 0);
        if (f.filter) t.clearProps = 'filter';
        gsap.fromTo(el, f, t);
      });
    };
    return {
      play,
      once(i, delay) {
        if (played.has(i)) return;
        played.add(i);
        play(i, delay);
      },
      reset(i) {
        const els = per[i] || [];
        gsap.killTweensOf(els);
        els.forEach((el) => gsap.set(el, from(el)));
      },
      destroy: () => gsap.killTweensOf(all),
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Slider-Instanz                                                     */
  /* ------------------------------------------------------------------ */
  const instances = new Map();
  const byId = (id) => {
    for (const i of instances.values()) if (i.id === id) return i;
    return null;
  };

  const options = (ds, type) => {
    const fade = type === 'fade';
    const auto = ds.sliderAutoplay;
    return {
      loop: type === 'thumbs' ? false : fade ? ds.sliderLoop !== 'false' : bool(ds.sliderLoop),
      align: ds.sliderAlign || 'start',
      duration: num(ds.sliderDuration, fade ? cfg.fadeDuration : cfg.duration),
      ease: ds.sliderEase || cfg.ease,
      autoplay: type !== 'thumbs' && bool(auto) ? num(auto, cfg.autoplay) : 0,
      step: ds.sliderStep === 'page' ? 'page' : Math.max(1, Math.round(num(ds.sliderStep, 1))),
      drag: ds.sliderDrag !== 'false',
      wheel: ds.sliderWheel !== 'false',
      snap: ds.sliderSnap !== 'false',
      rewind: bool(ds.sliderRewind),
      start: Math.max(0, Math.round(num(ds.sliderStart, 1)) - 1),
      pad: num(ds.sliderPad, 0),
      overflowVisible: ds.sliderOverflow === 'visible',
      keyboard: ds.sliderKeyboard !== 'false',
      pauseHover: ds.sliderPauseHover !== 'false',
      label: ds.sliderLabel,
      for: ds.sliderFor || '',
    };
  };

  // Track und Slides finden: markiert, Webflow Collection List oder erstes Kind
  const findParts = (root) => {
    let track = own(root, '[data-slider-track]')[0];
    const marked = own(root, '[data-slider-slide]');
    if (!track && marked.length) track = marked[0].parentElement;
    if (!track) track = own(root, '.w-dyn-items')[0];
    if (!track && own(root, '.w-dyn-list, .w-dyn-empty').length) return null; // leere Collection
    if (!track) track = root.firstElementChild;
    if (!track) return null;
    const kids = Array.from(track.children).filter((el) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName) && !el.classList.contains('w-dyn-empty'));
    const flagged = kids.filter((el) => el.hasAttribute('data-slider-slide'));
    const slides = flagged.length ? flagged : kids;
    const viewport = own(root, '[data-slider-viewport]')[0] || (track === root ? root : track.parentElement);
    return { track, slides, viewport };
  };

  function create(root) {
    const ds = root.dataset;
    const type = (ds.slider || '').trim();
    const engineFn = ENGINES[type === 'thumbs' ? 'carousel' : type];
    if (!engineFn) {
      warn(`Unbekannter Slider-Typ "${type}"`, root);
      return null;
    }
    const o = options(ds, type);
    const L = cfg.labels;
    const inst = { root, type, id: ds.sliderId || '', o, enabled: false, issues: [], handlers: {} };

    let teardown = null;
    let refreshFn = () => {};

    const emit = (name, detail) => {
      root.dispatchEvent(new CustomEvent('wfslider:' + name, { detail }));
      (inst.handlers[name] || []).forEach((fn) => fn(detail));
    };

    function enable() {
      inst.enabled = true;
      inst.issues = [];
      const R = restorer();
      const ac = new AbortController();
      const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, Object.assign({ signal: ac.signal }, opt));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const issue = (t) => inst.issues.includes(t) || inst.issues.push(t);

      // Bedienelemente: im Slider oder irgendwo auf der Seite mit der Slider-ID als Wert
      const ctrl = (name) => {
        const attr = 'data-slider-' + name;
        const list = own(root, `[${attr}]`).filter((el) => !el.getAttribute(attr) || el.getAttribute(attr) === inst.id);
        if (inst.id)
          document.querySelectorAll(`[${attr}="${CSS.escape(inst.id)}"]`).forEach((el) => list.includes(el) || list.push(el));
        return list;
      };
      const prevs = ctrl('prev');
      const nexts = ctrl('next');
      const dotsWraps = ctrl('dots');
      const currents = ctrl('current');
      const totals = ctrl('total');
      const bars = ctrl('progress');
      const pauses = ctrl('pause');
      const hideable = [...prevs, ...nexts, ...dotsWraps, ...pauses];
      const setHidden = (els, hide) =>
        els.forEach((el) => {
          R.style(el);
          el.style.display = hide ? 'none' : R.origDisplay(el);
        });

      R.cls(root, 'wfs-ready');
      R.add(() => root.classList.remove('is-static', 'is-empty', 'is-paused', 'is-dragging', 'wfs-off'));

      const parts = findParts(root);
      if (!parts || !parts.slides.length) {
        // leere Collection: Bedienelemente ausblenden, sonst nichts tun
        root.classList.add('is-empty');
        setHidden(hideable, true);
        teardown = () => {
          ac.abort();
          R.run();
        };
        refreshFn = () => {};
        return;
      }
      const { track, slides, viewport } = parts;
      const n = slides.length;
      inst.track = track;
      inst.slides = slides;

      // Hinweise für den Debug-Modus
      if (slides.some((s) => s.querySelector('[data-anim]'))) issue('data-anim in Slides: wf-anim startet beim Scrollen, nicht beim Slide-Wechsel. Besser data-slider-anim verwenden.');
      if (slides.some((s) => s.querySelector('[data-slider]'))) issue('Verschachtelter Slider in einer Slide.');
      if (o.autoplay && !pauses.length) issue('Autoplay ohne Pause-Button (data-slider-pause), für Barrierefreiheit empfohlen.');

      // Kontext für die Engine
      const c = { root, track, viewport, slides, o, R, reduce, startSlide: Math.min(o.start, n - 1), onRender: () => {}, onLeave: () => {} };
      const eng = engineFn(c);
      inst.eng = eng;

      // Barrierefreiheit
      if (!root.hasAttribute('role')) R.attr(root, 'role', type === 'thumbs' ? 'group' : 'region');
      R.attr(root, 'aria-roledescription', type === 'thumbs' ? L.thumbs : L.slider);
      if (!root.hasAttribute('aria-label') && !root.hasAttribute('aria-labelledby')) R.attr(root, 'aria-label', o.label || (type === 'thumbs' ? L.thumbs : L.slider));
      if (type !== 'thumbs') R.attr(track, 'aria-live', o.autoplay && !reduce ? 'off' : 'polite');
      slides.forEach((s, i) => {
        if (type === 'thumbs') return;
        if (!s.hasAttribute('role')) R.attr(s, 'role', 'group');
        R.attr(s, 'aria-roledescription', L.slide);
        if (!s.hasAttribute('aria-label')) R.attr(s, 'aria-label', `${i + 1} ${L.of} ${n}`);
      });
      slides.forEach((s) => s.querySelectorAll('img').forEach((img) => R.attr(img, 'draggable', 'false')));

      // Inhalts-Animationen
      const anim = F.anim && !reduce && slides.some((s) => s.querySelector('[data-slider-anim]')) ? F.anim(slides, R) : null;
      let rootVisible = false;
      if (reduce)
        slides.forEach((s) =>
          s.querySelectorAll('[data-slider-anim]').forEach((el) => {
            R.style(el);
            el.style.opacity = '1';
          })
        );

      /* ---------- Navigation ---------- */
      let dots = [];
      let dotTpl = null;
      dotsWraps.forEach((w) => {
        const first = w.firstElementChild;
        if (first && !dotTpl) dotTpl = first.cloneNode(true);
        const saved = Array.from(w.childNodes);
        w.textContent = '';
        R.add(() => {
          w.textContent = '';
          saved.forEach((nd) => w.appendChild(nd));
        });
      });
      const buildDots = (count) => {
        dots = [];
        dotsWraps.forEach((w) => {
          w.textContent = '';
          for (let i = 0; i < count; i++) {
            let d;
            if (dotTpl) {
              d = dotTpl.cloneNode(true);
              d.classList.remove('is-active');
              d.removeAttribute('id');
            } else {
              d = document.createElement('button');
              d.setAttribute('style', 'width:10px;height:10px;padding:0;margin:0 4px;border:0;border-radius:50%;background:currentColor;opacity:.3;cursor:pointer');
            }
            const label = L.goto.replace('{n}', eng.slideOf(i) + 1);
            makeButton(d, label, () => go(i, 0), { attr: (el, a, v) => el.setAttribute(a, v) }, on);
            if (!d.hasAttribute('aria-label')) d.setAttribute('aria-label', label);
            w.appendChild(d);
            dots.push(d);
          }
        });
      };

      prevs.forEach((el) => makeButton(el, L.prev, () => prev(), R, on));
      nexts.forEach((el) => makeButton(el, L.next, () => next(), R, on));

      const pad = (v) => String(v).padStart(o.pad, '0');
      totals.forEach((el) => (el.textContent = pad(n)));
      R.add(() => [...prevs, ...nexts].forEach((el) => el.removeAttribute('aria-disabled')));
      bars.forEach((b) => {
        R.style(b);
        b.style.transformOrigin = 'left center';
      });

      /* ---------- Zustand anzeigen ---------- */
      let lastIdx = -1;
      let lastCount = -1;
      let staticMode = false;
      const drawBars = (v) => bars.forEach((b) => (b.style.transform = `scaleX(${v})`));

      const update = () => {
        const idx = eng.index();
        if (!auto) drawBars(eng.progress());
        if (anim && type !== 'fade' && rootVisible) {
          let k = 0;
          slides.forEach((s, i) => {
            if (s.classList.contains('is-in-view')) anim.once(i, 0.08 * k++);
          });
        }
        if (idx === lastIdx) return;
        lastIdx = idx;
        const slide = eng.slideOf(idx);
        if (type !== 'thumbs') slides.forEach((s, i) => s.classList.toggle('is-active', i === slide));
        dots.forEach((d, i) => {
          const on = i === idx;
          d.classList.toggle('is-active', on);
          if (on) d.setAttribute('aria-current', 'true');
          else d.removeAttribute('aria-current');
          if (!dotTpl) d.style.opacity = on ? '1' : '.3';
        });
        currents.forEach((el) => (el.textContent = pad(slide + 1)));
        const canP = !staticMode && (eng.loop() || o.rewind || idx > 0);
        const canN = !staticMode && (eng.loop() || o.rewind || idx < eng.count() - 1);
        prevs.forEach((el) => {
          el.classList.toggle('is-disabled', !canP);
          el.setAttribute('aria-disabled', String(!canP));
        });
        nexts.forEach((el) => {
          el.classList.toggle('is-disabled', !canN);
          el.setAttribute('aria-disabled', String(!canN));
        });
        // gekoppelte Thumbnails nachziehen
        if (type !== 'thumbs' && inst.id)
          instances.forEach((t) => t.type === 'thumbs' && t.o.for === inst.id && t.setThumb && t.setThumb(slide));
        emit('change', { index: slide, slide: slides[slide], slider: inst.api });
      };
      c.onRender = update;
      c.onLeave = (i) => anim && anim.reset(i);

      /* ---------- Bewegen ---------- */
      const stepSize = () => (o.step === 'page' ? eng.visibleCount() : o.step);
      function go(i, dir, fromAuto) {
        if (staticMode) return;
        const before = eng.index();
        eng.go(i, dir);
        if (type === 'fade' && anim && eng.index() !== before) anim.play(eng.index(), o.duration * 0.35);
        if (!fromAuto && auto) auto.start();
      }
      const cur = () => (eng.goal ? eng.goal() : eng.index());
      function next(fromAuto) {
        if (staticMode) return;
        const i = cur();
        const N = eng.count();
        let t = i + stepSize();
        if (eng.loop()) return go(mod(t, N), 1, fromAuto);
        if (t > N - 1) t = i >= N - 1 ? (o.rewind || fromAuto ? 0 : i) : N - 1;
        if (t !== i) go(t, 1, fromAuto);
      }
      function prev() {
        if (staticMode) return;
        const i = cur();
        const N = eng.count();
        let t = i - stepSize();
        if (eng.loop()) return go(mod(t, N), -1);
        if (t < 0) t = i <= 0 ? (o.rewind ? N - 1 : i) : 0;
        if (t !== i) go(t, -1);
      }

      /* ---------- Autoplay ---------- */
      let auto = null;
      if (o.autoplay && F.autoplay && !reduce && n > 1) {
        auto = F.autoplay(o.autoplay, () => next(true), (v) => drawBars(v));
        if (o.pauseHover && finePointer()) {
          on(root, 'mouseenter', () => auto.pause('hover'));
          on(root, 'mouseleave', () => auto.resume('hover'));
        }
        on(root, 'focusin', (e) => e.target.matches(':focus-visible') && auto.pause('focus'));
        on(root, 'focusout', (e) => !root.contains(e.relatedTarget) && auto.resume('focus'));
        on(document, 'visibilitychange', () => (document.hidden ? auto.pause('hidden') : auto.resume('hidden')));
        const setUser = (p) => {
          if (p) auto.pause('user');
          else auto.resume('user');
          root.classList.toggle('is-paused', p);
          R.attr(track, 'aria-live', p ? 'polite' : 'off');
          pauses.forEach((b) => {
            b.setAttribute('aria-pressed', String(p));
            b.setAttribute('aria-label', p ? L.play : L.pause);
          });
        };
        pauses.forEach((b) => makeButton(b, L.pause, () => setUser(!auto.has('user')), R, on));
        pauses.forEach((b) => {
          R.attr(b, 'aria-pressed', 'false');
          R.attr(b, 'aria-label', L.pause);
        });
        auto.pause('offscreen');
        auto.start();
      } else setHidden(pauses, true);

      // erst animieren, wenn der Slider im Bild ist
      const io = new IntersectionObserver((entries) => {
        const vis = entries[entries.length - 1].isIntersecting;
        rootVisible = vis;
        if (auto) vis ? auto.resume('offscreen') : auto.pause('offscreen');
        if (vis && anim) {
          if (type === 'fade') anim.once(eng.index(), 0.15);
          else update();
        }
      });
      io.observe(root);

      /* ---------- Ziehen / Wischen ---------- */
      if (o.drag && type === 'fade' && n > 1) {
        R.style(viewport);
        viewport.style.touchAction = 'pan-y';
      }
      if (o.drag) {
        let id = null;
        let sx = 0;
        let sy = 0;
        let dragging = false;
        let moved = false;
        let startIdx = 0;
        let samples = [];
        const endDrag = (x) => {
          id = null;
          if (!dragging) return;
          dragging = false;
          root.classList.remove('is-dragging');
          viewport.style.userSelect = '';
          if (eng.active()) viewport.style.cursor = eng.drag && finePointer() ? 'grab' : '';
          const dx = x - sx;
          if (eng.drag) {
            const cut = now() - 100;
            const s = samples.filter((p) => p.t >= cut);
            const a = s[0];
            const b = s[s.length - 1];
            const v = a && b && b.t - a.t > 10 ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
            eng.drag.end(dx, v, startIdx);
          } else if (Math.abs(dx) > 40) {
            dx < 0 ? next() : prev();
          }
          if (auto) {
            auto.resume('drag');
            auto.start();
          }
        };
        on(viewport, 'pointerdown', (e) => {
          moved = false;
          if (staticMode || !eng.active() || (e.pointerType === 'mouse' && e.button !== 0)) return;
          if (isEditable(e.target) || e.target.closest('[data-slider-nodrag]')) return;
          id = e.pointerId;
          sx = e.clientX;
          sy = e.clientY;
          dragging = false;
          startIdx = eng.index();
          samples = [{ x: sx, t: now() }];
        });
        on(window, 'pointermove', (e) => {
          if (e.pointerId !== id) return;
          if (e.pointerType === 'mouse' && !(e.buttons & 1)) return endDrag(e.clientX);
          const dx = e.clientX - sx;
          const dy = e.clientY - sy;
          if (!dragging) {
            if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
              dragging = true;
              moved = true;
              root.classList.add('is-dragging');
              viewport.style.userSelect = 'none';
              viewport.style.cursor = eng.drag && finePointer() ? 'grabbing' : '';
              const sel = window.getSelection && window.getSelection();
              if (sel) sel.removeAllRanges();
              if (eng.drag) eng.drag.start();
              if (auto) auto.pause('drag');
            } else if (Math.abs(dy) > 8) {
              id = null; // senkrecht: die Seite scrollt
              return;
            } else return;
          }
          if (eng.drag) eng.drag.move(dx);
          samples.push({ x: e.clientX, t: now() });
          if (samples.length > 20) samples.shift();
        });
        on(window, 'pointerup', (e) => e.pointerId === id && endDrag(e.clientX));
        on(window, 'pointercancel', (e) => e.pointerId === id && endDrag(sx));
        // Nach dem Ziehen keinen Link öffnen
        on(viewport, 'click', (e) => {
          if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
          }
        }, { capture: true });
        on(viewport, 'dragstart', (e) => e.preventDefault());
      }

      // Trackpad: waagerechtes Wischen
      if (o.wheel) {
        let wt = null;
        let acc = 0;
        let lock = 0;
        on(viewport, 'wheel', (e) => {
          if (staticMode || !eng.active() || e.ctrlKey) return;
          const dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
          if (Math.abs(dx) <= Math.abs(e.deltaY)) return;
          e.preventDefault();
          if (auto) auto.start();
          if (eng.wheel) {
            eng.wheel(dx);
            clearTimeout(wt);
            wt = setTimeout(() => eng.wheelEnd(), 140);
          } else if (now() > lock) {
            acc += dx;
            if (Math.abs(acc) > 40) {
              acc > 0 ? next() : prev();
              acc = 0;
              lock = now() + o.duration * 700;
            }
          }
        }, { passive: false });
        R.add(() => clearTimeout(wt));
      }

      // Tastatur
      if (o.keyboard) {
        on(root, 'keydown', (e) => {
          if (isEditable(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
          const target = type === 'thumbs' ? byId(o.for) : null;
          const p = target && target.api ? target.api.prev : prev;
          const nx = target && target.api ? target.api.next : next;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            p();
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nx();
          }
        });
      }
      // Fokus per Tab auf eine Slide außerhalb des Bildes: hinholen.
      // Der Browser scrollt sonst den Viewport selbst (overflow: hidden) – das wird zurückgesetzt.
      on(viewport, 'scroll', () => {
        viewport.scrollLeft = 0;
      });
      if (type !== 'fade')
        on(track, 'focusin', (e) => {
          const i = slides.findIndex((s) => s.contains(e.target));
          if (i < 0 || !eng.active() || eng.inView(i)) return;
          if (type === 'thumbs') eng.reveal(i);
          else go(eng.snapOfSlide(i), 0);
        });

      /* ---------- Thumbnails ---------- */
      if (type === 'thumbs') {
        if (!o.for) issue('data-slider-for fehlt: Welcher Slider soll gesteuert werden?');
        else if (!main()) issue(`Kein Slider mit data-slider-id="${o.for}" gefunden.`);
        slides.forEach((s, i) => {
          makeButton(s, L.goto.replace('{n}', i + 1), () => {
            const m = main();
            if (m && m.api) m.api.goTo(i);
          }, R, on);
        });
        inst.setThumb = (i) => {
          inst.thumb = i;
          slides.forEach((s, k) => {
            s.classList.toggle('is-active', k === i);
            if (k === i) s.setAttribute('aria-current', 'true');
            else s.removeAttribute('aria-current');
          });
          eng.reveal(i);
        };
        R.add(() => slides.forEach((s) => s.removeAttribute('aria-current')));
      }

      /* ---------- Messen, auch bei Größenänderung und geladenen Bildern ---------- */
      let raf = 0;
      const remeasure = () => {
        const wasStatic = staticMode;
        staticMode = !eng.measure();
        root.classList.toggle('is-static', staticMode);
        if (staticMode !== wasStatic || lastCount < 0) {
          setHidden(hideable, staticMode);
          if (!auto) setHidden(pauses, true);
        }
        if (eng.count() !== lastCount) {
          lastCount = eng.count();
          buildDots(staticMode ? 0 : lastCount);
        }
        lastIdx = -1;
        update();
        if (type === 'thumbs' && inst.thumb !== undefined) eng.reveal(inst.thumb, true);
        if (c.info) {
          if (c.info.loopBlocked) issue('Zu wenige oder zu schmale Slides für den Loop, er ist deshalb aus.');
          if (c.info.wraps) issue('Slides brechen in eine neue Zeile um. Track auf Display flex und Wrap: don\'t wrap stellen.');
          const moving = eng.loop() ? slides : [track];
          if (moving.some((el) => /(^|,\s*)(all|transform)\b/.test(getComputedStyle(el).transitionProperty) && parseFloat(getComputedStyle(el).transitionDuration) > 0))
            issue(eng.loop() ? 'Slides haben eine CSS-Transition auf transform. Im Loop bewegt die Library die Slides selbst: Transition und Hover-Transforms an ein inneres Element legen.' : 'Track hat eine CSS-Transition auf transform. Bitte entfernen, sonst läuft die Bewegung nach.');
          if (c.info.zero) issue('Mindestens eine Slide hat keine Breite. Flex Shrink auf 0 und eine Breite setzen.');
        }
      };
      const schedule = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(remeasure);
      };
      refreshFn = schedule;
      remeasure();
      if (type === 'thumbs') {
        const m = main();
        if (m && m.api) inst.setThumb(m.api.index);
      }
      const ro = new ResizeObserver(schedule);
      ro.observe(viewport);
      ro.observe(track);
      slides.forEach((s) => s.querySelectorAll('img').forEach((img) => !img.complete && on(img, 'load', schedule)));

      teardown = () => {
        ac.abort();
        ro.disconnect();
        io.disconnect();
        cancelAnimationFrame(raf);
        if (auto) auto.kill();
        if (anim) anim.destroy();
        eng.destroy();
        slides.forEach((s) => s.classList.remove('is-active', 'is-in-view'));
        R.run();
      };

      function main() {
        return byId(o.for);
      }
      inst.next = () => next();
      inst.prev = () => prev();
      inst.goTo = (i) => go(eng.snapOfSlide(i), 0);
      inst.play = () => auto && auto.resume('user');
      inst.pause = () => auto && auto.pause('user');
      inst.index = () => eng.slideOf(eng.index());
    }

    function disable() {
      if (!inst.enabled) return;
      inst.enabled = false;
      if (teardown) teardown();
      teardown = null;
      refreshFn = () => {};
      root.classList.add('wfs-off');
    }

    // Öffentliche API der Instanz
    inst.api = {
      el: root,
      next: () => inst.enabled && inst.next && inst.next(),
      prev: () => inst.enabled && inst.prev && inst.prev(),
      goTo: (i) => inst.enabled && inst.goTo && inst.goTo(i),
      play: () => inst.enabled && inst.play && inst.play(),
      pause: () => inst.enabled && inst.pause && inst.pause(),
      refresh: () => refreshFn(),
      on(name, fn) {
        (inst.handlers[name] = inst.handlers[name] || []).push(fn);
        return inst.api;
      },
      get index() {
        return inst.enabled && inst.index ? inst.index() : 0;
      },
      get length() {
        return inst.slides ? inst.slides.length : 0;
      },
    };

    // Nur in bestimmten Breiten aktiv: data-slider-media="(max-width: 991px)" oder data-slider-mobile="false"
    const mq = ds.sliderMedia || (ds.sliderMobile === 'false' ? `(min-width: ${cfg.mobileBreakpoint}px)` : '');
    const mql = mq ? window.matchMedia(mq) : null;
    const check = () => {
      const want = !mql || mql.matches;
      if (want && !inst.enabled) {
        root.classList.remove('wfs-off');
        enable();
      } else if (!want && inst.enabled) disable();
      else if (!want) root.classList.add('wfs-off');
    };
    if (mql) mql.addEventListener('change', check);
    inst.refresh = () => refreshFn();
    inst.kill = () => {
      if (mql) mql.removeEventListener('change', check);
      disable();
    };
    check();
    return inst;
  }

  /* ------------------------------------------------------------------ */
  /*  Debug: ?wfslider-debug, data-slider-debug am body oder             */
  /*  WFSliderConfig.debug = true                                         */
  /* ------------------------------------------------------------------ */
  const debugOn = () => {
    if (cfg.debug) return true;
    try {
      if (/[?&]wfslider-debug\b/.test(window.location.search)) return true;
    } catch (_) {}
    return document.body.hasAttribute('data-slider-debug');
  };
  let badge = null;
  const debugReport = () => {
    const rows = [];
    instances.forEach((i) =>
      rows.push({
        Slider: i.type + (i.id ? ` #${i.id}` : ''),
        Slides: i.slides ? i.slides.length : 0,
        Zustand: !i.enabled ? 'aus (Breite)' : i.root.classList.contains('is-empty') ? 'leer' : i.root.classList.contains('is-static') ? 'statisch (alles sichtbar)' : i.eng && i.eng.loop() ? 'aktiv, Loop' : 'aktiv',
        Element: i.root,
        Hinweise: i.issues.join(' ') || '–',
      })
    );
    if (!rows.length) return;
    const bad = rows.filter((r) => r.Hinweise !== '–').length;
    console.groupCollapsed(`[WFSlider] Debug · ${rows.length} Slider · ${bad} mit Hinweisen`);
    console.table(rows.map((r) => ({ Slider: r.Slider, Slides: r.Slides, Zustand: r.Zustand, Hinweise: r.Hinweise })));
    rows.forEach((r) => r.Hinweise !== '–' && console.log(r.Slider, r.Element, r.Hinweise));
    console.groupEnd();
    instances.forEach((i) => {
      i.root.style.outline = i.issues.length ? '2px dashed #e5484d' : '2px dashed #3e63dd';
      i.root.style.outlineOffset = '4px';
    });
    if (!badge) {
      badge = document.createElement('div');
      badge.setAttribute('style', 'position:fixed;right:12px;bottom:12px;z-index:2147483647;font:600 12px/1.4 system-ui,sans-serif;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none');
      document.body.appendChild(badge);
    }
    badge.textContent = `WF Slider Debug · ${rows.length} Slider · ${bad ? bad + ' mit Hinweisen (Konsole)' : 'keine Hinweise'}`;
    badge.style.background = bad ? '#b4231b' : '#141824';
  };

  /* ------------------------------------------------------------------ */
  /*  Init / Destroy                                                     */
  /* ------------------------------------------------------------------ */
  const collect = (scope) => {
    const list = Array.from(scope.querySelectorAll('[data-slider]'));
    if (scope !== document && scope.matches && scope.matches('[data-slider]')) list.unshift(scope);
    return list;
  };

  function init(scope) {
    scope = scope || document;
    if (!window.gsap) {
      warn('GSAP nicht gefunden – Slider deaktiviert.');
      html.classList.remove('js-slider');
      return;
    }
    const roots = collect(scope).filter((r) => !instances.has(r));
    // Thumbnails zuletzt, damit der Haupt-Slider schon existiert
    roots.sort((a, b) => (a.dataset.slider === 'thumbs') - (b.dataset.slider === 'thumbs'));
    roots.forEach((r) => {
      try {
        const i = create(r);
        if (i) instances.set(r, i);
      } catch (err) {
        warn('Fehler beim Start', r, err);
      }
    });
    if (debugOn()) debugReport();
  }

  function destroy(scope) {
    instances.forEach((inst, r) => {
      if (!scope || scope === document || scope === r || scope.contains(r)) {
        inst.kill();
        instances.delete(r);
      }
    });
  }

  function refresh() {
    instances.forEach((i) => i.refresh());
  }

  function get(x) {
    if (typeof x === 'string') {
      const i = byId(x);
      return i ? i.api : null;
    }
    const r = x && x.closest ? x.closest('[data-slider]') : null;
    const i = r && instances.get(r);
    return i ? i.api : null;
  }

  window.WFSlider = { init, destroy, refresh, get, config: cfg, version: VERSION };

  const start = () => {
    if (!cfg.autoInit) return;
    init();
    window.addEventListener('load', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
