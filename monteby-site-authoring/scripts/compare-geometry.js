#!/usr/bin/env node
/**
 * compare-geometry.js
 *
 * Section-by-section geometry diff between a measured reference and the Monteby
 * candidate. A per-section delta table localizes a mismatch in one pass, where a
 * screenshot only shows that "something is off".
 *
 * Two steps, because the measurement must happen in a real browser:
 *
 *   1. node compare-geometry.js --emit-snippet
 *      Prints a self-contained JS expression. Run it on the reference page and on
 *      the candidate page at the SAME viewport width (browser tool, DevTools, or
 *      any CDP client) and save each result as JSON.
 *
 *   2. node compare-geometry.js --reference ref.json --candidate cand.json [--json]
 *      Prints the delta table and a verdict.
 *
 * Trust these numbers over screenshots: a headless window resize can render a
 * desktop layout inside a narrow viewport and fake an overflow.
 */

'use strict';

const fs = require('fs');

const SNIPPET = `(function () {
  var round = function (n) { return Math.round(n); };
  var sections = [].slice.call(document.querySelectorAll('main > section, main > div > section'));
  if (!sections.length) {
    sections = [].slice.call(document.querySelectorAll('body > section, body > div > section, body > .section'));
  }
  var lineCount = function (el) {
    var lh = parseFloat(getComputedStyle(el).lineHeight);
    if (!lh) return null;
    return Math.round(el.getBoundingClientRect().height / lh);
  };
  return {
    viewport: window.innerWidth,
    pageHeight: document.body.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    sections: sections.map(function (s, i) {
      var cs = getComputedStyle(s);
      var r = s.getBoundingClientRect();
      return {
        index: i,
        height: round(r.height),
        width: round(r.width),
        background: cs.backgroundColor,
        backgroundImage: cs.backgroundImage === 'none' ? '' : 'set',
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        label: (s.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40)
      };
    }),
    headings: [].slice.call(document.querySelectorAll('main h1, main h2')).map(function (h) {
      var r = h.getBoundingClientRect();
      return {
        tag: h.tagName,
        text: (h.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 32),
        width: round(r.width),
        height: round(r.height),
        lines: lineCount(h),
        fontSize: getComputedStyle(h).fontSize
      };
    })
  };
})()`;

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

function readJson(path, label) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Nie można wczytać ${label} (${path}): ${error.message}`);
    process.exit(2);
  }
  return null;
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function main() {
  const args = parseArgs(process.argv);

  if (args['emit-snippet']) {
    console.log(SNIPPET);
    return;
  }

  if (!args.reference || !args.candidate) {
    console.error('Użycie: --emit-snippet   albo   --reference ref.json --candidate cand.json [--json]');
    process.exit(2);
  }

  const ref = readJson(args.reference, 'pomiar referencji');
  const cand = readJson(args.candidate, 'pomiar kandydata');

  if (ref.viewport !== cand.viewport) {
    console.error(
      `Pomiary z różnych szerokości (${ref.viewport} vs ${cand.viewport}) — powtórz przy tej samej.`
    );
    process.exit(2);
  }

  const rows = [];
  const count = Math.max(ref.sections.length, cand.sections.length);
  for (let i = 0; i < count; i += 1) {
    const r = ref.sections[i];
    const c = cand.sections[i];
    rows.push({
      index: i,
      label: (r && r.label) || (c && c.label) || '',
      reference: r ? r.height : null,
      candidate: c ? c.height : null,
      delta: r && c ? c.height - r.height : null,
      backgroundMismatch: r && c ? r.background !== c.background : false,
    });
  }

  const depthRatio = ref.pageHeight
    ? Math.min(cand.pageHeight, ref.pageHeight) / Math.max(cand.pageHeight, ref.pageHeight)
    : 0;

  const headingIssues = [];
  const limit = Math.min(ref.headings.length, cand.headings.length);
  for (let i = 0; i < limit; i += 1) {
    if (ref.headings[i].lines !== cand.headings[i].lines) {
      headingIssues.push({
        text: cand.headings[i].text,
        reference: ref.headings[i].lines,
        candidate: cand.headings[i].lines,
      });
    }
  }

  const problems = [];
  if (ref.sections.length !== cand.sections.length) {
    problems.push(`liczba sekcji: ${ref.sections.length} → ${cand.sections.length}`);
  }
  if (depthRatio < 0.95) {
    problems.push(`głębokość strony ${(depthRatio * 100).toFixed(1)}% (próg 95%)`);
  }
  if (cand.overflow) {
    problems.push(`poziome przepełnienie przy ${cand.viewport}px (${cand.scrollWidth}px)`);
  }
  if (headingIssues.length) {
    problems.push(`inne łamanie nagłówków: ${headingIssues.length}`);
  }
  for (const row of rows) {
    if (row.backgroundMismatch) problems.push(`sekcja ${row.index}: inne tło`);
  }

  const report = {
    viewport: ref.viewport,
    pageHeight: { reference: ref.pageHeight, candidate: cand.pageHeight, ratio: Number(depthRatio.toFixed(4)) },
    sections: rows,
    headingIssues,
    problems,
    ok: problems.length === 0,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Szerokość pomiaru: ${ref.viewport}px`);
    console.log(
      `Wysokość strony: ${ref.pageHeight} → ${cand.pageHeight} (${(depthRatio * 100).toFixed(1)}%)\n`
    );
    console.log(`${pad('#', 3)}${pad('referencja', 12)}${pad('kandydat', 11)}${pad('delta', 8)}sekcja`);
    for (const row of rows) {
      const delta = row.delta === null ? 'brak' : (row.delta > 0 ? '+' : '') + row.delta;
      console.log(
        pad(row.index, 3) +
          pad(row.reference ?? '—', 12) +
          pad(row.candidate ?? '—', 11) +
          pad(delta, 8) +
          row.label
      );
    }
    if (headingIssues.length) {
      console.log('\nŁamanie nagłówków (referencja → kandydat):');
      for (const issue of headingIssues) {
        console.log(`  ${issue.reference} → ${issue.candidate} wiersza: ${issue.text}`);
      }
      console.log('  Wskazówka: najczęstsza przyczyna to oś zmiennej szerokości fontu (patrz references/html-to-monteby.md §5).');
    }
    console.log(problems.length ? `\nDo poprawy:\n  - ${problems.join('\n  - ')}` : '\nBez zastrzeżeń.');
  }

  process.exit(problems.length ? 1 : 0);
}

main();
