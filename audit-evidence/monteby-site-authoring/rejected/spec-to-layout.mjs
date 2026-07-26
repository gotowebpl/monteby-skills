#!/usr/bin/env node
/**
 * spec-to-layout.mjs
 *
 * Deterministyczny kompilator: specyfikacja z `extract-reference-spec.mjs`
 * → node mapa Monteby przez `layout-kit.mjs`.
 *
 * To jest tor mechaniczny: każda reguła mapowania jest funkcją zmierzonych
 * wartości, nie oceny. Wszystko, czego kompilator nie umie odwzorować,
 * trafia do raportu z powodem i adresatem — nic nie ginie po cichu.
 *
 * Użycie:
 *   node spec-to-layout.mjs --contract contract.json --spec spec.json \
 *     --out layout.json [--report report.json]
 *
 * Wyjście: layout gotowy do normalize-layout.js → /validate → PUT,
 * plus raport residuów/decyzji do przejrzenia.
 */

'use strict';

import { readFile, writeFile } from 'node:fs/promises';
import { Kit } from './layout-kit.mjs';

// ---------------------------------------------------------------- narzędzia

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

/** rgb()/rgba() → #hex lub rgba — jednolity zapis kolorów. */
function color(value) {
  if (typeof value !== 'string') return value;
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value.trim());
  if (!match) return value;
  const [, r, g, b, a] = match;
  if (a !== undefined && Number(a) < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const px = (n) => `${Math.round(n)}px`;

/** Kolumny siatki z policzonego stylu → token kontraktu. */
function gridToken(template, report, path) {
  const widths = String(template)
    .split(' ')
    .map((part) => parseFloat(part))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!widths.length) return null;
  const count = widths.length;
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  const equal = (max - min) / max < 0.03;

  if (equal) {
    const tokens = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 6: 'six' };
    if (tokens[count]) return { token: tokens[count] };
    if (count === 5) return { flexEqual: 5 };
    report.push({ path, issue: `siatka ${count} równych kolumn bez tokenu — użyto flex z flexBasis`, target: 'compiler-fallback' });
    return { flexEqual: count };
  }
  if (count === 2) {
    const percent = Math.min(90, Math.max(10, Math.round((widths[0] / (widths[0] + widths[1])) * 100)));
    return { token: 'two-proportional', percent };
  }
  report.push({ path, issue: `nierówna siatka ${count} kolumn (${widths.map(Math.round).join('/')}) — brak tokenu`, target: 'widget-development' });
  return { flexEqual: count };
}

/** Deterministyczne warianty responsywne dla tokenów siatki. */
const RESPONSIVE_GRID = {
  six: { tablet: 'three', mobile: 'one' },
  four: { tablet: 'two', mobile: 'one' },
  three: { tablet: 'two', mobile: 'one' },
  two: { tablet: 'one', mobile: 'one' },
  'two-proportional': { tablet: 'one', mobile: 'one' },
};

/**
 * Policzony background-image → propsy tła.
 * Obsługuje: url(...), linear-gradient(2 stopnie), radial+linear (akcent).
 */
function backgroundProps(style, report, path, mediaToReplace) {
  const out = {};
  if (style.background) out.background = color(style.background);
  const image = style.backgroundImage;
  if (!image) return out;

  const layers = image.split(/\)\s*,\s*(?=(?:url|linear-gradient|radial-gradient))/).map((layer, i, all) => (i < all.length - 1 ? `${layer})` : layer));

  const urls = layers.filter((l) => l.startsWith('url'));
  const linears = layers.filter((l) => l.startsWith('linear-gradient'));
  const radials = layers.filter((l) => l.startsWith('radial-gradient'));

  if (urls.length) {
    const src = /url\("?([^")]+)"?\)/.exec(urls[0])?.[1];
    if (src) {
      out.backgroundType = 'image';
      out.backgroundImage = src;
      mediaToReplace.push({ path, src, note: 'obraz tła z makiety — podmień na medium z biblioteki serwisu' });
      if (urls.length > 1 || linears.length || radials.length) {
        report.push({ path, issue: 'wiele warstw tła z obrazem — kontrakt niesie jedną; nadmiar do arkusza', target: 'child-theme' });
      }
      return out;
    }
  }

  if (linears.length === 1) {
    const inner = linears[0].slice('linear-gradient('.length, -1);
    const angleMatch = /^\s*(-?[\d.]+)deg\s*,/.exec(inner);
    const rest = angleMatch ? inner.slice(angleMatch[0].length) : inner;
    const stops = rest.split(/,(?![^(]*\))/).map((s) => s.trim());
    if (stops.length === 2) {
      out.backgroundType = 'gradient';
      out.gradientType = 'linear';
      out.gradientAngle = angleMatch ? Math.round(parseFloat(angleMatch[1])) : 180;
      out.gradientColor1 = color(stops[0].replace(/\s+\d+%$/, ''));
      out.gradientColor2 = color(stops[1].replace(/\s+\d+%$/, ''));
    } else {
      report.push({ path, issue: `gradient o ${stops.length} stopniach — kontrakt niesie dwa`, target: 'child-theme' });
    }
  } else if (linears.length > 1) {
    report.push({ path, issue: 'wiele gradientów liniowych — kontrakt niesie jeden', target: 'child-theme' });
  }

  if (radials.length === 1 && out.backgroundType === 'gradient') {
    const inner = radials[0].slice('radial-gradient('.length, -1);
    const at = /at\s+([\d.]+%?)\s+([\d.]+%?)/.exec(inner);
    const stops = inner.replace(/^[^,]*,/, '').split(/,(?![^(]*\))/).map((s) => s.trim());
    if (stops.length >= 2) {
      out.backgroundAccentType = 'radial';
      out.backgroundAccentColor1 = color(stops[0].replace(/\s+[\d.]+%$/, ''));
      const last = stops[stops.length - 1];
      const size = /([\d.]+%)$/.exec(last);
      out.backgroundAccentColor2 = color(last.replace(/\s+[\d.]+%$/, ''));
      if (size) out.backgroundAccentSize = size[1];
      if (at) {
        out.backgroundAccentPositionX = at[1];
        out.backgroundAccentPositionY = at[2];
      }
    }
  } else if (radials.length) {
    report.push({ path, issue: 'gradient radialny bez bazy liniowej lub mnogi — poza kontraktem', target: 'child-theme' });
  }

  return out;
}

/** Wspólne propsy pudełka z policzonych stylów. */
function boxProps(style, report, path, mediaToReplace) {
  const props = { ...backgroundProps(style, report, path, mediaToReplace) };

  if (style.padding) {
    const [t, r, b, l] = style.padding;
    if (t) props.paddingTop = px(t);
    if (b) props.paddingBottom = px(b);
    if (l) props.paddingLeft = px(l);
    if (r) props.paddingRight = px(r);
  }
  if (style.margin) {
    const [t, , b] = style.margin;
    if (t > 0) props.marginTop = px(t);
    if (b > 0) props.marginBottom = px(b);
  }
  if (style.display === 'flex') {
    props.layoutDisplay = 'flex';
    props.flexDirection = style.flexDirection || 'row';
    if (style.flexWrap === 'wrap') props.flexWrap = 'wrap';
    if (style.justifyContent) props.justifyContent = style.justifyContent;
    if (style.alignItems) props.alignItems = style.alignItems;
  }
  if (style.gap) {
    props.gap = px(style.gap[0]);
    if (style.gap.length > 1 && Math.abs(style.gap[0] - style.gap[1]) > 1) {
      report.push({ path, issue: `gap dwuwartościowy ${style.gap.join('/')}px — kontrolka niesie jedną wartość, użyto pierwszej`, target: 'widget-development' });
    }
  }
  if (style.borderWidth) {
    const [t, r, b, l] = style.borderWidth;
    if (t === r && r === b && b === l) {
      props.borderWidth = px(t);
      props.borderColor = color(style.borderColor);
    } else {
      if (t) { props.borderTopWidth = px(t); props.borderTopColor = color(style.borderColor); }
      if (b) { props.borderBottomWidth = px(b); props.borderBottomColor = color(style.borderColor); }
      if (l) { props.borderLeftWidth = px(l); props.borderLeftColor = color(style.borderColor); }
      if (r) { props.borderRightWidth = px(r); props.borderRightColor = color(style.borderColor); }
    }
  }
  if (style.borderRadius) props.borderRadius = px(style.borderRadius);
  if (style.minHeight) props.minHeight = px(style.minHeight);
  if (style.overflow === 'hidden') props.overflow = 'hidden';
  if (style.flexGrow) props.flexGrow = Math.round(style.flexGrow);
  if (style.flexShrink === 0) props.flexShrink = 0;
  if (style.flexBasis && /[\d.]+(px|%)/.test(style.flexBasis)) props.flexBasis = style.flexBasis;
  if (style.position) {
    report.push({ path, issue: `position: ${style.position} — poza kontraktem`, target: style.position === 'sticky' ? 'child-theme' : 'rebuild-as-node' });
  }
  if (style.boxShadow) {
    report.push({ path, issue: 'boxShadow z makiety — przenieś ręcznie na kontrolki boxShadow*', target: 'manual-controls' });
  }
  return props;
}

function typographyProps(t, style) {
  const props = {
    fontSize: px(t.fontSize),
    fontWeight: String(t.fontWeight),
    textColor: color(t.color),
    fontFamily: `${t.fontFamily}, sans-serif`,
  };
  if (t.lineHeight) props.lineHeight = String(t.lineHeight);
  if (t.letterSpacing) props.letterSpacing = t.letterSpacing;
  if (t.textTransform) props.textTransform = t.textTransform;
  if (t.textAlign && t.textAlign !== 'justify') props.textAlign = t.textAlign;
  if (style?.margin) {
    const [top, , bottom] = style.margin;
    if (top > 0) props.marginTop = px(top);
    props.marginBottom = px(Math.max(0, bottom));
  } else {
    props.marginBottom = '0px';
  }
  return props;
}

// ---------------------------------------------------------------- kompilacja

class Compiler {
  constructor(kit, spec) {
    this.fit = (component, props, path) => {
      const allowed = new Set(kit.components.get(component)?.props || []);
      const out = {};
      for (const [key, value] of Object.entries(props)) {
        if (allowed.has(key)) out[key] = value;
        else this.report.push({ path, issue: `${component} nie ma propa ${key} (wartość ${JSON.stringify(value)}) — pominięto`, target: 'dropped-prop' });
      }
      return out;
    };
    this.kit = kit;
    this.spec = spec;
    this.report = [];
    this.mediaToReplace = [];
    this.fvsSeen = new Set();
  }

  node(specNode, path) {
    const { role } = specNode;
    if (specNode.typography?.fontVariationSettings) this.fvsSeen.add(specNode.typography.fontVariationSettings);

    // kontrakt serwisu może nie zawierać danego widgetu — degradujemy z raportem
    const NEEDS = { heading: 'Heading', text: 'Text', button: 'ButtonBlock', link: 'ButtonBlock', image: 'ImageBlock', list: 'ListBlock', form: 'FormBlock' };
    const needed = NEEDS[role];
    if (needed && !this.kit.components.has(needed)) {
      this.report.push({ path, issue: `kontrakt nie zawiera ${needed} — zastępczo Text/Container`, target: 'contract-gap' });
      const fallbackText = specNode.text || (specNode.items || []).map((i) => i.text).join(' · ');
      if (fallbackText && this.kit.components.has('Text')) {
        return this.kit.text(fallbackText, this.fit('Text', typographyProps(specNode.typography || { fontSize: 16, fontWeight: '400', fontFamily: 'sans-serif', color: '#000000' }, specNode.style), path));
      }
      return this.kit.box(this.fit('Container', { minHeight: px(specNode.style?.rect?.h || 40) }, path));
    }

    switch (role) {
      case 'heading':
        return this.kit.heading(
          specNode.text,
          this.fit('Heading', { tag: specNode.tag, ...typographyProps(specNode.typography, specNode.style) }, path)
        );
      case 'text':
        return this.kit.text(
          specNode.text,
          this.fit('Text', typographyProps(specNode.typography, specNode.style), path)
        );
      case 'button':
      case 'link': {
        const t = specNode.typography;
        const style = specNode.style;
        const props = {
          fontSize: px(t.fontSize),
          fontWeight: String(t.fontWeight),
          fontFamily: `${t.fontFamily}, sans-serif`,
          textColor: color(t.color),
          backgroundColor: style.background ? color(style.background) : 'transparent',
          borderRadius: px(style.borderRadius || 0),
        };
        if (t.letterSpacing) props.letterSpacing = t.letterSpacing;
        if (t.textTransform) props.textTransform = t.textTransform;
        if (style.padding) {
          const [pt, pr, pb, pl] = style.padding;
          props.paddingTop = px(pt);
          props.paddingBottom = px(pb);
          props.paddingLeft = px(pl);
          props.paddingRight = px(pr);
        } else {
          props.paddingTop = '0px';
          props.paddingBottom = '0px';
          props.paddingLeft = '0px';
          props.paddingRight = '0px';
        }
        if (style.borderWidth) {
          props.borderWidth = px(style.borderWidth[0]);
          props.borderColor = color(style.borderColor);
        }
        return this.kit.button(specNode.text, specNode.href || '#', this.fit('ButtonBlock', props, path));
      }
      case 'image': {
        this.mediaToReplace.push({ path, src: specNode.src, note: 'obraz z makiety — wgraj do biblioteki serwisu i podmień URL' });
        return this.kit.image(specNode.src, this.fit('ImageBlock', {
          alt: specNode.alt,
          width: '100%',
          height: px(specNode.style.rect.h),
          objectFit: specNode.objectFit === 'cover' ? 'cover' : 'contain',
        }, path));
      }
      case 'asset': {
        this.report.push({ path, issue: 'SVG w makiecie — wyeksportuj do PNG/WebP, wgraj i użyj ImageBlock', target: 'media' });
        return this.kit.box(this.fit('Container', { minHeight: px(specNode.style.rect.h) }, path));
      }
      case 'list': {
        const withLinks = specNode.items.filter((i) => i.href);
        if (withLinks.length) {
          return this.kit.box(
            { layoutDisplay: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' },
            specNode.items.map((item) =>
              this.kit.button(item.text, item.href || '#', {
                backgroundColor: 'transparent',
                textColor: color(specNode.typography.color),
                fontSize: px(specNode.typography.fontSize),
                fontWeight: String(specNode.typography.fontWeight),
                fontFamily: `${specNode.typography.fontFamily}, sans-serif`,
                paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px',
              })
            )
          );
        }
        return this.kit.node('ListBlock', this.fit('ListBlock', {
          items: specNode.items.map((i) => i.text),
          listStyleType: 'none',
          paddingLeft: '0px',
          fontSize: px(specNode.typography.fontSize),
          textColor: color(specNode.typography.color),
          fontFamily: `${specNode.typography.fontFamily}, sans-serif`,
        }, path));
      }
      case 'form':
        return this.form(specNode, path);
      case 'box':
      default:
        return this.box(specNode, path);
    }
  }

  form(specNode, path) {
    const KIND_MAP = { text: 'text', email: 'email', tel: 'tel', textarea: 'textarea', select: 'select', checkbox: 'checkbox' };
    const fields = [];
    for (const field of specNode.fields || []) {
      const type = KIND_MAP[field.kind];
      if (!type) {
        this.report.push({ path, issue: `pole formularza typu ${field.kind} — poza typami FormBlock`, target: 'widget-development' });
        continue;
      }
      const out = { type, name: field.name || field.label.toLowerCase().replace(/\W+/g, '-'), label: field.label, placeholder: field.placeholder, required: field.required, columnSpan: 1 };
      if (type === 'select' && field.options) out.options = field.options.join('\n');
      if (type === 'textarea') out.rows = 4;
      fields.push(out);
    }
    if (!fields.some((f) => f.type === 'checkbox')) {
      // Treści prawnej nie wolno wymyślać: zgoda wymaga zatwierdzonego tekstu
      // (administrator, cel, adres polityki) od użytkownika/projektu.
      this.report.push({
        path,
        issue: 'formularz bez zgody na przetwarzanie danych — wymagana zatwierdzona treść zgody i adres polityki; do czasu ich dostarczenia werdykt formularza: blocked_legal_copy',
        target: 'legal',
      });
    }
    this.report.push({ path, issue: 'style formularza (kolory pól, etykiety) dopasuj kontrolkami FormBlock do specyfikacji', target: 'manual-controls' });
    return this.kit.node('FormBlock', this.fit('FormBlock', {
      fields,
      formColumns: 1,
      submitLabel: specNode.submitLabel || 'Wyślij',
      formBackgroundColor: specNode.style?.background ? color(specNode.style.background) : '#ffffff',
    }, path));
  }

  box(specNode, path) {
    const style = specNode.style;
    const props = boxProps(style, this.report, path, this.mediaToReplace);
    const children = (specNode.children || []).map((child, i) => this.node(child, `${path}.${i}`));

    if (style.display === 'grid') {
      const grid = gridToken(style.gridTemplateColumns, this.report, path);
      if (grid?.token) {
        props.layoutDisplay = 'grid';
        props.gridTemplateColumns = grid.token;
        if (grid.percent) props.gridFirstColumnPercent = grid.percent;
        const responsive = RESPONSIVE_GRID[grid.token];
        if (responsive) {
          props.gridTemplateColumnsTablet = responsive.tablet;
          props.gridTemplateColumnsMobile = responsive.mobile;
        }
      } else if (grid?.flexEqual) {
        props.layoutDisplay = 'flex';
        props.flexDirection = 'row';
        props.flexWrap = 'wrap';
        for (const child of children) {
          const node = this.kit.nodes[child];
          node.props.flexBasis = `${Math.floor(100 / grid.flexEqual)}%`;
          node.props.flexGrow = 1;
          node.props.minWidth = '0px';
        }
      }
    }
    return this.kit.box(this.fit('Container', props, path), children);
  }

  section(specNode, index) {
    const path = `s${index}`;
    const style = specNode.style;
    const props = boxProps(style, this.report, path, this.mediaToReplace);
    delete props.flexGrow;
    delete props.flexShrink;
    delete props.flexBasis;

    let children = specNode.children || [];

    // wykrycie kolumny treści: jedyne dziecko węższe od sekcji → innerMaxWidth
    if (children.length === 1 && children[0].role === 'box') {
      const wrap = children[0];
      const sectionWidth = style.rect.w;
      const wrapWidth = wrap.style.rect.w;
      if (wrapWidth < sectionWidth - 40) {
        props.innerMaxWidth = px(wrap.style.maxWidth || wrapWidth);
        if (wrap.style.padding) {
          const [wrapTop, r, wrapBottom, l] = wrap.style.padding;
          if (l || r) {
            props.innerPaddingX = px(Math.max(l, r));
            props.innerPaddingXTablet = '40px';
            props.innerPaddingXMobile = '20px';
          }
          // pionowe paddingi wrappera sumują się z paddingiem sekcji
          const sectionTop = style.padding ? style.padding[0] : 0;
          const sectionBottom = style.padding ? style.padding[2] : 0;
          if (wrapTop) props.paddingTop = px(sectionTop + wrapTop);
          if (wrapBottom) props.paddingBottom = px(sectionBottom + wrapBottom);
        }
        // układ wrappera przechodzi na sekcję
        const inner = boxProps(wrap.style, this.report, path, this.mediaToReplace);
        for (const key of ['layoutDisplay', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap']) {
          if (inner[key] !== undefined) props[key] = inner[key];
        }
        if (wrap.style.display === 'grid') {
          const grid = gridToken(wrap.style.gridTemplateColumns, this.report, path);
          if (grid?.token) {
            props.layoutDisplay = 'grid';
            props.gridTemplateColumns = grid.token;
            if (grid.percent) props.gridFirstColumnPercent = grid.percent;
            const responsive = RESPONSIVE_GRID[grid.token];
            if (responsive) {
              props.gridTemplateColumnsTablet = responsive.tablet;
              props.gridTemplateColumnsMobile = responsive.mobile;
            }
          }
        }
        children = wrap.children || [];
      }
    }

    const childIds = children.map((child, i) => this.node(child, `${path}.${i}`));
    return this.kit.section(this.fit('Section', props, path), childIds);
  }

  run() {
    const sections = this.spec.sections.map((section, i) => this.section(section, i));
    if (this.fvsSeen.size) {
      this.report.push({
        path: '(typografia)',
        issue: `makieta używa font-variation-settings: ${[...this.fvsSeen].join('; ')} — oś do zapytania o font + arkusz motywu potomnego`,
        target: 'child-theme',
      });
    }
    return sections;
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  if (!args.contract || !args.spec || !args.out) {
    console.error('Wymagane: --contract <plik> --spec <plik> --out <layout.json> [--report <plik>]');
    process.exit(2);
  }

  const spec = JSON.parse(await readFile(args.spec, 'utf8'));
  if (spec.kind !== 'monteby-reference-spec') {
    console.error('To nie jest specyfikacja z extract-reference-spec.mjs (brak kind).');
    process.exit(2);
  }

  const kit = await Kit.fromContract(args.contract);
  const compiler = new Compiler(kit, spec);
  const sections = compiler.run();
  const result = await kit.write(args.out, sections);

  const report = {
    sections: spec.sections.length,
    nodes: result.nodes,
    kitNotes: result.notes,
    issues: compiler.report,
    mediaToReplace: compiler.mediaToReplace,
  };
  if (args.report && typeof args.report === 'string') {
    await writeFile(args.report, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(`Sekcje: ${report.sections} | węzły: ${report.nodes}`);
  console.log(`Media do podmiany: ${report.mediaToReplace.length} | kwestie: ${report.issues.length}`);
  for (const issue of compiler.report.slice(0, 25)) {
    console.log(`  [${issue.target}] ${issue.path}: ${issue.issue}`);
  }
  if (args.report) console.log(`Raport: ${args.report}`);
}

main();
