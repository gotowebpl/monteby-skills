#!/usr/bin/env node
/**
 * audit-reference-css.mjs
 *
 * Czyta arkusz makiety i dzieli każdą deklarację na trzy koszyki:
 *
 *   contract  — jest odpowiadający prop w kontrakcie, autoruj propsem
 *   residual  — kontrakt tego nie wyraża, trafia do arkusza motywu potomnego
 *   ignore    — nie wpływa na wynik wizualny (reset, box-sizing, itp.)
 *
 * Dzięki temu braki są znane przed autorowaniem, a nie odkrywane po zrzutach.
 * Wynik jest wejściem do `emit-child-theme-css.mjs` i do raportu luk.
 *
 * Użycie:
 *   node audit-reference-css.mjs --contract contract.json --css mockup.css [--json] [--out plan.json]
 */

'use strict';

import { readFile, writeFile } from 'node:fs/promises';

/**
 * Właściwość CSS → prop kontraktu. Obecność propa sprawdzamy w żywym kontrakcie,
 * więc tablica opisuje intencję, a nie zamraża wersję Buildera.
 */
const PROPERTY_TO_PROP = {
  'background-color': ['background', 'backgroundColor', 'cellBg'],
  background: ['background', 'backgroundType'],
  'background-image': ['backgroundImage'],
  'background-size': ['backgroundSize'],
  'background-position': ['backgroundPosition'],
  'background-repeat': ['backgroundRepeat'],
  'background-attachment': ['backgroundAttachment'],
  color: ['textColor', 'color', 'linkColor'],
  'font-size': ['fontSize', 'textFontSize', 'labelFontSize', 'valueFontSize', 'linkFontSize'],
  'font-weight': ['fontWeight', 'textFontWeight', 'labelFontWeight'],
  'font-family': ['fontFamily'],
  'line-height': ['lineHeight', 'valueLineHeight'],
  'letter-spacing': ['letterSpacing', 'textLetterSpacing', 'labelLetterSpacing'],
  'text-transform': ['textTransform', 'textTextTransform', 'labelTextTransform'],
  'text-decoration': ['textDecoration'],
  'text-align': ['textAlign'],
  'padding-top': ['paddingTop', 'rootPaddingTop', 'formPaddingY'],
  'padding-bottom': ['paddingBottom', 'rootPaddingBottom'],
  'padding-left': ['paddingLeft', 'innerPaddingX'],
  'padding-right': ['paddingRight', 'innerPaddingX'],
  padding: ['padding', 'cellPadding'],
  'margin-top': ['marginTop'],
  'margin-bottom': ['marginBottom'],
  'margin-left': ['marginLeft'],
  'margin-right': ['marginRight'],
  display: ['layoutDisplay', 'display', 'buttonDisplay', 'iconDisplay'],
  'flex-direction': ['flexDirection'],
  'flex-wrap': ['flexWrap'],
  'justify-content': ['justifyContent'],
  'align-items': ['alignItems'],
  'flex-grow': ['flexGrow'],
  'flex-shrink': ['flexShrink'],
  'flex-basis': ['flexBasis'],
  gap: ['gap', 'itemGap', 'linkGap', 'formGap', 'fieldGap', 'brandGap'],
  'row-gap': ['gap'],
  'column-gap': ['gap'],
  'grid-template-columns': ['gridTemplateColumns'],
  'grid-column-start': ['gridColumnStart'],
  'grid-row-start': ['gridRowStart'],
  width: ['width', 'rootWidth', 'dividerWidth'],
  'max-width': ['maxWidth', 'innerMaxWidth', 'formMaxWidth'],
  'min-width': ['minWidth'],
  height: ['height', 'minHeight', 'inputHeight'],
  'min-height': ['minHeight', 'buttonMinHeight', 'tabMinHeight'],
  'border-radius': ['borderRadius', 'rootBorderRadius', 'inputBorderRadius'],
  'border-width': ['borderWidth', 'inputBorderWidth', 'formBorderWidth'],
  'border-color': ['borderColor', 'inputBorderColor', 'itemBorderColor'],
  'border-top-width': ['borderTopWidth'],
  'border-right-width': ['borderRightWidth'],
  'border-bottom-width': ['borderBottomWidth'],
  'border-left-width': ['borderLeftWidth'],
  'border-top-color': ['borderTopColor'],
  'border-bottom-color': ['borderBottomColor'],
  'box-shadow': ['boxShadow'],
  'backdrop-filter': ['backdropBlur'],
  overflow: ['overflow', 'rootOverflow'],
  'object-fit': ['objectFit'],
  'object-position': ['objectPosition'],
  'aspect-ratio': ['aspectRatio'],
  'list-style-type': ['listStyleType'],
  'list-style-position': ['listStylePosition'],
};

/** Deklaracje bez wpływu na odtworzenie wyglądu. */
const IGNORABLE = new Set([
  'box-sizing',
  'appearance',
  '-webkit-font-smoothing',
  '-webkit-text-size-adjust',
  'font-feature-settings',
  'text-wrap',
  'cursor',
  'pointer-events',
  'content',
  'scroll-behavior',
  'outline-offset',
  'list-style',
  'border-style',
]);

/**
 * Właściwości, których kontrakt nie ma i mieć nie powinien — to zawsze residuum.
 * Wartość opisuje, co z tym zrobić.
 */
const KNOWN_RESIDUAL = {
  'font-variation-settings': 'oś fontu zmiennego — arkusz motywu potomnego + oś w zapytaniu o font',
  'font-stretch': 'oś szerokości fontu — jak wyżej',
  position: 'fixed/absolute — przebuduj strukturę; sticky używa typed props, gdy wystawia je żywy kontrakt',
  'z-index': 'kolejność warstw — użyj paintLayer, w ostateczności arkusz',
  transition: 'czas przejścia stanu — arkusz (kontrakt nie wystawia stanów)',
  animation: 'animacja własna — arkusz lub dedykowany widget',
  transform: 'przekształcenie — prop zablokowany w kontrakcie',
  filter: 'filtr graficzny — arkusz',
  'mask-image': 'maska warstwy tła — arkusz',
  '-webkit-mask-image': 'maska warstwy tła — arkusz',
  'mix-blend-mode': 'tryb mieszania — arkusz',
  'text-shadow': 'cień tekstu — arkusz',
  'grid-template-areas': 'nazwane obszary siatki — przebuduj na kolumny/wiersze',
  'writing-mode': 'kierunek pisma — arkusz',
};

/** Skróty CSS rozwijane na longhandy, które kontrakt zna. */
const SHORTHANDS = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'margin-inline': ['margin-left', 'margin-right'],
  'margin-block': ['margin-top', 'margin-bottom'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'padding-inline': ['padding-left', 'padding-right'],
  'padding-block': ['padding-top', 'padding-bottom'],
  border: ['border-width', 'border-color'],
  'border-top': ['border-top-width', 'border-top-color'],
  'border-right': ['border-right-width', 'border-right-color'],
  'border-bottom': ['border-bottom-width', 'border-bottom-color'],
  'border-left': ['border-left-width', 'border-left-color'],
  inset: ['position'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  font: ['font-size', 'font-family', 'font-weight'],
};

/** Właściwości, które w kontrakcie odpowiadają układowi rodzica, nie własnemu propowi. */
const PARENT_DRIVEN = new Set(['order', 'justify-self', 'align-self', 'place-self']);

/**
 * Zamienia var(--x) na wartość z :root, żeby zmienne nie trafiały do residuów.
 */
function resolveVariables(source) {
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(source.replace(/\/\*[\s\S]*?\*\//g, ''));
  const vars = new Map();
  if (rootBlock) {
    for (const part of rootBlock[1].split(';')) {
      const index = part.indexOf(':');
      if (index < 0) continue;
      const name = part.slice(0, index).trim();
      if (!name.startsWith('--')) continue;
      vars.set(name, part.slice(index + 1).trim());
    }
  }
  let out = source;
  for (let pass = 0; pass < 3; pass += 1) {
    out = out.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^)]*))?\)/gi, (match, name, fallback) => {
      if (vars.has(name)) return vars.get(name);
      return fallback !== undefined ? fallback.trim() : match;
    });
  }
  return { css: out, variables: vars.size };
}

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

/** Minimalny parser: selektory, deklaracje, @media, pseudoklasy. */
function parseCss(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let media = '';
  const mediaPattern = /@media([^{]+)\{([\s\S]*?)\n\}/g;

  // reguły wewnątrz @media
  let mediaMatch;
  while ((mediaMatch = mediaPattern.exec(clean)) !== null) {
    media = mediaMatch[1].trim();
    let inner;
    const innerPattern = /([^{}]+)\{([^{}]*)\}/g;
    while ((inner = innerPattern.exec(mediaMatch[2])) !== null) {
      rules.push({ selector: inner[1].trim(), body: inner[2], media });
    }
  }

  // reguły spoza @media
  const withoutMedia = clean.replace(mediaPattern, '');
  let match;
  while ((match = pattern.exec(withoutMedia)) !== null) {
    const selector = match[1].trim();
    if (selector.startsWith('@')) continue;
    rules.push({ selector, body: match[2], media: '' });
  }

  return rules.map((rule) => ({
    ...rule,
    declarations: rule.body
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf(':');
        if (index < 0) return null;
        return {
          property: part.slice(0, index).trim().toLowerCase(),
          value: part.slice(index + 1).trim(),
        };
      })
      .filter(Boolean),
  }));
}

function contractProps(contract) {
  const set = new Set();
  for (const component of contract.components || []) {
    for (const prop of component.props || []) set.add(prop);
  }
  return set;
}

function classify(rule, declaration, available, blocked) {
  const { property, value } = declaration;
  const isState = /:(hover|focus|active|focus-visible|checked)/.test(rule.selector);
  const isPseudoElement = /::(before|after|placeholder|marker|selection)/.test(rule.selector);
  const isVariable = property.startsWith('--');

  if (isVariable || IGNORABLE.has(property)) {
    return { bucket: 'ignore', reason: 'bez wpływu na odtworzenie' };
  }

  if (isState) {
    const lift = property === 'transform' && /:hover\b/u.test(rule.selector)
      ? /^translateY\(\s*(-(?:\d+(?:\.\d+)?|\.\d+))px\s*\)$/iu.exec(value)
      : null;
    if (lift && Number(lift[1]) >= -24) {
      const hoverProp = ['hoverLift', 'hoverTranslateY']
        .find((prop) => available.has(prop) && !blocked.has(prop));
      if (hoverProp) {
        return {
          bucket: 'contract',
          props: [hoverProp],
          reason: 'bezpieczny hover lift ma typed prop w żywym kontrakcie',
        };
      }
    }
    return {
      bucket: 'residual',
      reason: 'stan wskazania/fokusu — kontrakt blokuje propsy hover/active',
      target: 'child-theme',
    };
  }

  if (isPseudoElement) {
    const decorative = /^(width|height|background|background-color|border-radius|flex|inset|top|left|right|bottom|opacity)$/.test(
      property
    );
    return {
      bucket: 'residual',
      reason: decorative
        ? 'pseudoelement dekoracyjny — odtwórz zwykłym Containerem o zmierzonych wymiarach'
        : 'pseudoelement — brak węzła do zaadresowania propsem',
      target: decorative ? 'rebuild-as-node' : 'child-theme',
    };
  }

  if (PARENT_DRIVEN.has(property)) {
    return {
      bucket: 'residual',
      reason: 'kolejność/wyrównanie pojedynczego dziecka — ustaw kolejnością węzłów w rodzicu',
      target: 'rebuild-as-node',
    };
  }

  if (property === 'position' && value.trim().toLowerCase() === 'sticky') {
    const usable = ['sticky'].filter((prop) => available.has(prop) && !blocked.has(prop));
    if (usable.length > 0) {
      return { bucket: 'contract', props: usable };
    }
  }

  if (
    property === 'top'
    && rule.declarations.some((item) => item.property === 'position' && item.value.trim().toLowerCase() === 'sticky')
  ) {
    const usable = ['stickyTop'].filter((prop) => available.has(prop) && !blocked.has(prop));
    if (usable.length > 0) {
      return { bucket: 'contract', props: usable };
    }
  }

  if (KNOWN_RESIDUAL[property]) {
    return { bucket: 'residual', reason: KNOWN_RESIDUAL[property], target: 'child-theme' };
  }

  const candidates = PROPERTY_TO_PROP[property];
  if (!candidates) {
    return {
      bucket: 'residual',
      reason: 'brak mapowania na prop — sprawdź kontrakt, w razie braku arkusz',
      target: 'unknown',
    };
  }

  const usable = candidates.filter((prop) => available.has(prop) && !blocked.has(prop));
  if (!usable.length) {
    return {
      bucket: 'residual',
      reason: `prop ${candidates.join('/')} nieobecny w kontrakcie`,
      target: 'widget-development',
    };
  }

  // wartości, których kontrolka nie przyjmie mimo istnienia propa
  if (/\b(calc|clamp|min|max)\(/.test(value)) {
    return {
      bucket: 'residual',
      reason: 'wartość wyliczana — wstaw liczbę odczytaną z pomiaru przy docelowej szerokości',
      target: 'resolve-measured',
      props: usable,
    };
  }
  if (/\bvar\(/.test(value)) {
    return {
      bucket: 'residual',
      reason: 'nierozwiązana zmienna CSS — brak definicji w :root arkusza',
      target: 'resolve-measured',
      props: usable,
    };
  }
  if (property === 'gap' && /\S\s+\S/.test(value)) {
    return {
      bucket: 'residual',
      reason: 'gap dwuwartościowy — kontrolka przyjmuje jedną wartość',
      target: 'split-or-widget-development',
      props: usable,
    };
  }
  if (/^background$/.test(property) && (value.match(/gradient\(/g) || []).length > 1) {
    return {
      bucket: 'residual',
      reason: 'więcej niż dwie warstwy tła — kontrakt składa gradient + jeden akcent radialny',
      target: 'child-theme',
      props: usable,
    };
  }

  return { bucket: 'contract', props: usable };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.contract || !args.css) {
    console.error('Wymagane: --contract <plik> --css <plik> [--out plan.json] [--json]');
    process.exit(2);
  }

  const contract = JSON.parse(await readFile(args.contract, 'utf8'));
  const css = await readFile(args.css, 'utf8');
  const available = contractProps(contract);
  const blocked = new Set(contract.authoring?.blockedProps || []);

  const resolved = resolveVariables(css);
  const rules = parseCss(resolved.css);
  const summary = { contract: 0, residual: 0, ignore: 0 };
  const residual = [];

  for (const rule of rules) {
    for (const declaration of rule.declarations) {
      // skrót traktujemy jako wyrażalny, gdy kontrakt zna wszystkie jego longhandy
      const expansion = SHORTHANDS[declaration.property];
      if (expansion) {
        const covered = expansion.every((long) =>
          (PROPERTY_TO_PROP[long] || []).some((prop) => available.has(prop) && !blocked.has(prop))
        );
        if (covered) {
          summary.contract += 1;
          continue;
        }
      }
      const verdict = classify(rule, declaration, available, blocked);
      summary[verdict.bucket] += 1;
      if (verdict.bucket === 'residual') {
        residual.push({
          selector: rule.selector,
          media: rule.media || undefined,
          property: declaration.property,
          value: declaration.value,
          reason: verdict.reason,
          target: verdict.target,
        });
      }
    }
  }

  const byTarget = residual.reduce((acc, item) => {
    const key = item.target || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const plan = {
    rules: rules.length,
    declarations: summary.contract + summary.residual + summary.ignore,
    summary,
    byTarget,
    residual,
  };

  if (args.out && typeof args.out === 'string') {
    await writeFile(args.out, JSON.stringify(plan, null, 2), 'utf8');
  }

  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(`Reguł: ${plan.rules} | deklaracji: ${plan.declarations} | zmiennych :root: ${resolved.variables}`);
  console.log(
    `Do propsów: ${summary.contract} | do arkusza/produktu: ${summary.residual} | pominięte: ${summary.ignore}\n`
  );
  console.log('Residua wg adresata:');
  for (const [target, count] of Object.entries(byTarget)) {
    console.log(`  ${target}: ${count}`);
  }

  const grouped = new Map();
  for (const item of residual) {
    const key = `${item.property} — ${item.reason}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item.selector);
  }
  console.log('\nSzczegóły:');
  for (const [key, selectors] of [...grouped.entries()].slice(0, 30)) {
    const unique = [...new Set(selectors)];
    console.log(`  ${key}`);
    console.log(`     ${unique.slice(0, 4).join(', ')}${unique.length > 4 ? ` (+${unique.length - 4})` : ''}`);
  }
  if (args.out) console.log(`\nPlan zapisany: ${args.out}`);
}

main();
