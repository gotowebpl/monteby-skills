'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildContentLedger,
  compareContentLedgers,
  mergeDirectTextEntries,
  nodeMapContentEntries,
  normalizeContentText,
} = require('../monteby-site-authoring/scripts/content-ledger');

test('content ledger preserves long Polish paragraphs and normalizes inline markup', () => {
  const longText = `Zażółć gęślą jaźń ${'bardzo długa treść '.repeat(30)}`.trim();
  const ledger = buildContentLedger([
    { structureKey: 'main.p:nth-of-type(1)', text: `<strong>${longText}</strong>` },
    { structureKey: 'main.p:nth-of-type(2)', text: 'Powtórzenie' },
    { structureKey: 'main.p:nth-of-type(3)', text: 'Powtórzenie' },
  ]);

  assert.equal(ledger.totalOccurrences, 3);
  assert.equal(ledger.uniqueEntries, 2);
  assert.equal(ledger.items.find((item) => item.text === longText)?.length, Array.from(longText).length);
  assert.equal(ledger.items.find((item) => item.text === 'Powtórzenie')?.count, 2);
  assert.equal(normalizeContentText('A&nbsp;B\nC'), 'A\u00a0B C');
});

test('node-map ledger reads only content-bearing props, including repeater items', () => {
  const entries = nodeMapContentEntries({
    ROOT: { props: { background: '#ffffff' } },
    heading: {
      props: {
        text: 'Pełny nagłówek',
        content: 'Pełny nagłówek',
        color: 'red',
        lines: [
          { text: 'Pierwszy wiersz', color: 'blue' },
          { text: 'Drugi wiersz', leftOffset: '20px' },
        ],
      },
    },
  });

  assert.deepEqual(entries.map((entry) => entry.text), [
    'Pełny nagłówek',
    'Pierwszy wiersz',
    'Drugi wiersz',
  ]);
});

test('node-map ledger keeps duplicate rendered repeater occurrences in one node', () => {
  const entries = nodeMapContentEntries({
    tabs: {
      props: {
        tabs: [
          { title: 'Ta sama etykieta' },
          { title: 'Ta sama etykieta' },
        ],
      },
    },
  });
  assert.equal(entries.filter((entry) => entry.text === 'Ta sama etykieta').length, 2);
});

test('direct text joins the independent ledger without double-counting full element text', () => {
  const fullEntries = [
    { structureKey: '0.0', text: 'Pełna treść elementu' },
    { structureKey: '0.1.0', text: 'Cena 650 000 zł miesięcznie' },
  ];
  const directEntries = [
    { structureKey: '0.0', text: 'Pełna' },
    { structureKey: '0.1', text: 'od' },
    { structureKey: '0.1', text: 'od' },
  ];
  const merged = mergeDirectTextEntries(fullEntries, directEntries);
  const expected = buildContentLedger(merged);

  assert.deepEqual(merged.map((entry) => entry.text), ['Pełna treść elementu', 'Cena 650 000 zł miesięcznie', 'od']);
  assert.equal(expected.totalOccurrences, 3);

  const exact = buildContentLedger(nodeMapContentEntries({
    prefix: { props: { text: 'od' } },
    price: { props: { text: 'Cena 650 000 zł miesięcznie' } },
    full: { props: { text: 'Pełna treść elementu' } },
  }));
  assert.equal(compareContentLedgers(expected, exact).complete, true);

  const missing = buildContentLedger(nodeMapContentEntries({
    price: { props: { text: 'Cena 650 000 zł miesięcznie' } },
    full: { props: { text: 'Pełna treść elementu' } },
  }));
  assert.equal(compareContentLedgers(expected, missing).missing[0].text, 'od');

  const truncated = buildContentLedger(nodeMapContentEntries({
    prefix: { props: { text: 'od' } },
    price: { props: { text: 'Cena 650 000 zł' } },
    full: { props: { text: 'Pełna treść elementu' } },
  }));
  assert.equal(compareContentLedgers(expected, truncated).truncatedOrChanged[0].text, 'Cena 650 000 zł miesięcznie');

  const duplicate = buildContentLedger(nodeMapContentEntries({
    first: { props: { text: 'od' } },
    second: { props: { text: 'od' } },
    price: { props: { text: 'Cena 650 000 zł miesięcznie' } },
    full: { props: { text: 'Pełna treść elementu' } },
  }));
  assert.equal(compareContentLedgers(expected, duplicate).duplicateCountMismatch[0].text, 'od');
});

test('ledger comparison distinguishes missing, changed, and duplicate-count mismatches', () => {
  const expected = buildContentLedger([
    { structureKey: 'p.1', text: 'Treść kompletna i niezmieniona.' },
    { structureKey: 'p.2', text: 'Akapit całkowicie nieobecny.' },
    { structureKey: 'p.3', text: 'Ten akapit został ucięty w połowie i nie może przejść.' },
    { structureKey: 'p.4', text: 'Duplikat' },
    { structureKey: 'p.5', text: 'Duplikat' },
  ]);
  const candidate = buildContentLedger([
    { structureKey: 'node-1:props.text', text: 'Treść kompletna i niezmieniona.' },
    { structureKey: 'node-2:props.text', text: 'Ten akapit został ucięty w połowie' },
    { structureKey: 'node-3:props.text', text: 'Duplikat' },
  ]);

  const comparison = compareContentLedgers(expected, candidate);
  assert.equal(comparison.complete, false);
  assert.equal(comparison.matched.length, 1);
  assert.equal(comparison.missing[0].text, 'Akapit całkowicie nieobecny.');
  assert.equal(comparison.truncatedOrChanged[0].text, 'Ten akapit został ucięty w połowie i nie może przejść.');
  assert.equal(comparison.duplicateCountMismatch[0].actualCount, 1);
});

test('ledger comparison blocks text added beyond the approved source document', () => {
  const expected = buildContentLedger([{ structureKey: 'client.1', text: 'Treść zatwierdzona.' }]);
  const candidate = buildContentLedger([
    { structureKey: 'live.1', text: 'Treść zatwierdzona.' },
    { structureKey: 'live.2', text: 'Dopisany marketingowy akapit.' },
  ]);

  const comparison = compareContentLedgers(expected, candidate);

  assert.equal(comparison.complete, false);
  assert.deepEqual(comparison.added.map((item) => item.text), ['Dopisany marketingowy akapit.']);
});

test('51-paragraph fixture with 509-character copy passes only at exact multiset parity', () => {
  const longest = `${`Łódź i Gdańsk — ${'pełny akapit z polskimi znakami '.repeat(20)}`.slice(0, 508)}ż`;
  const paragraphs = Array.from({ length: 51 }, (_, index) => ({
    structureKey: `main.p:nth-of-type(${index + 1})`,
    text: index === 50
      ? `<em>${longest}</em>`
      : index >= 48
        ? 'Powtarzalny akapit końcowy.'
        : `Akapit ${index + 1}: kompletna treść źródłowa.`,
  }));
  const expected = buildContentLedger(paragraphs);
  const candidateNodeMap = Object.fromEntries(paragraphs.map((paragraph, index) => ([
    `text-${index + 1}`,
    { props: { text: paragraph.text } },
  ])));
  const candidate = buildContentLedger(nodeMapContentEntries(candidateNodeMap));

  assert.equal(expected.totalOccurrences, 51);
  assert.equal(expected.items.find((item) => item.length === 509)?.text, longest);
  assert.equal(compareContentLedgers(expected, candidate).complete, true);

  candidateNodeMap['text-51'].props.text = longest.slice(0, 300);
  candidateNodeMap['text-50'].props.text = '';
  const changed = compareContentLedgers(
    expected,
    buildContentLedger(nodeMapContentEntries(candidateNodeMap))
  );
  assert.equal(changed.complete, false);
  assert.equal(changed.truncatedOrChanged.some((item) => item.length === 509), true);
  assert.equal(changed.duplicateCountMismatch.some((item) => item.text === 'Powtarzalny akapit końcowy.'), true);
});
