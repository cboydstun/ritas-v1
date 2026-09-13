# Contrast audit

How the light/dark contrast failures fixed in this branch were found, and how to
re-run the check. Nothing here runs in CI — CI has no browser and cannot measure
a rendered colour. The automated half is `src/lib/__tests__/theme-contrast.test.ts`,
a source-shape ratchet that can only catch the patterns already known to fail.
This document is the other half: the measurement.

## Why a script rather than an extension

Two things make an off-the-shelf checker unreliable on this app:

- **Stacked alpha.** Surfaces are written as `dark:bg-charcoal/50` over
  `bg-light` over the body. The effective background of a piece of text is the
  composite, not the nearest declared colour, and a checker that reads one
  `background-color` reports the wrong denominator.
- **Tailwind 4 emits `color-mix(in oklab, …)`** for every `/NN` opacity, so
  `getComputedStyle().color` comes back as an `oklab()` string. Parsing the
  numbers out of it as if they were sRGB gives nonsense.

The script below composites the whole ancestor chain and resolves every colour
through a 1×1 canvas, which handles `oklab`, `color-mix` and named colours alike.

## Running it

1. `npm run dev` (or point at production).
2. Open the page, then set the theme **and reload** —
   `localStorage.setItem('theme','dark'); location.reload()`. Do not toggle the
   `.dark` class on `<html>` by hand: next-themes also writes an inline
   `color-scheme`, and a half-applied state produces readings that are artefacts
   of the hack rather than of the page.
3. Paste the script into the console and call `__S()`.
4. Repeat with `'light'`.

Each row is `ratio/required ×count tag "text" fg bg [classes]`. The requirement
is 4.5:1 for body text, 3:1 for large text (≥24px, or ≥18.66px bold) and for
icons.

```js
window.__A = function () {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.globalCompositeOperation = "copy";
  // One canvas paint resolves oklab / color-mix / named colours to sRGB.
  function P(c) {
    try {
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (e) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
  }
  function L(p) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(p.r) + 0.7152 * f(p.g) + 0.0722 * f(p.b);
  }
  function R(a, b) {
    const x = L(a),
      y = L(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function C(f, b) {
    const a = f.a;
    return {
      r: f.r * a + b.r * (1 - a),
      g: f.g * a + b.g * (1 - a),
      b: f.b * a + b.b * (1 - a),
      a: 1,
    };
  }
  // Walk up until an opaque background, then composite back down.
  //
  // A gradient stops the walk and is reported rather than measured: it has no
  // single colour, and silently falling through to the body's white produced
  // ratios of 1.0 for white-on-gradient text, which is an artefact and not a
  // finding. Every CTA band in this app is a gradient, so this matters.
  function BG(el) {
    let c = el;
    const st = [];
    while (c) {
      if (/gradient/.test(getComputedStyle(c).backgroundImage))
        return { gradient: true };
      const x = P(getComputedStyle(c).backgroundColor);
      if (x.a > 0) st.push(x);
      if (x.a === 1) break;
      c = c.parentElement;
    }
    let base = P(getComputedStyle(document.documentElement).backgroundColor);
    if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = st.length - 1; i >= 0; i--) base = C(st[i], base);
    return base;
  }
  const m = new Map();
  const g = new Map(); // painted on a gradient: listed, never scored
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if (parseFloat(cs.opacity) === 0) return;
    if (el.getClientRects().length === 0) return;
    const tg = el.tagName.toLowerCase();
    if (tg === "script" || tg === "style" || tg === "noscript") return;
    const tx = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(" ");
    const ic = tg === "svg";
    if (!tx && !ic) return;
    let fr = P(cs.color);
    if (ic && fr.a === 0) {
      const f = P(cs.fill);
      if (f.a > 0) fr = f;
    }
    if (fr.a === 0) return;
    const bg = BG(el);
    const cl0 = String(el.getAttribute("class") || "").slice(0, 120);
    if (bg.gradient) {
      const gk = tg + "|" + cl0 + "|" + cs.color;
      if (!g.has(gk))
        g.set(gk, {
          tag: tg,
          t: (tx || "[icon]").slice(0, 40),
          fg: cs.color,
          cls: cl0,
        });
      return;
    }
    let fg = fr.a < 1 ? C(fr, bg) : fr;
    const op = parseFloat(cs.opacity);
    if (op < 1) fg = C(Object.assign({}, fg, { a: op }), bg);
    const sz = parseFloat(cs.fontSize);
    const bd = parseInt(cs.fontWeight) >= 700;
    const lg = sz >= 24 || (sz >= 18.66 && bd);
    const nd = ic ? 3 : lg ? 3 : 4.5;
    const r = R(fg, bg);
    if (r >= nd) return;
    const cl = String(el.getAttribute("class") || "").slice(0, 120);
    const k = tg + "|" + cl + "|" + cs.color + "|" + Math.round(bg.r);
    const p = m.get(k);
    if (p) {
      p.n++;
      return;
    }
    m.set(k, {
      n: 1,
      tag: tg,
      t: (tx || "[icon]").slice(0, 40),
      cls: cl,
      fg:
        "rgb(" +
        fg.r.toFixed(0) +
        "," +
        fg.g.toFixed(0) +
        "," +
        fg.b.toFixed(0) +
        ")",
      bg:
        "rgb(" +
        Math.round(bg.r) +
        "," +
        Math.round(bg.g) +
        "," +
        Math.round(bg.b) +
        ")",
      r: +r.toFixed(2),
      need: nd,
    });
  });
  const it = [...m.values()].sort((a, b) => a.r - b.r);
  return {
    p: location.pathname,
    dark: document.documentElement.classList.contains("dark"),
    total: it.reduce((s, i) => s + i.n, 0),
    uniq: it.length,
    items: it,
    gradients: [...g.values()],
  };
};
window.__S = function () {
  const d = window.__A();
  return (
    d.p +
    " dark=" +
    d.dark +
    " tot=" +
    d.total +
    " uniq=" +
    d.uniq +
    "\n" +
    d.items
      .slice(0, 26)
      .map(
        (i) =>
          i.r +
          "/" +
          i.need +
          " x" +
          i.n +
          " " +
          i.tag +
          ' "' +
          i.t.slice(0, 20) +
          '" fg' +
          i.fg +
          " bg" +
          i.bg +
          " [" +
          i.cls.slice(0, 65) +
          "]",
      )
      .join("\n") +
    (d.gradients.length
      ? "\non a gradient — check the two stops by hand:\n" +
        d.gradients
          .map((i) => "  " + i.tag + ' "' + i.t.slice(0, 20) + '" fg' + i.fg)
          .join("\n")
      : "")
  );
};
```

## Pages to cover

`/`, `/pricing`, `/order` (**all five wizard steps** — the machine, mixer and
extras cards are only reachable by advancing), `/contact`, `/faq`, `/about`,
`/long-term-lease`, `/service-area`, one `/service-area/<city>` (they all render
through `SectionRenderer`), `/blog`, one `/blog/<slug>`, `/success`, and any 404. Both themes.

Walking the wizard on production fires real `order_step` GA4 events. Prefer a
local dev server, or accept a handful of funnel events in the property.

## Measured palette facts

Computed with the same relative-luminance formula; keep these in sync with the
comments in `src/app/globals.css`.

| Pair                                           | Ratio       |                           |
| ---------------------------------------------- | ----------- | ------------------------- |
| `--color-margarita` #4b7a0a on white           | 5.14        | pass                      |
| `--color-margarita` on `--color-charcoal`      | 2.46        | **fail**                  |
| `--color-margarita-dark` #8ec63f on charcoal   | 6.20        | pass                      |
| `--color-margarita-dark` on white              | 2.04        | **fail** — dark mode only |
| `--color-teal` #026b62 on white                | 6.40        | pass                      |
| `--color-teal` on charcoal                     | 1.97        | **fail**                  |
| `--color-teal-dark` #2dd4bf on charcoal        | 6.79        | pass                      |
| `--color-teal-dark` on white                   | 1.86        | **fail** — dark mode only |
| `text-charcoal/50` on white                    | 2.85        | **fail**                  |
| `text-charcoal/60` on white                    | 3.71        | **fail**                  |
| `text-charcoal/70` on white                    | 4.94        | pass                      |
| `dark:text-white/40` on charcoal               | 3.32        | **fail**                  |
| `dark:text-white/50` on charcoal               | 4.43        | **fail**                  |
| `dark:text-white/60` on charcoal               | 5.66        | pass                      |
| white on `--color-orange` #ff9f40              | 2.04        | **fail**                  |
| white on `--color-pink` #ff6f91                | 2.65        | **fail**                  |
| `--color-charcoal` on orange / pink            | 6.19 / 4.77 | pass                      |
| `--color-orange` on white / on `--color-light` | 2.04 / 1.91 | **fail**                  |
| `--color-orange` on charcoal                   | 6.19        | pass                      |

## Known remaining failures

Not theme bugs — these fail in **both** themes because the brand colours are
light. Fixing them is a brand decision, deliberately left open:

- `BookingCTA.tsx`: white text on the `from-orange to-pink` gradient (2.04–2.65),
  and the `bg-white text-orange` "Book Now" button (2.04). `text-charcoal` on
  the same gradient measures 6.19 / 4.77.
- `SocialProofSection.tsx`: the orange review stars on `bg-light` (1.91 against a
  3:1 requirement for icons). `text-amber-700 dark:text-orange` measures
  4.69 / 6.19.
- `ReviewStep.tsx` terms checkbox: `text-orange` accent, so the white tick sits
  on orange at 2.04.

Disabled controls (`disabled:opacity-50`) read low — the ZIP "Check" button at
2.79, the wizard's "Previous" at 2.80 — and are **exempt** under WCAG 1.4.3.
Do not "fix" them.
