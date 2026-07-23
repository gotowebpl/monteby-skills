#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  measureEqualColumnGrid,
} = require('../monteby-site-authoring/scripts/measured-grid-geometry');

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

test('equal grid measurement preserves an unoccupied trailing track', () => {
  const measurement = {
    display: 'grid',
    columnGap: '18px',
    rect: rect(180, 926.56, 1080, 303.72),
  };
  const items = [180, 454.5, 729].map((left) => ({
    rect: rect(left, 926.56, 256.5, 303.72),
  }));

  assert.deepEqual(measureEqualColumnGrid(measurement, items), {
    token: 'four',
    trackCount: 4,
  });
});

test('equal grid measurement resolves complete three-column rows', () => {
  const measurement = {
    display: 'grid',
    gap: '14px',
    rect: rect(180, 730, 1080, 106),
  };
  const items = [180, 544.67, 909.34].map((left) => ({
    rect: rect(left, 730, 350.66, 106),
  }));

  assert.deepEqual(measureEqualColumnGrid(measurement, items), {
    token: 'three',
    trackCount: 3,
  });
});

test('equal grid measurement deduplicates tracks across rows with a vertical spanning card', () => {
  const measurement = {
    display: 'grid',
    gap: '20px',
    rect: rect(110, 120, 633.6, 520),
  };
  const items = [
    { rect: rect(110, 120, 306.8, 250) },
    { rect: rect(436.8, 120, 306.8, 520) },
    { rect: rect(110, 390, 306.8, 250) },
  ];

  assert.deepEqual(measureEqualColumnGrid(measurement, items), {
    token: 'two',
    trackCount: 2,
  });
});

test('equal grid measurement rejects unequal bento spans and non-grid rows', () => {
  const bounds = rect(0, 0, 1200, 400);
  const items = [
    { rect: rect(0, 0, 780, 200) },
    { rect: rect(804, 0, 396, 200) },
  ];

  assert.equal(measureEqualColumnGrid({ display: 'grid', gap: '24px', rect: bounds }, items), null);
  assert.equal(measureEqualColumnGrid({ display: 'flex', gap: '24px', rect: bounds }, items), null);
});
