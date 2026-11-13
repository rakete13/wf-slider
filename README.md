# WF Slider

Attribut-basierte Slider für Webflow, passend zu [WF Anim](https://github.com/rakete13/wf-anim). Wrapper auswählen, unter **Custom Attributes** `data-slider` mit `carousel`, `fade` oder `thumbs` setzen, fertig. Funktioniert mit Collection Lists genauso wie mit statischen Slides.

Die Übersicht mit Live-Demos und allen Attributen liegt in [`docs/index.html`](docs/index.html).

## In ein Webflow-Projekt einbauen

1. **GSAP aktivieren:** im Projekt unter *Settings → GSAP integration* GSAP einschalten. Plugins sind nicht nötig.
2. **Head Code:** Inhalt von [`webflow/head-code.html`](webflow/head-code.html) in *Site Settings → Custom Code → Head Code* einfügen (oder nur in den Page Settings der Seiten mit Slider).
3. **Footer Code:** Inhalt von [`webflow/footer-code.html`](webflow/footer-code.html) am besten in den **Page Settings → Custom Code → Before </body>** der Seiten mit Slider einfügen.
4. Veröffentlichen. Custom Code läuft nur auf der veröffentlichten Seite, nicht im Designer.

**Warum Page Code?** Die Vollversion hat rund 24.000 Zeichen, WF Anim rund 42.000. Webflow erlaubt 50.000 pro Feld. Beides zusammen passt nicht in den Site-Footer, jede Seite hat aber ihr eigenes Feld. Alternativ mit `build.js` ausdünnen oder aus GitHub laden.

### Alternative: aus GitHub laden

```html
<script src="https://cdn.jsdelivr.net/gh/rakete13/wf-slider@1.0.0/src/wf-slider.min.js"></script>
```

Bequem für eigene und betreute Projekte. Die Seite hängt dann aber an diesem Repo und an jsDelivr, und die IP-Adresse der Besucher geht an jsDelivr (in der Datenschutzerklärung erwähnen). Bei Übergabe an einen Kunden besser den eingebetteten Footer Code nehmen.

## Aufbau im Designer

```
slider-wrapper            ← data-slider = carousel
  ├── Collection List Wrapper
  │     └── Collection List      ← Track, wird automatisch erkannt (Display flex, Gap)
  │           └── Collection Item  ← Slide (Flex Shrink 0, Breite pro Breakpoint)
  └── slider-controls
        ├── button-prev   ← data-slider-prev
        ├── dots          ← data-slider-dots (darin ein gestalteter Punkt als Vorlage)
        ├── button-next   ← data-slider-next
        └── counter       ← data-slider-current / data-slider-total
```

- **Ohne CMS** markierst du den Track mit `data-slider-track`. Seine Kinder sind die Slides, oder nur die mit `data-slider-slide`.
- **Wie viele Slides sichtbar sind**, bestimmt allein die Breite der Slides im Designer. Pro Breakpoint frei gestaltbar, die Library misst nach.
- **Bedienelemente außerhalb des Wrappers** bekommen die Slider-ID als Wert: Wrapper `data-slider-id="hero"`, Pfeil irgendwo auf der Seite `data-slider-next="hero"`.
- **Passen alle Slides hinein**, bleibt der Slider ruhig (`is-static`) und die Bedienelemente werden ausgeblendet. **Leere Collection:** `is-empty`, Bedienelemente aus.

## Typen

| Typ | Wofür |
|---|---|
| `carousel` | Ziehbare Reihe mit Snapping. Optional Loop (`data-slider-loop`), zentriert (`data-slider-align="center"`), Autoplay. |
| `fade` | Überblenden für Hero und Testimonials. Standardmäßig endlos, Wischen funktioniert trotzdem. |
| `thumbs` | Thumbnails, die einen anderen Slider steuern: `data-slider-for="<id>"`. |

Galerie = Haupt-Slider (`fade` oder `carousel`) mit `data-slider-id="galerie"` plus Thumbnails mit `data-slider="thumbs"` und `data-slider-for="galerie"`. Beide können aus derselben Collection kommen.

## Einstellungen am Wrapper

`data-slider-id`, `data-slider-loop`, `data-slider-align` (`start` `center` `end`), `data-slider-autoplay` (Sekunden, ohne Wert 5), `data-slider-step` (Zahl oder `page`), `data-slider-start` (ab 1), `data-slider-rewind`, `data-slider-duration`, `data-slider-ease`, `data-slider-snap="false"`, `data-slider-drag="false"`, `data-slider-wheel="false"`, `data-slider-keyboard="false"`, `data-slider-pause-hover="false"`, `data-slider-overflow="visible"`, `data-slider-media="(max-width: 991px)"`, `data-slider-mobile="false"`, `data-slider-pad` (Zähler mit Nullen), `data-slider-label` (für Screenreader), `data-slider-for` (bei thumbs).

## Markierte Elemente

| Attribut | Element |
|---|---|
| `data-slider-track` | Reihe der Slides (bei Collection Lists automatisch) |
| `data-slider-slide` | optional: nur diese Kinder sind Slides |
| `data-slider-viewport` | optional: Element, das abschneidet (sonst das Eltern-Element des Tracks) |
| `data-slider-prev` / `data-slider-next` | Pfeile, als Div, Link Block oder Button |
| `data-slider-dots` | Container für Punkte, das erste Kind ist die Vorlage |
| `data-slider-current` / `data-slider-total` | Zähler |
| `data-slider-progress` | Fortschritt, wird mit `scaleX` von links gefüllt (Autoplay-Zeit, sonst Position) |
| `data-slider-pause` | Pause/Play für Autoplay |
| `data-slider-anim` | Inhalt in einer Slide animieren: `fade-in` `fade-up` `fade-down` `fade-left` `fade-right` `scale-in` `blur-in` `clip-up`, dazu `-delay` `-duration` `-distance` `-stagger` `-ease` |
| `data-slider-nodrag` | darin startet kein Ziehen (z. B. Video-Steuerung) |

## Klassen zum Gestalten

`is-active` (Slide, Punkt, Thumbnail) · `is-in-view` (gerade sichtbare Slides) · `is-disabled` (Pfeil am Ende ohne Loop) · `is-dragging`, `is-paused`, `is-static`, `is-empty` (am Wrapper).

Die Klassen im Designer an einem Element anlegen (z. B. Combo Class `is-active` am Punkt), damit Webflow sie beim Veröffentlichen behält.

## Barrierefreiheit

- Wrapper als Region mit Namen, Slides mit „3 von 8“, Pfeile und Punkte per Tastatur bedienbar, auch wenn sie im Designer als Div gebaut sind.
- Pfeiltasten links/rechts, sobald der Fokus im Slider ist. Bekommt ein Link in einer Slide außerhalb des Bildes den Fokus, wird die Slide hergeholt.
- Autoplay pausiert bei Hover, Tastatur-Fokus, außerhalb des Bildschirms und im Hintergrund-Tab. Ein Pause-Button (`data-slider-pause`) wird für Autoplay empfohlen (WCAG 2.2.2).
- Bei „Bewegung reduzieren“: kein Autoplay, Wechsel ohne Animation, Inhalte sofort sichtbar.

## Hinweise

- **Loop ohne Klone:** Die echten Slides werden einzeln verschoben. Webflow Interactions, Lightboxen und IDs bleiben intakt. Dafür setzt die Library im Loop `transform` an den Slides: Hover-Scale oder Transitions deshalb an ein inneres Element legen.
- **Loop braucht genug Slides:** Sie müssen zusammen mindestens eine Slide breiter sein als der sichtbare Bereich. Sonst läuft der Slider ohne Loop (Hinweis im Debug-Modus).
- **WF Anim in Slides:** `data-anim` startet beim Scrollen, nicht beim Slide-Wechsel. In Slides `data-slider-anim` verwenden.
- **Track ohne CSS-Transition auf transform**, sonst läuft die Bewegung nach.
- **Nachgeladene Inhalte:** `WFSlider.init(container)` startet neue Slider, `WFSlider.refresh()` misst alle neu.

## Debug-Modus

`?wfslider-debug` an die Seitenadresse hängen, `data-slider-debug` am body oder `WFSliderConfig.debug = true`. Zeigt eine Tabelle aller Slider in der Konsole mit Zustand und Hinweisen (Slides brechen um, Slide ohne Breite, Loop nicht möglich, Transition am Track, `data-anim` in Slides, `data-slider-for` ohne passenden Slider, Autoplay ohne Pause-Button) und umrandet jeden Slider.

## API

```js
const s = WFSlider.get('hero'); // per ID oder Element
s.next(); s.prev(); s.goTo(2);  // Index ab 0
s.play(); s.pause(); s.index; s.length;
s.on('change', ({ index, slide }) => {});
el.addEventListener('wfslider:change', (e) => e.detail.index);

WFSlider.init(scope); WFSlider.refresh(); WFSlider.destroy(scope);
```

Globale Voreinstellungen vor dem Footer Code über `window.WFSliderConfig = { duration, fadeDuration, ease, autoplay, distance, mobileBreakpoint, labels: { … } }`. Die Texte für Screenreader (`labels`) lassen sich so auch auf Englisch umstellen.

## Aufbau

```
src/wf-slider.js          Quellcode der Library
src/wf-slider.min.js      minimierte Vollversion (für jsDelivr)
build.js                  erzeugt den Webflow-Code (voll oder ausgedünnt)
webflow/head-code.html    fertiger Head Code
webflow/footer-code.html  fertiger Footer Code (Vollversion)
docs/index.html           Doku- und Demo-Seite
test/                     Browser-Test der Demo-Seite (Playwright)
```

## Ausgedünnte Version bauen

```bash
node build.js carousel,autoplay ./ausgabe-ordner
```

Typen `carousel`, `fade`, `thumbs`, Bausteine `autoplay` (Autoplay und Pause-Button) und `anim` (`data-slider-anim`). Nur `fade`: rund 19.000 Zeichen. Ohne Ordnerangabe wird die Vollversion nach `webflow/` und `src/wf-slider.min.js` geschrieben. Benötigt Node.js und esbuild (`npm i -g esbuild`) oder TypeScript.

## Versionen

Stabile Stände werden als Release markiert (`1.0.0`, …). Bestehende Webflow-Projekte ändern sich nicht automatisch, ein Update wird bewusst neu eingefügt.
