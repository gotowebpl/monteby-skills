#!/usr/bin/env node
/**
 * extract-reference-spec.mjs
 *
 * Krok pomiarowy toru mechanicznego. Wypisuje snippet, który — wykonany w
 * przeglądarce na stronie makiety — zwraca pełną, ustrukturyzowaną specyfikację
 * layoutu: drzewo sekcji z policzonymi stylami, tekstami, obrazami i rolami.
 *
 * Model nie interpretuje makiety wzrokiem: specyfikacja jest wejściem do
 * deterministycznego kompilatora `spec-to-layout.mjs`.
 *
 * Użycie:
 *   node extract-reference-spec.mjs --emit-snippet
 *     → wykonaj wynik w przeglądarce przy szerokości 1440, zapisz JSON jako spec
 *
 * Snippet sam klasyfikuje węzły (rola jest funkcją tagu i zawartości, nie oceny):
 *   heading  — h1..h6
 *   text     — element, którego dzieci są wyłącznie inline/tekstem
 *   button   — <a>/<button> z tłem lub obrysem
 *   link     — pozostałe <a>
 *   image    — <img>; svg → asset (residuum: wyeksportuj do bitmapy)
 *   list     — <ul>/<ol> bez zagnieżdżonych bloków
 *   form     — <form>
 *   box      — wszystko inne z dziećmi blokowymi
 */

'use strict';

const SNIPPET = String.raw`(function () {
  var LIMIT_DEPTH = 9;
  var round = function (n) { return Math.round(n * 10) / 10; };
  var px = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n); };

  var INLINE = { A:1, SPAN:1, STRONG:1, EM:1, B:1, I:1, SMALL:1, BR:1, SUP:1, SUB:1, CODE:1, MARK:1, ABBR:1 };

  function visible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0.5 || r.height > 0.5;
  }

  function textOnly(el) {
    for (var i = 0; i < el.children.length; i++) {
      var c = el.children[i];
      if (!visible(c)) continue;
      if (!INLINE[c.tagName]) return false;
      var ccs = getComputedStyle(c);
      var d = ccs.display;
      if (d === 'block' || d === 'flex' || d === 'grid') return false;
      if (d === 'inline-block' && (px(ccs.borderTopWidth) > 0 || px(ccs.paddingLeft) > 0)) return false;
    }
    return true;
  }

  function role(el) {
    var t = el.tagName;
    if (/^H[1-6]$/.test(t)) return 'heading';
    if (t === 'IMG') return 'image';
    if (t === 'SVG' || t === 'svg') return 'asset';
    if (t === 'FORM') return 'form';
    if (t === 'UL' || t === 'OL') {
      for (var li = 0; li < el.children.length; li++) {
        if (el.children[li].tagName === 'LI' && !textOnly(el.children[li])) return 'box';
      }
      return 'list';
    }
    if (t === 'LI') { if (!textOnly(el)) return 'box'; }
    if (t === 'A' || t === 'BUTTON') {
      for (var bc = 0; bc < el.children.length; bc++) {
        var bcs = getComputedStyle(el.children[bc]);
        if (bcs.display === 'block' || bcs.display === 'flex' || bcs.display === 'grid') return 'box';
      }
      var cs = getComputedStyle(el);
      var hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      var hasBorder = px(cs.borderTopWidth) > 0;
      return (hasBg || hasBorder) ? 'button' : 'link';
    }
    if (textOnly(el)) {
      // rząd samych odnośników/przycisków to kontener, nie akapit
      var actionable = 0; var visibleKids = 0;
      for (var k = 0; k < el.children.length; k++) {
        var kid = el.children[k];
        if (!visible(kid)) continue;
        visibleKids++;
        if (kid.tagName === 'A' || kid.tagName === 'BUTTON') actionable++;
      }
      if (actionable > 0 && actionable === visibleKids) return 'box';
      if ((el.innerText || '').trim()) return 'text';
    }
    return 'box';
  }

  function styleOf(el) {
    var cs = getComputedStyle(el);
    var r = el.getBoundingClientRect();
    var s = {
      rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }
    };
    var bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') s.background = bg;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') s.backgroundImage = cs.backgroundImage.slice(0, 400);
    var d = cs.display;
    if (d === 'flex' || d === 'inline-flex') {
      s.display = 'flex';
      s.flexDirection = cs.flexDirection;
      if (cs.flexWrap !== 'nowrap') s.flexWrap = cs.flexWrap;
      if (cs.justifyContent !== 'normal' && cs.justifyContent !== 'flex-start') s.justifyContent = cs.justifyContent;
      if (cs.alignItems !== 'normal' && cs.alignItems !== 'stretch') s.alignItems = cs.alignItems;
    } else if (d === 'grid') {
      s.display = 'grid';
      s.gridTemplateColumns = cs.gridTemplateColumns;
      if (cs.justifyContent !== 'normal' && cs.justifyContent !== 'start') s.justifyContent = cs.justifyContent;
      if (cs.alignItems !== 'normal' && cs.alignItems !== 'stretch') s.alignItems = cs.alignItems;
    }
    var gap = cs.gap || cs.gridGap;
    if (gap && gap !== 'normal' && px(gap) > 0) s.gap = gap.split(' ').map(px);
    var pads = [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)];
    if (pads.some(function (p) { return p > 0; })) s.padding = pads;
    var margins = [px(cs.marginTop), px(cs.marginRight), px(cs.marginBottom), px(cs.marginLeft)];
    if (margins.some(function (m) { return m !== 0; })) s.margin = margins;
    var bw = [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)];
    if (bw.some(function (b) { return b > 0; })) {
      s.borderWidth = bw;
      var bcols = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
      s.borderColor = cs.borderTopColor;
      if (bcols.some(function (c) { return c !== bcols[0]; })) s.borderColors = bcols;
    }
    if (px(cs.borderRadius) > 0) s.borderRadius = px(cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') s.boxShadow = cs.boxShadow.slice(0, 120);
    if (cs.maxWidth !== 'none') s.maxWidth = px(cs.maxWidth);
    if (px(cs.minHeight) > 0) s.minHeight = px(cs.minHeight);
    if (cs.position === 'sticky' || cs.position === 'fixed' || cs.position === 'absolute') s.position = cs.position;
    if (cs.overflow !== 'visible') s.overflow = cs.overflow;
    if (parseFloat(cs.flexGrow) > 0) s.flexGrow = parseFloat(cs.flexGrow);
    if (parseFloat(cs.flexShrink) !== 1) s.flexShrink = parseFloat(cs.flexShrink);
    if (cs.flexBasis !== 'auto') s.flexBasis = cs.flexBasis;
    return s;
  }

  /* --- ruch -------------------------------------------------------------
     Stan po najechaniu i animacja nie wynikają z policzonego stylu spoczynku,
     więc czytamy je wprost z arkuszy. Zbieramy raz: reguły ze stanem
     (:hover, :focus-visible, :active) oraz definicje @keyframes. */
  var MOTION_PROPS = {
    'background-color': 1, 'background': 1, 'color': 1, 'border-color': 1,
    'border-bottom-color': 1, 'border-top-color': 1, 'box-shadow': 1,
    'transform': 1, 'opacity': 1, 'filter': 1, 'text-decoration-color': 1,
    'letter-spacing': 1, 'outline-color': 1
  };

  var STATE_RE = /:(hover|focus-visible|focus|active)\b/;

  var stateRules = [];
  var keyframes = {};
  var reducedMotionHonored = false;

  (function collectSheets() {
    function walk(list, media) {
      for (var i = 0; i < list.length; i++) {
        var rule = list[i];

        if (rule.name && rule.cssRules && rule.selectorText === undefined) {
          keyframes[rule.name] = [].map.call(rule.cssRules, function (kf) {
            return { at: kf.keyText, css: kf.style.cssText.slice(0, 240) };
          });
          continue;
        }

        /* Kolejność ma znaczenie: od czasu zagnieżdżania CSS zwykła reguła
           stylu też wystawia cssRules (pustą listę). Sprawdzanie jej przed
           selectorText przemilczałoby wszystkie stany. */
        if (rule.selectorText && STATE_RE.test(rule.selectorText)) {
          var declarations = {};
          for (var d = 0; d < rule.style.length; d++) {
            var prop = rule.style[d];
            var value = rule.style.getPropertyValue(prop);
            /* Longhand bez własnej wartości pochodzi z rozwinięcia skrótu i
               niczego nie opisuje. */
            if (MOTION_PROPS[prop] && value) declarations[prop] = value;
          }

          /* Skrót ze zmienną (background: var(--x)) nie jest rozwijany na
             longhandy — ich wartości są puste. Oryginalny zapis deklaracji
             jest wtedy jedynym źródłem. */
          (rule.style.cssText || '').split(';').forEach(function (chunk) {
            var colon = chunk.indexOf(':');
            if (colon < 0) return;
            var name = chunk.slice(0, colon).trim();
            var raw = chunk.slice(colon + 1).trim();
            if (raw && MOTION_PROPS[name] && ! declarations[name]) declarations[name] = raw;
          });

          var state = rule.selectorText.match(STATE_RE)[1];
          var base = rule.selectorText.replace(new RegExp(':' + state + '\\b', 'g'), '').trim();

          /* Reset fokusu z arkusza bazowego pasuje do każdego węzła strony i
             zalałby specyfikację. Interesuje nas stan konkretnego elementu. */
          var universal = base === '' || base === '*' || base === ':root' || base === 'html' || base === 'body';

          if (Object.keys(declarations).length && ! universal) {
            stateRules.push({
              base: base,
              state: state,
              media: media || '',
              declarations: declarations
            });
          }
        }

        if (rule.cssRules && rule.cssRules.length) {
          var cond = rule.conditionText || (rule.media && rule.media.mediaText) || '';
          if (/prefers-reduced-motion/.test(cond)) reducedMotionHonored = true;
          walk(rule.cssRules, cond || media);
        }
      }
    }

    for (var s = 0; s < document.styleSheets.length; s++) {
      var rules;
      try { rules = document.styleSheets[s].cssRules; } catch (e) { continue; } // arkusz obcego origin
      if (rules) walk(rules, '');
    }
  })();

  function motionOf(el) {
    var cs = getComputedStyle(el);
    var m = {};

    if (cs.transitionDuration && cs.transitionDuration !== '0s') {
      m.transition = {
        property: cs.transitionProperty,
        duration: cs.transitionDuration,
        timing: cs.transitionTimingFunction,
        delay: cs.transitionDelay
      };
    }

    if (cs.animationName && cs.animationName !== 'none') {
      m.animation = {
        name: cs.animationName,
        duration: cs.animationDuration,
        timing: cs.animationTimingFunction,
        delay: cs.animationDelay,
        iteration: cs.animationIterationCount,
        direction: cs.animationDirection,
        fill: cs.animationFillMode
      };
      cs.animationName.split(',').forEach(function (name) {
        name = name.trim();
        if (keyframes[name]) {
          m.keyframes = m.keyframes || {};
          m.keyframes[name] = keyframes[name];
        }
      });
    }

    var states = [];
    for (var i = 0; i < stateRules.length; i++) {
      var rule = stateRules[i];
      var hit = false;
      try { hit = el.matches(rule.base); } catch (e) { hit = false; }
      if (hit) states.push({ state: rule.state, media: rule.media, declarations: rule.declarations });
    }
    if (states.length) m.states = states;

    return Object.keys(m).length ? m : null;
  }

  function typographyOf(el) {
    var cs = getComputedStyle(el);
    var t = {
      fontSize: round(parseFloat(cs.fontSize)),
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(),
      lineHeight: cs.lineHeight === 'normal' ? null : round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)),
      color: cs.color
    };
    if (cs.letterSpacing !== 'normal') t.letterSpacing = cs.letterSpacing;
    if (cs.textTransform !== 'none') t.textTransform = cs.textTransform;
    if (cs.textAlign !== 'start' && cs.textAlign !== 'left') t.textAlign = cs.textAlign;
    if (cs.fontVariationSettings && cs.fontVariationSettings !== 'normal') t.fontVariationSettings = cs.fontVariationSettings;
    return t;
  }

  function node(el, depth) {
    if (!visible(el)) return null;
    var r = role(el);
    var out = { role: r, tag: el.tagName.toLowerCase(), style: styleOf(el) };

    var motion = motionOf(el);
    if (motion) out.motion = motion;

    if (r === 'heading' || r === 'text' || r === 'button' || r === 'link') {
      out.text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      out.typography = typographyOf(el);
      if (r === 'heading') {
        var lines = [];
        var pending = '';
        for (var hn = 0; hn < el.childNodes.length; hn++) {
          var cn = el.childNodes[hn];
          if (cn.nodeType === 3) { pending += cn.textContent; continue; }
          if (cn.nodeType !== 1) continue;
          var cd = getComputedStyle(cn).display;
          if (cd === 'block') {
            if (pending.replace(/\s+/g, ' ').trim()) lines.push({ text: pending.replace(/\s+/g, ' ').trim(), color: getComputedStyle(el).color });
            pending = '';
            lines.push({ text: (cn.innerText || '').replace(/\s+/g, ' ').trim(), color: getComputedStyle(cn).color });
          } else {
            pending += cn.innerText || cn.textContent || '';
          }
        }
        if (pending.replace(/\s+/g, ' ').trim()) lines.push({ text: pending.replace(/\s+/g, ' ').trim(), color: getComputedStyle(el).color });
        if (lines.length > 1) out.lines = lines;
      }
      if (el.tagName === 'A' && el.getAttribute('href')) out.href = el.getAttribute('href');
      return out;
    }
    if (r === 'image') {
      out.src = el.currentSrc || el.src || '';
      out.alt = el.alt || '';
      out.objectFit = getComputedStyle(el).objectFit;
      return out;
    }
    if (r === 'asset') {
      out.note = 'SVG w makiecie — wyeksportuj do bitmapy i użyj ImageBlock';
      return out;
    }
    if (r === 'list') {
      out.items = [].map.call(el.querySelectorAll(':scope > li'), function (li) {
        var a = li.querySelector('a');
        return { text: (li.innerText || '').replace(/\s+/g, ' ').trim(), href: a ? a.getAttribute('href') : null };
      });
      out.typography = typographyOf(el);
      return out;
    }
    if (r === 'form') {
      out.intro = [];
      for (var fi = 0; fi < el.children.length; fi++) {
        var fc = el.children[fi];
        if (!visible(fc)) continue;
        if (/^H[1-6]$/.test(fc.tagName) || fc.tagName === 'P') {
          out.intro.push({
            role: /^H/.test(fc.tagName) ? 'heading' : 'text',
            tag: fc.tagName.toLowerCase(),
            text: (fc.innerText || '').replace(/\s+/g, ' ').trim(),
            typography: typographyOf(fc),
            marginBottom: px(getComputedStyle(fc).marginBottom)
          });
        } else break;
      }
      out.fields = [].map.call(el.querySelectorAll('input, select, textarea'), function (f) {
        if (f.type === 'hidden') return null;
        var label = f.id ? el.querySelector('label[for="' + f.id + '"]') : (f.closest('label'));
        return {
          kind: f.tagName === 'SELECT' ? 'select' : (f.tagName === 'TEXTAREA' ? 'textarea' : f.type),
          name: f.name || f.id || '',
          label: label ? label.innerText.replace(/\s+/g, ' ').trim() : '',
          placeholder: f.placeholder || '',
          required: !!f.required,
          options: f.tagName === 'SELECT' ? [].map.call(f.options, function (o) { return o.text; }) : undefined
        };
      }).filter(Boolean);
      var submit = el.querySelector('button, [type=submit]');
      out.submitLabel = submit ? submit.innerText.trim() : '';
      return out;
    }

    // box — rekurencja
    if (depth >= LIMIT_DEPTH) { out.note = 'obcięto na głębokości'; return out; }
    out.children = [];
    for (var i = 0; i < el.children.length; i++) {
      var child = node(el.children[i], depth + 1);
      if (child) out.children.push(child);
    }
    // pojedynczy wrapper bez własnego stylu — spłaszcz
    if (out.children.length === 1 && !out.style.background && !out.style.padding && !out.style.display && !out.style.borderWidth) {
      var only = out.children[0];
      if (only.role === 'box') { only.style.rect = out.style.rect; return only; }
    }
    return out;
  }

  // pasy strony = wszystkie widoczne blokowe dzieci <main> (sekcje bywają divami)
  function bands(root) {
    if (!root) return [];
    return [].filter.call(root.children, function (el) {
      if (!visible(el)) return false;
      var t = el.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEMPLATE') return false;
      return el.getBoundingClientRect().height > 8;
    });
  }
  function effectiveBackground(el) {
    var cur = el;
    while (cur && cur !== document.documentElement) {
      var bg = getComputedStyle(cur).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      cur = cur.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
  var sections = bands(document.querySelector('main'));
  if (!sections.length) sections = [].slice.call(document.querySelectorAll('body > section, body section.section, body > .section'));
  if (!sections.length) sections = bands(document.body);

  return {
    kind: 'monteby-reference-spec',
    version: 2,
    viewport: innerWidth,
    pageHeight: document.body.scrollHeight,
    contentWidth: (function () {
      var widths = {};
      sections.forEach(function (s) {
        var kid = s.firstElementChild;
        if (!kid) return;
        var w = Math.round(kid.getBoundingClientRect().width);
        widths[w] = (widths[w] || 0) + 1;
      });
      var best = null; var count = 0;
      Object.keys(widths).forEach(function (w) { if (widths[w] > count) { count = widths[w]; best = +w; } });
      return best;
    })(),
    pageBackground: getComputedStyle(document.body).backgroundColor,
    motion: {
      /* Kontrakt nie wystawia kontrolek ruchu — te pozycje idą do planu
         residualnego motywu potomnego, nie do node mapy. */
      stateRules: stateRules.length,
      keyframeNames: Object.keys(keyframes),
      reducedMotionHonored: reducedMotionHonored,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
    },
    sections: sections.map(function (s, i) {
      var n = node(s, 0);
      n.index = i;
      if (!n.style.background && !n.style.backgroundImage) n.style.effectiveBackground = effectiveBackground(s);
      return n;
    })
  };
})()`;

if (process.argv.includes('--emit-snippet')) {
  console.log(SNIPPET);
} else {
  console.error('Użycie: node extract-reference-spec.mjs --emit-snippet');
  console.error('Wykonaj snippet w przeglądarce na stronie makiety (szerokość 1440), zapisz wynik jako spec JSON.');
  process.exit(2);
}
