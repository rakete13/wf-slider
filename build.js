// Baut den Webflow-Code (Head + Footer) und die CDN-Datei aus wf-slider.js.
// Nutzung: node build.js                 → alle Typen und Bausteine (schreibt nach webflow/ und src/wf-slider.min.js)
//          node build.js carousel,anim    → nur diese (Typen: carousel, fade, thumbs · Bausteine: autoplay, anim)
//          node build.js fade ./ausgabe   → in einen eigenen Ordner
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Minifier: esbuild (stark) oder TypeScript (nur Kommentare entfernen) als Rückfall
const tryRequire = (names) => {
  for (const n of names) {
    try {
      return require(n);
    } catch (_) {}
  }
  return null;
};
const globalRoot = (() => {
  try {
    return execSync('npm root -g').toString().trim();
  } catch (_) {
    return '';
  }
})();
const esbuild = tryRequire(['esbuild', path.join(globalRoot, 'esbuild'), '/opt/npm-tools/node_modules/esbuild']);
const ts = esbuild ? null : tryRequire(['typescript', path.join(globalRoot, 'typescript')]);
if (!esbuild && !ts) throw new Error('Weder esbuild noch typescript gefunden: npm i -g esbuild');

const src = fs.readFileSync(path.join(__dirname, 'src', 'wf-slider.js'), 'utf8');
const version = (/WF Slider v([\d.]+)/.exec(src) || [])[1] || '0.0.0';
const arg = process.argv[2];
const used = arg && arg !== 'all' ? new Set(arg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const outDir = process.argv[3] || path.join(__dirname, 'webflow');
fs.mkdirSync(outDir, { recursive: true });

// thumbs braucht die carousel-Engine
if (used && used.has('thumbs')) used.add('carousel');

// 1 · Nicht genutzte Blöcke entfernen
const kept = [];
let code = src.replace(/\/\*@block ([\w,:-]+)\*\/([\s\S]*?)\/\*@end\*\//g, (_, names, body) => {
  const list = names.split(',');
  const keep = !used || list.some((n) => used.has(n));
  if (keep) kept.push(...list.filter((n) => !used || used.has(n)));
  return keep ? body : '';
});
if (used) {
  const unknown = [...used].filter((n) => !kept.includes(n));
  if (unknown.length) console.warn('Unbekannte Namen ignoriert:', unknown.join(', '));
}
kept.splice(0, kept.length, ...new Set(kept));

const header = `/*! WF Slider v${version} · ` + (used ? 'Auswahl: ' + kept.join(', ') : 'Vollversion') + ' */';
if (esbuild) {
  code = esbuild.transformSync(code, { minify: true, target: 'es2020', legalComments: 'none' }).code.trim();
} else {
  code = ts
    .transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, removeComments: true } })
    .outputText.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// 2 · Head Code: verhindert Aufblitzen (gestapelte Fade-Slides, Inhalts-Animationen)
const has = (n) => !used || kept.includes(n);
const css = ['[data-slider]{min-width:0}'];
if (has('fade')) {
  const t = '.js-slider [data-slider="fade"]:not(.wfs-off) :is([data-slider-track],.w-dyn-items)';
  css.push(`${t}{display:grid}`, `${t}>*{grid-area:1/1/2/2}`, `${t}>:not(:first-child){opacity:0;visibility:hidden}`);
}
if (has('anim')) css.push('.js-slider [data-slider]:not(.wfs-off) [data-slider-anim]{opacity:0}');
const head = `<!-- WF Slider · Head Code -->
<script>
document.documentElement.classList.add('js-slider');
setTimeout(function(){if(!window.WFSlider)document.documentElement.classList.remove('js-slider')},3000);
</script>
<style>
${css.join('\n')}
</style>
`;

const footer = `<!-- WF Slider · Footer Code
     Voraussetzung: Settings → GSAP integration → GSAP aktiv (keine Plugins nötig) -->
<script>
${header}
${code}
</script>
`;

fs.writeFileSync(path.join(outDir, 'head-code.html'), head);
fs.writeFileSync(path.join(outDir, 'footer-code.html'), footer);
if (!used && !process.argv[3]) fs.writeFileSync(path.join(__dirname, 'src', 'wf-slider.min.js'), header + '\n' + code + '\n');
console.log(JSON.stringify({ version, kept, headChars: head.length, footerChars: footer.length, total: head.length + footer.length }));
