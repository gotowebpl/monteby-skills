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
      if (!INLINE[c.tagName] && visible(c)) return false;
    }
    return true;
  }

  function role(el) {
    var t = el.tagName;
    if (/^H[1-6]$/.test(t)) return 'heading';
    if (t === 'IMG') return 'image';
    if (t === 'SVG' || t === 'svg') return 'asset';
    if (t === 'FORM') return 'form';
    if (t === 'UL' || t === 'OL') return 'list';
    if (t === 'A' || t === 'BUTTON') {
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
    if (bw.some(function (b) { return b > 0; })) { s.borderWidth = bw; s.borderColor = cs.borderTopColor; }
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

    if (r === 'heading' || r === 'text' || r === 'button' || r === 'link') {
      out.text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      out.typography = typographyOf(el);
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
    sections: sections.map(function (s, i) {
      var n = node(s, 0);
      n.index = i;
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
