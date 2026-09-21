#!/usr/bin/env node
/**
 * normalize-layout.js
 *
 * Local pre-flight for a Monteby node map. Catches — and optionally repairs —
 * the value-shape and renderer traps that either make `POST /validate` fail one
 * error at a time, or pass validation and only show up in the rendered page.
 *
 * Usage:
 *   node normalize-layout.js --contract contract.json --layout layout.json [--fix out.json] [--json]
 *
 * Checks, in order:
 *   1. unknown component / unknown prop / blocked prop / illegal parent
 *   2. control-shape normalization: step, min, max, options, number-vs-string
 *   3. renderer traps that validation does not report (see references/html-to-monteby.md)
 *
 * Exit code is 1 when unrepairable errors remain, otherwise 0.
 */

'use strict';

const fs = require('fs');
const {
  buildResolvedDesignProfile,
  effectiveTypographyValue,
  globalStyleLiteralMatch,
} = require('./resolved-design-profile');
const {
  buildControlIndex,
  normalizeControlValue,
  publishedControlReferences,
} = require('./control-contract');
const { auditMotionLayout } = require('./motion-contract');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(path, label) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Nie można wczytać ${label} (${path}): ${error.message}`);
    process.exit(2);
  }
  return null;
}

/**
 * Bring one value into the shape the control accepts.
 * Returns {value, note} — a null value means the prop must be dropped.
 */
function normalizeValue(control, value, publishedReferences = new Set()) {
  const result = normalizeControlValue(control, value, publishedReferences);
  if (!result.accepted) return { value: null, note: result.reason };
  return {
    value: result.value,
    note: result.changed
      ? result.changeReason || `${JSON.stringify(value)} → ${JSON.stringify(result.value)}`
      : undefined,
  };
}

/** Traps that pass /validate but break the rendered page or the editor canvas. */
function rendererTraps(componentName, props, contract, designProfile) {
  const notes = [];
  const allowed = new Set(
    (contract.components || []).find((c) => c.name === componentName)?.props || []
  );

  if (['Heading', 'Text', 'MultilineHeading'].includes(componentName) && !('marginTop' in props)) {
    notes.push({
      level: 'warning',
      fix: { marginTop: '0px' },
      message: 'brak marginTop — motyw dodaje 1em od góry (przy dużym foncie to dziesiątki px)',
    });
  }

  const edges = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];
  if (edges.some((edge) => edge in props) && !('borderWidth' in props) && allowed.has('borderWidth')) {
    notes.push({
      level: 'warning',
      fix: { borderWidth: '0px' },
      message: 'krawędź bez borderWidth — renderer obrysuje całe pudełko domyślną szerokością',
    });
  }

  if (props.backgroundType === 'image' && ('background' in props)) {
    notes.push({
      level: 'warning',
      message: 'backgroundType "image" pomija kolor tła — wbuduj kolor w bitmapę albo użyj gradientu',
    });
  }

  if (componentName === 'ListBlock' && Array.isArray(props.items)) {
    const objects = props.items.filter((item) => item && typeof item === 'object');
    if (objects.length) {
      notes.push({
        level: 'error',
        message:
          'ListBlock.items przyjmuje teksty; obiekt renderuje się na froncie, ale wywraca kanwę edytora (React #31)',
      });
    }
  }

  if (componentName === 'FormBlock' && !('formBackgroundColor' in props)) {
    notes.push({
      level: 'warning',
      message: 'FormBlock bez formBackgroundColor maluje własne białe tło <form>',
    });
  }

  if (componentName === 'ImageBlock' && !('height' in props) && !('aspectRatio' in props)) {
    notes.push({
      level: 'warning',
      message: 'ImageBlock bez height/aspectRatio ma zerową wysokość do czasu wczytania obrazu',
    });
  }

  if (componentName === 'ImageBlock' && 'height' in props
      && (!('heightTablet' in props) || !('heightMobile' in props))) {
    notes.push({
      level: 'warning',
      message: 'ImageBlock z height bez heightTablet/heightMobile — motyw wymusza height:auto poniżej 768px',
    });
  }

  if (['Heading', 'Text', 'MultilineHeading'].includes(componentName) && !effectiveTypographyValue(props, designProfile, 'lineHeight')) {
    notes.push({
      level: 'warning',
      message: 'brak lineHeight — nagłówek/akapit dziedziczy interlinię z motywu (typowo 1.5–1.6)',
    });
  }

  if (['Heading', 'Text', 'MultilineHeading'].includes(componentName) && 'fontSize' in props) {
    const size = parseFloat(props.fontSize);
    if (Number.isFinite(size) && size >= 30
        && (!('fontSizeTablet' in props) || !('fontSizeMobile' in props))) {
      notes.push({
        level: 'warning',
        message: `fontSize ${props.fontSize} bez obu wariantów responsywnych — renderer nakłada clamp() na rozmiary od 30px`,
      });
    }
  }

  return notes;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.contract || !args.layout) {
    console.error('Wymagane: --contract <plik> --layout <plik> [--fix <plik>] [--relink-global-tokens] [--json]');
    process.exit(2);
  }
  if (args['relink-global-tokens'] && !args.fix) {
    console.error('--relink-global-tokens wymaga jawnego pliku wyjściowego --fix <plik>');
    process.exit(2);
  }

  const contract = readJson(args.contract, 'kontrakt');
  const layout = readJson(args.layout, 'layout');
  const nodeMap = layout.nodeMap || layout.layout || layout;

  const components = new Map((contract.components || []).map((c) => [c.name, c]));
  const blocked = new Set(contract.authoring?.blockedProps || []);
  const controls = buildControlIndex(contract);
  const rootComponents = new Set(contract.authoring?.topLevelRootComponents || ['Section']);
  const designProfile = buildResolvedDesignProfile(contract);

  const errors = [];
  const repairs = [];
  const warnings = [];

  for (const [nodeId, node] of Object.entries(nodeMap)) {
    const name = node?.type?.resolvedName;
    if (!name || name === 'RootCanvas') continue;

    const component = components.get(name);
    if (!component) {
      errors.push({ node: nodeId, message: `komponent ${name} spoza kontraktu` });
      continue;
    }

    // placement
    const parentId = node.parent;
    if (parentId === 'ROOT') {
      if (!rootComponents.has(name)) {
        errors.push({ node: nodeId, message: `${name} nie może być dzieckiem ROOT` });
      }
    } else if (parentId && nodeMap[parentId]) {
      const parentName = nodeMap[parentId].type?.resolvedName;
      const allowedParents = component.allowedParents || [];
      if (parentName && allowedParents.length && !allowedParents.includes(parentName)) {
        errors.push({
          node: nodeId,
          message: `${name} niedozwolony w ${parentName} (dozwolone: ${allowedParents.join(', ')})`,
        });
      }
    }

    // props
    const allowed = new Set(component.props || []);
    const props = node.props || {};
    for (const [prop, value] of Object.entries({ ...props })) {
      if (blocked.has(prop)) {
        errors.push({ node: nodeId, prop, message: 'prop zablokowany przez kontrakt' });
        delete props[prop];
        continue;
      }
      if (!allowed.has(prop)) {
        errors.push({ node: nodeId, prop, message: `prop spoza kontraktu dla ${name}` });
        delete props[prop];
        continue;
      }
      const control = controls.get(`${name}.${prop}`);
      const { value: normalized, note } = normalizeValue(
        control || {}, value, publishedControlReferences(contract, name, prop, control),
      );
      if (note) {
        repairs.push({ node: nodeId, prop, message: note, dropped: normalized === null });
      }
      if (normalized === null) {
        delete props[prop];
      } else if (normalized !== value) {
        props[prop] = normalized;
      }

      const effectiveValue = normalized === null ? null : props[prop];
      const globalMatch = globalStyleLiteralMatch(designProfile, name, prop, effectiveValue);
      if (globalMatch) {
        warnings.push({
          node: nodeId,
          component: name,
          prop,
          ...globalMatch,
          message: `${prop} ma literal równy ${globalMatch.token}; możliwe bezpieczne powiązanie ${globalMatch.reference}`,
        });
        if (args['relink-global-tokens'] && args.fix) {
          props[prop] = globalMatch.reference;
          repairs.push({
            node: nodeId,
            prop,
            code: 'global-style-literal-match',
            token: globalMatch.token,
            message: `jawnie powiązano exact match ${globalMatch.literal} → ${globalMatch.reference}`,
            dropped: false,
          });
        }
      }
    }

    for (const trap of rendererTraps(name, props, contract, designProfile)) {
      const entry = { node: nodeId, component: name, message: trap.message };
      if (trap.level === 'error') {
        errors.push(entry);
      } else {
        warnings.push(entry);
        if (trap.fix && args.fix) Object.assign(props, trap.fix);
      }
    }
  }

  const motionAudit = auditMotionLayout(nodeMap, designProfile.motion);
  errors.push(...motionAudit.errors.map((entry) => ({
    node: entry.nodeId || '',
    component: entry.component || '',
    code: entry.code,
    message: entry.message,
  })));

  const report = {
    nodes: Object.keys(nodeMap).length,
    errors,
    repairs,
    warnings,
    designConflicts: designProfile.conflicts,
    motion: {
      available: designProfile.motion.available,
      fallback: designProfile.motion.fallback,
      claims: motionAudit.claims,
      stats: motionAudit.stats,
    },
    ok: errors.length === 0,
  };

  if (args.fix && typeof args.fix === 'string') {
    fs.writeFileSync(args.fix, JSON.stringify(nodeMap, null, 1), 'utf8');
    report.written = args.fix;
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Węzły: ${report.nodes}`);
    console.log('NIE SPRAWDZAM kształtu wartości dla kontrolek typu: spacing, color, font-picker, media, custom '
      + '(m.in. Heading.tag, ImageBlock.src, ButtonBlock.href, Container.padding) — „0 błędów” ich nie obejmuje.');
    console.log(`Błędy: ${errors.length} | naprawy wartości: ${repairs.length} | ostrzeżenia renderera: ${warnings.length}`);
    for (const item of errors.slice(0, 40)) {
      console.log(`  BŁĄD  ${item.node}${item.prop ? '.' + item.prop : ''}: ${item.message}`);
    }
    for (const item of repairs.slice(0, 40)) {
      console.log(`  ${item.dropped ? 'USUNIĘTO' : 'POPRAWKA'} ${item.node}.${item.prop}: ${item.message}`);
    }
    for (const item of warnings.slice(0, 40)) {
      console.log(`  UWAGA ${item.node} (${item.component}): ${item.message}`);
    }
    if (report.written) console.log(`Zapisano poprawiony layout: ${report.written}`);
  }

  process.exit(errors.length ? 1 : 0);
}

main();
