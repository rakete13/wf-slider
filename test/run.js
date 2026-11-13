// Lokaler Test der Demo-Seite (Headless Chrome, GSAP durch Shim ersetzt)
const path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const shim = require('fs').readFileSync(path.join(__dirname, 'gsap-shim.js'), 'utf8');
const out = process.argv[2] || '/tmp';
const results = [];
const check = (name, ok, info) => {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== undefined ? '  → ' + JSON.stringify(info) : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/ERR_|Failed to load/.test(m.text()) && errors.push(m.text()));
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.includes('gsap')) return r.fulfill({ body: shim, contentType: 'application/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.abort();
  });
  await page.goto('file://' + path.join(root, 'docs/index.html'));
  await wait(400);

  const S = (i) => `[data-slider]:nth-of-type(1)`;
  const q = (js) => page.evaluate(js);

  // ---------- Carousel 1 ----------
  const c1 = '#carousel .stage:nth-of-type(1) [data-slider]';
  await page.locator('#carousel [data-slider]').first().scrollIntoViewIfNeeded();
  await wait(200);
  let st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[0];
    return {
      ready: r.classList.contains('wfs-ready'),
      dots: r.querySelectorAll('[data-slider-dots] > *').length,
      cur: r.querySelector('[data-slider-current]').textContent,
      prevDisabled: r.querySelector('[data-slider-prev]').classList.contains('is-disabled'),
      inView: r.querySelectorAll('.is-in-view').length,
      role: r.getAttribute('role'),
      label: r.querySelector('.w-dyn-item').getAttribute('aria-label'),
    };
  });
  check('Carousel: gestartet, CMS-Track erkannt', st.ready && st.dots === 6, st);
  check('Carousel: Prev am Anfang deaktiviert, Zähler 01', st.prevDisabled && st.cur === '01', st);
  check('Carousel: 3 Slides sichtbar, a11y gesetzt', st.inView === 3 && st.role === 'region' && st.label === '1 von 8', st);

  const first = page.locator('#carousel [data-slider]').first();
  await first.locator('[data-slider-next]').click();
  await wait(1000);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[0];
    return { tr: r.querySelector('.w-dyn-items').style.transform, cur: r.querySelector('[data-slider-current]').textContent, active: [...r.querySelectorAll('.w-dyn-item')].findIndex((s) => s.classList.contains('is-active')), dot: [...r.querySelectorAll('[data-slider-dots] > *')].findIndex((d) => d.classList.contains('is-active')) };
  });
  check('Carousel: Next bewegt um eine Slide', /translate3d\(-\d/.test(st.tr) && st.cur === '02' && st.active === 1 && st.dot === 1, st);

  // Punkt 6 = Ende
  await first.locator('[data-slider-dots] > *').nth(5).click();
  await wait(1000);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[0];
    const vp = r.querySelector('.w-dyn-list').getBoundingClientRect();
    const last = r.querySelector('.w-dyn-item:last-child').getBoundingClientRect();
    return { nextDis: r.querySelector('[data-slider-next]').classList.contains('is-disabled'), lastRightGap: Math.round(vp.right - last.right) };
  });
  check('Carousel: letzter Punkt → Ende bündig, Next deaktiviert', st.nextDis && Math.abs(st.lastRightGap) <= 1, st);

  // Ziehen mit der Maus nach rechts (zurück)
  const box = await first.locator('.w-dyn-list').boundingBox();
  await page.mouse.move(box.x + 400, box.y + 100);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 400 + i * 40, box.y + 100);
  await page.mouse.up();
  await wait(1000);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[0];
    return { cur: r.querySelector('[data-slider-current]').textContent, hash: location.hash };
  });
  check('Carousel: Ziehen bewegt zurück, Link öffnet nicht', parseInt(st.cur) < 6 && st.hash === '', st);

  // Klick ohne Ziehen öffnet den Link
  await first.locator('.w-dyn-item.is-in-view').first().click();
  await wait(100);
  check('Carousel: normaler Klick öffnet Link', (await q(() => location.hash)) === '#carousel');
  await q(() => history.replaceState(null, '', location.pathname));

  // Tastatur
  await first.locator('[data-slider-next]').focus();
  const before = await q(() => document.querySelectorAll('#carousel [data-slider]')[0].querySelector('[data-slider-current]').textContent);
  await page.keyboard.press('ArrowLeft');
  await wait(1000);
  const after = await q(() => document.querySelectorAll('#carousel [data-slider]')[0].querySelector('[data-slider-current]').textContent);
  check('Carousel: Pfeiltaste links', parseInt(after) === parseInt(before) - 1, { before, after });

  // ---------- Loop ----------
  const loop = page.locator('#carousel [data-slider]').nth(1);
  await loop.scrollIntoViewIfNeeded();
  await wait(300);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[1];
    const vp = r.getBoundingClientRect();
    const a = r.querySelector('.is-active').getBoundingClientRect();
    return { active: [...r.querySelectorAll('.card')].findIndex((s) => s.classList.contains('is-active')), centerOff: Math.round(a.left + a.width / 2 - (vp.left + vp.width / 2)), leftNeighbour: [...r.querySelectorAll('.card')].some((s) => s.getBoundingClientRect().right < a.left + 5 && s.getBoundingClientRect().right > vp.left + 10) };
  });
  check('Loop: Slide A zentriert, Nachbar links sichtbar', st.active === 0 && Math.abs(st.centerOff) <= 1 && st.leftNeighbour, st);
  await loop.locator('[data-slider-prev]').click();
  await wait(1000);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[1];
    const vp = r.getBoundingClientRect();
    const a = r.querySelector('.card.is-active');
    const b = a.getBoundingClientRect();
    return { active: a.querySelector('.n').textContent, centerOff: Math.round(b.left + b.width / 2 - (vp.left + vp.width / 2)), clones: r.querySelectorAll('.card').length };
  });
  check('Loop: Prev am Anfang → E, zentriert, keine Klone', st.active === 'E' && Math.abs(st.centerOff) <= 1 && st.clones === 5, st);
  for (let i = 0; i < 6; i++) {
    await loop.locator('[data-slider-next]').click();
    await wait(150);
  }
  await wait(1000);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[1];
    const vp = r.getBoundingClientRect();
    const a = r.querySelector('.card.is-active');
    const b = a.getBoundingClientRect();
    // Lücken im sichtbaren Bereich?
    const rects = [...r.querySelectorAll('.card')].map((s) => s.getBoundingClientRect()).filter((x) => x.right > vp.left && x.left < vp.right).sort((x, y) => x.left - y.left);
    let gaps = 0;
    for (let i = 1; i < rects.length; i++) if (rects[i].left - rects[i - 1].right > 20) gaps++;
    const coverL = rects[0].left <= vp.left + 1, coverR = rects[rects.length - 1].right >= vp.right - 1;
    return { active: a.querySelector('.n').textContent, centerOff: Math.round(b.left + b.width / 2 - (vp.left + vp.width / 2)), gaps, coverL, coverR };
  });
  check('Loop: 6× schnell Next → A, lückenlos', st.active === 'A' && Math.abs(st.centerOff) <= 1 && !st.gaps && st.coverL && st.coverR, st);
  const bar = await q(() => document.querySelectorAll('#carousel [data-slider]')[1].querySelector('[data-slider-progress]').style.transform);
  check('Loop: Autoplay-Balken läuft', /scaleX\(0\.\d+|scaleX\(0\)|scaleX\(1\)/.test(bar), bar);
  await loop.locator('[data-slider-pause]').click();
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[1];
    return { paused: r.classList.contains('is-paused'), pressed: r.querySelector('[data-slider-pause]').getAttribute('aria-pressed') };
  });
  check('Loop: Pause-Button', st.paused && st.pressed === 'true', st);

  // ---------- Nur mobil ----------
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[2];
    return { off: r.classList.contains('wfs-off'), dotsDisplay: getComputedStyle(r.querySelector('[data-slider-dots]')).display, kids: r.querySelector('[data-slider-dots]').children.length };
  });
  check('Nur mobil: auf Desktop aus, Markup unverändert', st.off && st.kids === 1, st);

  // ---------- Fade ----------
  const fade = page.locator('#fade [data-slider]');
  await fade.scrollIntoViewIfNeeded();
  await wait(1300);
  st = await q(() => {
    const r = document.querySelector('#fade [data-slider]');
    const s = [...r.querySelectorAll('.hero-slide')];
    return { vis: s.map((x) => getComputedStyle(x).visibility), h: Math.round(r.getBoundingClientRect().height), dots: document.querySelectorAll('[data-slider-dots="hero"] > *').length, animOp: getComputedStyle(s[0].querySelector('h4')).opacity };
  });
  check('Fade: nur Slide 1 sichtbar, gestapelt, Inhalt eingeblendet', st.vis.join() === 'visible,hidden,hidden,hidden' && st.h < 450 && st.dots === 4 && st.animOp === '1', st);
  await page.locator('[data-slider-next="hero"]').click();
  await wait(250);
  const mid = await q(() => getComputedStyle(document.querySelectorAll('#fade .hero-slide')[1].querySelector('h4')).opacity);
  await wait(1500);
  st = await q(() => {
    const s = [...document.querySelectorAll('#fade .hero-slide')];
    return { vis: s.map((x) => getComputedStyle(x).visibility), op: getComputedStyle(s[1]).opacity, animOp: getComputedStyle(s[1].querySelector('h4')).opacity, firstAnimReset: getComputedStyle(s[0].querySelector('h4')).opacity, dot: [...document.querySelectorAll('[data-slider-dots="hero"] > *')].findIndex((d) => d.classList.contains('is-active')) };
  });
  check('Fade: Next (Bedienelement außerhalb per ID) blendet über', st.vis.join() === 'hidden,visible,hidden,hidden' && st.op === '1' && st.dot === 1, st);
  check('Fade: Inhalt animiert neu, alte Slide zurückgesetzt', parseFloat(mid) < 1 && st.animOp === '1' && st.firstAnimReset === '0', { mid, ...st });
  await page.locator('[data-slider-prev="hero"]').click();
  await page.locator('[data-slider-prev="hero"]').click();
  await wait(1500);
  st = await q(() => [...document.querySelectorAll('#fade .hero-slide')].map((x) => getComputedStyle(x).visibility).join());
  check('Fade: 2× Prev (schnell) → Loop auf letzte Slide', st === 'hidden,hidden,hidden,visible', st);

  // ---------- Galerie ----------
  const gal = page.locator('#gallery');
  await gal.scrollIntoViewIfNeeded();
  await wait(300);
  await page.locator('#gallery .thumb').nth(4).click();
  await wait(1300);
  st = await q(() => {
    const main = [...document.querySelectorAll('#gallery .g-slide')].map((x) => getComputedStyle(x).visibility);
    const t = [...document.querySelectorAll('#gallery .thumb')].findIndex((x) => x.classList.contains('is-active'));
    return { main: main.indexOf('visible'), thumb: t, role: document.querySelector('#gallery .thumb').getAttribute('role') };
  });
  check('Galerie: Thumbnail 5 → Haupt-Slide 5, Thumb aktiv', st.main === 4 && st.thumb === 4 && st.role === 'button', st);

  await page.screenshot({ path: out + '/desktop.png', fullPage: true });

  // ---------- Mobil ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(800);
  st = await q(() => {
    const r = document.querySelectorAll('#carousel [data-slider]')[2];
    return { off: r.classList.contains('wfs-off'), dots: r.querySelector('[data-slider-dots]').children.length };
  });
  check('Nur mobil: unter 768 px aktiv', !st.off && st.dots === 4, st);
  // Galerie-Thumbs passen nicht mehr → ziehbar, aktives Thumb im Bild
  st = await q(() => {
    const r = document.querySelector('#gallery [data-slider="thumbs"]');
    const vp = r.getBoundingClientRect();
    const t = r.querySelector('.thumb.is-active').getBoundingClientRect();
    return { static: r.classList.contains('is-static'), inside: t.left >= vp.left - 1 && t.right <= vp.right + 1 };
  });
  check('Galerie mobil: Thumbs scrollbar, aktives sichtbar', !st.static && st.inside, st);
  // Touch-Wischen auf Carousel 1
  st = await q(() => document.querySelectorAll('#carousel [data-slider]')[0].querySelector('[data-slider-current]').textContent);
  await page.locator('#carousel [data-slider]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/mobile.png', fullPage: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await wait(600);
  st = await q(() => document.querySelectorAll('#carousel [data-slider]')[2].classList.contains('wfs-off'));
  check('Nur mobil: zurück auf Desktop wieder aus, Styles zurückgesetzt', st && (await q(() => !document.querySelectorAll('#carousel [data-slider]')[2].querySelector('.track').getAttribute('style'))));

  // ---------- destroy ----------
  st = await q(() => {
    WFSlider.destroy();
    const r = document.querySelectorAll('#carousel [data-slider]')[0];
    return { style: r.querySelector('.w-dyn-items').getAttribute('style'), dots: r.querySelector('[data-slider-dots]').children.length, role: r.getAttribute('role'), slideStyle: r.querySelector('.w-dyn-item').getAttribute('style') };
  });
  check('destroy: alles zurückgesetzt', !st.style && st.dots === 1 && !st.role && !st.slideStyle, st);
  st = await q(() => {
    WFSlider.init();
    return document.querySelectorAll('.wfs-ready').length;
  });
  check('init nach destroy', st >= 5, st);

  check('Keine JS-Fehler', !errors.length, errors);
  await browser.close();
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} bestanden`);
  process.exit(bad ? 1 : 0);
})();
