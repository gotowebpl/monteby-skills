#!/usr/bin/env node
/**
 * emit-child-theme-css.mjs
 *
 * Generuje arkusz motywu potomnego dla residuów — rzeczy, których kontrakt nie
 * wyraża (stany :hover, sticky, osie fontu zmiennego, druga warstwa tła,
 * resety wtyczki).
 *
 * Dlaczego generator, a nie plik pisany ręcznie: klasy renderera (`gcb-…`) są
 * skrótem propsów węzła i zmieniają się przy każdej edycji layoutu. Selektor
 * przepisany ręcznie po cichu przestaje pasować. Tutaj węzły wskazuje się
 * trwałym opisem (tekst nagłówka, pozycja sekcji), a skrypt odczytuje aktualną
 * klasę z wyrenderowanej strony.
 *
 * Użycie:
 *   node emit-child-theme-css.mjs --url http://site/ --plan residual.json --out monteby-custom.css
 *
 * Format planu:
 * {
 *   "rules": [
 *     { "locate": { "headingText": "Audyty BHP i PPOŻ", "up": 1 },
 *       "state": "hover",
 *       "declarations": { "background-color": "#1e222a" },
 *       "comment": "kafel usługi" },
 *     { "locate": { "sectionIndex": 0 }, "pseudo": "::before",
 *       "declarations": { "content": "''", "position": "absolute", "inset": "0" } },
 *     { "locate": { "css": ".gotoweb-form input" },
 *       "declarations": { "border-radius": "0" }, "important": true }
 *   ]
 * }
 *
 * `locate` rozpoznaje:
 *   headingText  — tekst nagłówka (h1–h4); `up` podnosi o N rodziców
 *   sectionIndex — n-ta sekcja treści (od 0)
 *   linkText     — dokładny tekst odnośnika
 *   css          — gotowy selektor, gdy cel nie jest węzłem buildera
 */

'use strict';

import { readFile, writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

/** Płaska lista elementów z klasą, tekstem i rodzicem — bez zależności. */
function parseDom(html) {
  const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>') + 7) || html;
  const items = [];
  const stack = [];
  const tagPattern = /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  const voidTags = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'path', 'circle', 'rect', 'line']);

  let match;
  while ((match = tagPattern.exec(body)) !== null) {
    const [, closing, rawTag, attrs, text] = match;
    if (text) {
      const value = text.replace(/\s+/g, ' ');
      for (const node of stack) node.text += value;
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }
    const classMatch = /class\s*=\s*"([^"]*)"/i.exec(attrs || '');
    const node = {
      tag,
      cls: classMatch ? classMatch[1] : '',
      text: '',
      parent: stack.length ? stack[stack.length - 1] : null,
      selfClosing: /\/\s*>$/.test(match[0]) || voidTags.has(tag),
    };
    items.push(node);
    if (!node.selfClosing) stack.push(node);
  }
  return items;
}

function builderClass(cls) {
  const match = /gcb-[0-9a-f]+/.exec(cls || '');
  return match ? match[0] : null;
}

function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function locate(items, spec) {
  if (spec.css) return { selector: spec.css, source: 'podany wprost' };

  if (spec.headingText) {
    const wanted = normalize(spec.headingText);
    for (const item of items) {
      if (!/^h[1-6]$/.test(item.tag)) continue;
      if (normalize(item.text) !== wanted) continue;
      let node = item;
      let hops = spec.up ?? 1;
      while (hops > 0 && node.parent) {
        node = node.parent;
        hops -= 1;
      }
      while (node && !builderClass(node.cls)) node = node.parent;
      const cls = node && builderClass(node.cls);
      if (cls) return { selector: `.${cls}`, source: `nagłówek „${wanted}”` };
    }
    return null;
  }

  if (spec.linkText) {
    const wanted = normalize(spec.linkText);
    for (const item of items) {
      if (item.tag !== 'a') continue;
      if (normalize(item.text) !== wanted) continue;
      const cls = builderClass(item.cls);
      if (cls) return { selector: `.${cls}`, source: `odnośnik „${wanted}”` };
    }
    return null;
  }

  if (typeof spec.sectionIndex === 'number') {
    // liczymy wyłącznie sekcje treści — pasy nagłówka i stopki pochodzą
    // z szablonów globalnych i mają własną numerację
    const inMain = (node) => {
      let current = node.parent;
      while (current) {
        if (current.tag === 'main') return true;
        if (current.tag === 'header' || current.tag === 'footer') return false;
        current = current.parent;
      }
      return false;
    };
    const contentSections = items.filter(
      (item) => item.tag === 'section' && builderClass(item.cls) && inMain(item)
    );
    const sections = contentSections.length
      ? contentSections
      : items.filter((item) => item.tag === 'section' && builderClass(item.cls));
    const found = sections[spec.sectionIndex];
    if (found) {
      return { selector: `.${builderClass(found.cls)}`, source: `sekcja #${spec.sectionIndex}` };
    }
    return null;
  }

  return null;
}

function renderDeclarations(declarations, important) {
  return Object.entries(declarations)
    .map(([property, value]) => `  ${property}: ${value}${important ? ' !important' : ''};`)
    .join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url || !args.plan || !args.out) {
    console.error('Wymagane: --url <adres> --plan <plan.json> --out <arkusz.css>');
    process.exit(2);
  }

  const plan = JSON.parse(await readFile(args.plan, 'utf8'));
  const response = await fetch(args.url);
  if (!response.ok) {
    console.error(`Strona nie odpowiada: HTTP ${response.status}`);
    process.exit(2);
  }
  const items = parseDom(await response.text());

  const lines = [
    '/*',
    ' * Arkusz uzupełniający dla residuów kontraktu Monteby.',
    ' * Plik generowany przez emit-child-theme-css.mjs — nie edytować ręcznie.',
    ' * Selektory pochodzą z klas renderera i tracą ważność po zmianie propsów:',
    ' * po każdym zapisie layoutu uruchom generator ponownie.',
    ' */',
    '',
  ];

  const missing = [];
  let emitted = 0;

  for (const rule of plan.rules || []) {
    const target = locate(items, rule.locate || {});
    if (!target) {
      missing.push(rule);
      continue;
    }
    const state = rule.state ? `:${rule.state}` : '';
    const pseudo = rule.pseudo || '';
    if (rule.comment) lines.push(`/* ${rule.comment} — ${target.source} */`);
    lines.push(`${target.selector}${state}${pseudo} {`);
    lines.push(renderDeclarations(rule.declarations || {}, rule.important));
    lines.push('}', '');
    emitted += 1;
  }

  await writeFile(args.out, lines.join('\n'), 'utf8');

  console.log(`Reguł w planie: ${(plan.rules || []).length} | zapisanych: ${emitted}`);
  if (missing.length) {
    console.log(`Nieodnalezione węzły: ${missing.length}`);
    for (const rule of missing.slice(0, 10)) {
      console.log(`  ${JSON.stringify(rule.locate)} — ${rule.comment || 'bez opisu'}`);
    }
    console.log('  Sprawdź, czy strona jest zapisana i czy tekst/pozycja się zgadzają.');
  }
  console.log(`Arkusz: ${args.out}`);
  process.exit(missing.length ? 1 : 0);
}

main();
