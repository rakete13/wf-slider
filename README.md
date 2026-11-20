# WF Slider

Attribut-basierte Slider für Webflow, passend zu [WF Anim](https://github.com/rakete13/wf-anim). Wrapper auswählen, unter **Custom Attributes** `data-slider` mit `carousel`, `fade` oder `thumbs` setzen, fertig. Funktioniert mit Collection Lists genauso wie mit statischen Slides.

Die Übersicht mit Live-Demos und allen Attributen: **https://rakete13.github.io/wf-slider/** (Quelle: [`docs/index.html`](docs/index.html)), Effekte zum Ausprobieren: **https://rakete13.github.io/wf-slider/effekte.html**.

## In ein Webflow-Projekt einbauen

1. **GSAP aktivieren:** im Projekt unter *Settings → GSAP integration* GSAP einschalten. Plugins sind nicht nötig.
2. **Head Code:** Inhalt von [`webflow/head-code.html`](webflow/head-code.html) in *Site Settings → Custom Code → Head Code* einfügen (oder nur in den Page Settings der Seiten mit Slider).
3. **Footer Code:** Inhalt von [`webflow/footer-code.html`](webflow/footer-code.html) am besten in den **Page Settings → Custom Code → Before </body>** der Seiten mit Slider einfügen.
4. Veröffentlichen. Custom Code läuft nur auf der veröffentlichten Seite, nicht im Designer.

**Warum Page Code?** Die Vollversion hat rund 33.500 Zeichen, WF Anim rund 42.000. Webflow erlaubt 50.000 pro Feld. Beides zusammen passt nicht in den Site-Footer, jede Seite hat aber ihr eigenes Feld. Alternativ mit `build.js` ausdünnen oder aus GitHub laden.

### Alternative: aus GitHub laden

```html
<script src="https://cdn.jsdelivr.net/gh/rakete13/wf-slider@1.8.0/src/wf-slider.min.js"></script>
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
- **Bedienelemente außerhalb des Wrappers:** Liegen sie direkt daneben (z. B. eine `slider-nav` im selben Container) und gibt es dort nur einen Slider, ordnet die Library sie automatisch zu. Sonst bekommen sie die Slider-ID als Wert: Wrapper `data-slider-id="hero"`, Pfeil irgendwo auf der Seite `data-slider-next="hero"`.
- **Passen alle Slides hinein**, bleibt der Slider ruhig (`is-static`) und die Bedienelemente werden ausgeblendet. **Leere Collection:** `is-empty`, Bedienelemente aus.

## Typen

| Typ | Wofür |
|---|---|
| `carousel` | Ziehbare Reihe mit Snapping. Optional Loop (`data-slider-loop`), zentriert (`data-slider-align="center"`), Autoplay. |
| `fade` | Überblenden für Hero und Testimonials. Standardmäßig endlos, Wischen funktioniert trotzdem. |
| `thumbs` | Thumbnails, die einen anderen Slider steuern: `data-slider-for="<id>"`. |

Galerie = Haupt-Slider (`fade` oder `carousel`) mit `data-slider-id="galerie"` plus Thumbnails mit `data-slider="thumbs"` und `data-slider-for="galerie"`. Beide können aus derselben Collection kommen.

## Effekte und Übergänge (ab 1.1)

Live zum Umschalten: [`docs/effekte.html`](docs/effekte.html). Bei „Bewegung reduzieren“ fallen alle Effekte weg.

**Carousel: `data-slider-effect`**, läuft stufenlos mit der Position, auch beim Ziehen:

| Wert | Wirkung |
|---|---|
| `parallax` | Bild bewegt sich langsamer als die Slide (wird leicht vergrößert, das Eltern-Element schneidet ab) |
| `focus` | Mitte voll da, Nachbarn kleiner und blasser, am besten mit `data-slider-align="center"` |
| `tilt` | Neigung je nach Tempo, richtet sich beim Anhalten wieder auf |
| `coverflow` | seitliche Slides drehen sich in die Tiefe |

Stärke mit `data-slider-effect-strength` (Standard `1`, z. B. `0.5` oder `1.6`). Der Effekt wirkt auf ein **inneres Element** der Slide: das erste Kind, bei `parallax` das erste Bild, oder das Element mit `data-slider-effect-target`. Nie auf die Slide selbst, die bewegt im Loop die Library.

**Fade: `data-slider-transition`**, mit Richtung (Weiter läuft anders als Zurück):

| Wert | Wirkung |
|---|---|
| `fade` | Standard: weiches Überblenden |
| `zoom` | Einblenden und dabei von 115 % auf 100 % zoomen |
| `wipe` | Aufdecken aus Richtung der Navigation, die alte Slide rutscht ein Stück mit |
| `push` | neue Slide schiebt sich herein, die alte gleitet langsamer weg und dunkelt ab |
| `circle` | Kreis öffnet sich an der Klick- oder Tippstelle (bei Autoplay und Tastatur vom Rand) |
| `showcase` | Über dem Bild liegt ein Passepartout in der Farbe der Slide. Beim Wechsel wird der Rahmen breiter und das Bild etwas kleiner, der Ausschnitt bleibt aber immer gefüllt. Dann schiebt das Passepartout mit der Slide zur Seite, das Bild darunter bewegt sich langsamer mit (Parallax). Zum Schluss öffnen sich Rahmen und Bild wieder. Während des Schiebens blendet die Farbe des Passepartouts weich von der alten zur neuen Slide über, ohne harte Kante zwischen den Slides. Text mit `data-slider-anim` blendet vorher aus und danach ein. |

**Senkrecht: `data-slider-axis="y"`** (ab 1.8) für `wipe` und `push`: Weiter kommt von unten, zurück von oben. Passt zu senkrechten Listen mit `thumbs`: Wer in der Liste nach unten geht, sieht die neue Slide von unten hereinkommen.

**Showcase einrichten:** Das Passepartout hat die Hintergrundfarbe der Slide (in Webflow ein CMS-Farbfeld an die Background Color des Collection Items binden, oder `data-slider-bg`). Die Bild-Box ist das erste Kind der Slide oder das Element mit `data-slider-effect-target`, darin liegt das Bild. Einstellungen am Wrapper: `data-slider-scale` (Größe des Ausschnitts, Standard `0.75`; der Rahmen ist an allen Seiten gleich dick), `data-slider-parallax` (wie viel langsamer das Bild ist als das Passepartout, 0 bis 0.95; Standard wird so berechnet, dass nie eine Lücke entsteht), `data-slider-image-scale` (Bildgröße während des Wechsels, Standard so, dass der Ausschnitt gefüllt bleibt), `data-slider-ease` (Wechsel) und `data-slider-frame-ease` (Rahmen und Bild). Titel und Pfeile platziert ihr frei im Designer, Pfeile außerhalb mit Slider-ID.

**Form des Fensters: `data-slider-shape`** (ab 1.6)

| Wert | Form |
|---|---|
| `rect` | Rechteck (Standard) |
| `rounded` | abgerundetes Rechteck, Radius mit `data-slider-shape-radius` (px, Standard `24`) |
| `circle` | Kreis |
| `triangle` | Dreieck, Spitze oben |
| SVG-Datei | eigene Form, z. B. `https://…/logo.svg` oder `url(…)`. Die Form schrumpft als Maske von „größer als das Bild“ auf den Ausschnitt. Die Datei muss von derselben Domain kommen oder Auslesen erlauben (CORS); Webflow-Assets erlauben das. Die Form sollte in der Mitte gefüllt sein. |

Größe über `data-slider-scale`, Tempo über `data-slider-duration`, Easing über `data-slider-frame-ease`.

**Farbe aus dem Bild: `data-slider-bg`** (ab 1.3), für alle Slider-Typen. Jede Slide bekommt die dominante Farbe ihres ersten Bilds als Hintergrund:

| Wert | Wirkung |
|---|---|
| `auto` | gedeckt (Standard, ohne Wert) |
| `auto-light` | hell und pastellig |
| `auto-dark` | dunkel, gut für weiße Schrift |

- Die Farbe landet auf der Slide oder auf dem Element mit `data-slider-bg-target` (z. B. eine Fläche hinter der Karte).
- Hat das Element schon eine Inline-Farbe (CMS-Farbfeld an die Background Color gebunden), gewinnt diese. `auto` greift nur bei Slides ohne eigene Farbe.
- Bei `fade` werden die Nachbar-Slides nach dem Laden der Seite vorgeladen (Bild und Farbe), beim `carousel` wird die Farbe berechnet, sobald das Bild geladen ist.
- Das Bild muss vom Server ausgelesen werden dürfen (CORS). Das Webflow-CDN erlaubt das. Bei Bildern von anderen Servern meldet der Debug-Modus, wenn es nicht geht.

**Text: `data-slider-anim="lines"`** (oder `words`, `chars`) lässt Text aus einer Maske aufsteigen. Braucht SplitText (*GSAP integration → SplitText* anhaken), sonst wird daraus `fade-up`.

**Eigene Effekte: `--slide-progress`.** Jede Carousel-Slide hat diese CSS-Variable: 0 an der Ausrichtung, −1 eine Slide links, 1 eine Slide rechts, stufenlos. Beispiel als Custom CSS:

```css
.slide-inner { transform: rotate(calc(var(--slide-progress) * 6deg)); }
```

## Liste steuert Slider, Typ pro Breakpoint (ab 1.7)

Live: [Abschnitt 04 der Demo-Seite](https://rakete13.github.io/wf-slider/#liste). Beispiel: Links eine Namensliste aus dem CMS, rechts die Zitate. Auf Desktop springt der Slider beim Überfahren eines Namens zum passenden Zitat und blendet über. Ab Tablet ist die Liste weg und die Zitate sind ein normales Carousel.

```
Collection List Wrapper (Namen)  data-slider="thumbs"  data-slider-for="zitate"  data-slider-trigger="hover"  data-slider-hide="tablet"
slider-wrapper (Zitate)          data-slider="fade"    data-slider-id="zitate"    data-slider-tablet="carousel"
```

| Attribut | Wo | Werte | Wirkung |
|---|---|---|---|
| `data-slider-trigger` | thumbs | `click` (Standard), `hover` | Bei `hover` wechselt der Slider beim Überfahren, nach 80 ms (`WFSliderConfig.hoverDelay`), damit schnelles Drüberstreichen nicht durch alle Slides springt. Tastatur-Fokus wechselt auch, Tippen auf Touch-Geräten ebenso. Beim Verlassen bleibt die Slide stehen. |
| `data-slider-hide` | jeder Slider, z. B. thumbs | `tablet` (991 px und schmaler), `landscape` (767), `portrait` (479) oder eine Media Query | Ab dieser Breite ausgeblendet (`display: none`) und abgeschaltet |
| `data-slider-tablet` · `-landscape` · `-portrait` | Slider | `carousel`, `fade` | Ab dieser Breite abwärts läuft der Slider als dieser Typ. Beim Wechsel der Fensterbreite wird umgebaut, die aktuelle Slide bleibt |

- Jeder Eintrag der Liste gehört zur Slide mit derselben Position: Liste und Slider aus derselben Collection, mit gleicher Sortierung und gleichem Filter.
- Enthält ein Eintrag selbst einen Link (z. B. Themenliste, die zu Leistungen verlinkt), bleibt der Link der Bedienpunkt: Hover und Tastatur-Fokus wechseln die Slide, der Klick folgt dem Link.
- Der aktive Eintrag hat die Klasse `is-active`. Die Liste darf senkrecht stehen, sie wird dann nicht verschoben.
- Für den Typwechsel die Slides im Designer so anlegen, wie das Carousel sie braucht: Track Display flex, Slide-Breite pro Breakpoint (Desktop z. B. 100 %, Tablet 85 %). Beim Überblenden stapelt die Library die Slides selbst.
- Pfeile und Punkte, die es nur auf Tablet geben soll, in Webflow auf Desktop ausblenden.

## Einstellungen am Wrapper

`data-slider-id`, `data-slider-loop`, `data-slider-align` (`start` `center` `end`), `data-slider-autoplay` (Sekunden, ohne Wert 5), `data-slider-step` (Zahl oder `page`), `data-slider-start` (ab 1), `data-slider-rewind`, `data-slider-duration`, `data-slider-ease`, `data-slider-snap="false"`, `data-slider-drag="false"`, `data-slider-wheel="false"`, `data-slider-keyboard="false"`, `data-slider-pause-hover="false"`, `data-slider-overflow="visible"`, `data-slider-media="(max-width: 991px)"`, `data-slider-mobile="false"`, `data-slider-pad` (Zähler mit Nullen), `data-slider-label` (für Screenreader), `data-slider-for` und `data-slider-trigger` (bei thumbs), `data-slider-hide`, `data-slider-tablet` / `-landscape` / `-portrait`, `data-slider-effect` und `data-slider-effect-strength` (bei carousel), `data-slider-transition` und `data-slider-axis` (bei fade), `data-slider-bg` (alle Typen).

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
| `data-slider-bg-target` | optional: Element, das die Farbe aus dem Bild bekommt |
| `data-slider-effect-target` | optional: Element, auf das der Carousel-Effekt wirkt |
| `data-slider-anim` | Inhalt in einer Slide animieren: `fade-in` `fade-up` `fade-down` `fade-left` `fade-right` `scale-in` `blur-in` `clip-up`, mit SplitText auch `lines` `words` `chars`, dazu `-delay` `-duration` `-distance` `-stagger` `-ease` |
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

Globale Voreinstellungen vor dem Footer Code über `window.WFSliderConfig = { duration, fadeDuration, ease, autoplay, distance, mobileBreakpoint, hoverDelay, labels: { … } }`. Die Texte für Screenreader (`labels`) lassen sich so auch auf Englisch umstellen.

## Aufbau

```
src/wf-slider.js          Quellcode der Library
src/wf-slider.min.js      minimierte Vollversion (für jsDelivr)
build.js                  erzeugt den Webflow-Code (voll oder ausgedünnt)
webflow/head-code.html    fertiger Head Code
webflow/footer-code.html  fertiger Footer Code (Vollversion)
docs/                     Doku- und Demo-Seiten (GitHub Pages), docs/wf-slider.min.js wird von build.js erzeugt
test/                     Browser-Test der Demo-Seite (Playwright)
```

## Ausgedünnte Version bauen

```bash
node build.js carousel,autoplay ./ausgabe-ordner
```

Typen `carousel`, `fade`, `thumbs`, Bausteine `autoplay` (Autoplay und Pause-Button), `anim` (`data-slider-anim`), `effects` (Carousel-Effekte), `transitions` (Fade-Übergänge) und `bg` (Farbe aus dem Bild). Ohne Effekte und Übergänge spart man rund 2.500 Zeichen. Ohne Ordnerangabe wird die Vollversion nach `webflow/` und `src/wf-slider.min.js` geschrieben. Benötigt Node.js und esbuild (`npm i -g esbuild`) oder TypeScript.

## Versionen

Stabile Stände werden als Release markiert (`1.0.0`, …). Bestehende Webflow-Projekte ändern sich nicht automatisch, ein Update wird bewusst neu eingefügt.
