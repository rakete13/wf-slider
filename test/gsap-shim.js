// Minimaler GSAP-Ersatz NUR für lokale Tests ohne Netz (to, fromTo, set, killTweensOf).
(() => {
  const tweens = new Set();
  const tf = new WeakMap();
  const isEl = (t) => t && t.nodeType === 1;
  const arr = (t) => (t == null ? [] : Array.isArray(t) || t instanceof NodeList ? Array.from(t) : [t]);
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const getT = (el) => tf.get(el) || (tf.set(el, { x: 0, y: 0, scale: 1 }), tf.get(el));
  const apply = (t, k, v) => {
    if (!isEl(t)) return void (t[k] = v);
    const s = t.style;
    if (k === 'autoAlpha') {
      s.opacity = v;
      s.visibility = v === 0 ? 'hidden' : 'inherit';
    } else if (k === 'opacity') s.opacity = v;
    else if (k === 'zIndex') s.zIndex = Math.round(v);
    else if (k === 'xPercent' || k === 'yPercent') {
      const m = getT(t);
      m[k] = v;
      s.translate = `${m.xPercent || 0}% ${m.yPercent || 0}%`;
    } else if (k === 'x' || k === 'y' || k === 'scale') {
      const m = getT(t);
      m[k] = v;
      s.transform = `translate(${m.x}px,${m.y}px) scale(${m.scale})`;
    } else if (k === 'filter' || k === 'clipPath') s[k] = v;
    else s[k] = v;
  };
  const read = (t, k) => {
    if (!isEl(t)) return t[k];
    if (k === 'x' || k === 'y' || k === 'scale') return getT(t)[k];
    if (k === 'xPercent' || k === 'yPercent') return getT(t)[k] || 0;
    if (k === 'autoAlpha' || k === 'opacity') return parseFloat(getComputedStyle(t).opacity);
    if (k === 'zIndex') return parseFloat(t.style.zIndex) || 0;
    return null;
  };
  const SKIP = ['duration', 'ease', 'delay', 'onUpdate', 'onComplete', 'clearProps', 'stagger', 'overwrite', 'repeat'];
  function make(targets, from, to) {
    targets = arr(targets);
    const dur = (to.duration == null ? 0.5 : to.duration) * 1000;
    const delay = (to.delay || 0) * 1000;
    const keys = Object.keys(to).filter((k) => !SKIP.includes(k));
    let start = null;
    let paused = false;
    let elapsed = 0;
    let last = performance.now();
    const fromVals = targets.map((t) => {
      const o = {};
      keys.forEach((k) => {
        if (from && k in from) {
          apply(t, k, from[k]);
          o[k] = from[k];
        } else o[k] = read(t, k);
      });
      return o;
    });
    const tw = {
      targets,
      kill() {
        tweens.delete(tw);
        return tw;
      },
      pause() {
        paused = true;
        return tw;
      },
      resume() {
        paused = false;
        last = performance.now();
        return tw;
      },
      play() {
        return tw.resume();
      },
      tick(now) {
        if (!paused) elapsed += now - last;
        last = now;
        if (elapsed < delay) return;
        const p = dur ? Math.min(1, (elapsed - delay) / dur) : 1;
        const e = ease(p);
        targets.forEach((t, i) =>
          keys.forEach((k) => {
            const a = fromVals[i][k];
            const b = to[k];
            apply(t, k, typeof a === 'number' && typeof b === 'number' ? a + (b - a) * e : p < 1 && typeof b !== 'number' ? a ?? b : b);
          })
        );
        if (to.onUpdate) to.onUpdate();
        if (p >= 1) {
          tweens.delete(tw);
          if (to.onComplete) to.onComplete();
        }
      },
    };
    tweens.add(tw);
    if (!dur && !delay) tw.tick(performance.now());
    return tw;
  }
  const loop = (now) => {
    Array.from(tweens).forEach((t) => tweens.has(t) && t.tick(now));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.gsap = {
    to: (t, v) => make(t, null, v),
    fromTo: (t, f, v) => make(t, f, v),
    set: (t, v) => {
      arr(t).forEach((el) => Object.keys(v).forEach((k) => apply(el, k, v[k])));
    },
    killTweensOf: (t) => {
      const list = arr(t);
      tweens.forEach((tw) => tw.targets.some((x) => list.includes(x)) && tweens.delete(tw));
    },
    _count: () => tweens.size,
    registerPlugin: () => {},
    delayedCall: (sec, fn) => make({}, null, { duration: 0, delay: sec, onComplete: fn }),
    quickTo: (t, prop, v) => {
      let tw = null;
      return (val) => {
        if (tw) tw.kill();
        tw = make(t, null, Object.assign({}, v, { [prop]: val }));
      };
    },
  };
})();
