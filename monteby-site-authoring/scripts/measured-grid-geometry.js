#!/usr/bin/env node
'use strict';

const PROPORTIONAL_GRID_TOKEN = 'two-proportional';
const EQUAL_COLUMN_TOLERANCE_PERCENT = 1;
const EQUAL_TRACK_WIDTH_TOLERANCE_PERCENT = 2;
const EQUAL_TRACK_POSITION_TOLERANCE_PERCENT = 2.5;
const FIXED_SIDEBAR_WIDTHS = [280, 320, 360];
const EQUAL_GRID_TOKENS = {
  2: 'two',
  3: 'three',
  4: 'four',
};

function measureTwoColumnGrid(measurement, items) {
  if (!isGridMeasurement(measurement)) {
    return null;
  }

  const bounds = normalizeRect(measurement?.rect);
  const rects = (Array.isArray(items) ? items : [])
    .map((item) => normalizeRect(item?.rect))
    .filter((rect) => rect && bounds && rectsShareRow(rect, bounds))
    .sort((left, right) => left.left - right.left);

  if (!bounds
    || rects.length !== 2
    || !rectsShareRow(rects[0], rects[1])
    || rects[0].right > rects[1].left + 4) {
    return null;
  }

  const sidebarToken = measuredSidebarToken(rects);
  if (sidebarToken) {
    return { token: sidebarToken, firstColumnPercent: null };
  }

  const availableTrackWidth = rects[0].width + rects[1].width;
  if (availableTrackWidth <= 0) {
    return null;
  }

  const measuredPercent = rects[0].width / availableTrackWidth * 100;
  if (Math.abs(measuredPercent - 50) <= EQUAL_COLUMN_TOLERANCE_PERCENT) {
    return { token: 'two', firstColumnPercent: null };
  }
  if (measuredPercent < 10 || measuredPercent > 90) {
    return null;
  }

  return {
    token: PROPORTIONAL_GRID_TOKEN,
    firstColumnPercent: normalizeFirstColumnPercent(measuredPercent),
  };
}

function measureEqualColumnGrid(measurement, items) {
  if (!isGridMeasurement(measurement)) {
    return null;
  }

  const bounds = normalizeRect(measurement?.rect);
  const rects = (Array.isArray(items) ? items : [])
    .map((item) => normalizeRect(item?.rect))
    .filter((rect) => rect && bounds && rectsShareRow(rect, bounds));
  if (!bounds || rects.length < 2) {
    return null;
  }

  const minimumWidth = Math.min(...rects.map((rect) => rect.width));
  const minimumWidthTolerance = Math.max(2, minimumWidth * EQUAL_TRACK_WIDTH_TOLERANCE_PERCENT / 100);
  const trackRects = rects
    .filter((rect) => Math.abs(rect.width - minimumWidth) <= minimumWidthTolerance)
    .sort((left, right) => left.left - right.left);
  const preliminaryPositionTolerance = Math.max(4, minimumWidth * EQUAL_TRACK_POSITION_TOLERANCE_PERCENT / 100);
  const uniqueTrackRects = trackRects.filter((rect, index) => (
    trackRects.findIndex((candidate) => Math.abs(candidate.left - rect.left) <= preliminaryPositionTolerance) === index
  ));
  if (uniqueTrackRects.length < 2) {
    return null;
  }

  const averageWidth = trackRects.reduce((sum, rect) => sum + rect.width, 0) / trackRects.length;
  const widthTolerance = Math.max(2, averageWidth * EQUAL_TRACK_WIDTH_TOLERANCE_PERCENT / 100);
  if (trackRects.some((rect) => Math.abs(rect.width - averageWidth) > widthTolerance)) {
    return null;
  }

  const gap = measuredColumnGap(measurement, uniqueTrackRects);
  const estimatedTrackCount = Math.round((bounds.width + gap) / (averageWidth + gap));
  const token = EQUAL_GRID_TOKENS[estimatedTrackCount];
  if (!token || estimatedTrackCount < uniqueTrackRects.length) {
    return null;
  }

  const expectedTrackWidth = (bounds.width - gap * (estimatedTrackCount - 1)) / estimatedTrackCount;
  if (expectedTrackWidth <= 0 || Math.abs(expectedTrackWidth - averageWidth) > widthTolerance) {
    return null;
  }

  const step = expectedTrackWidth + gap;
  const positionTolerance = Math.max(4, expectedTrackWidth * EQUAL_TRACK_POSITION_TOLERANCE_PERCENT / 100);
  const occupiedTracks = new Set();
  for (const rect of rects) {
    const rawTrackIndex = (rect.left - bounds.left) / step;
    const trackIndex = Math.round(rawTrackIndex);
    const trackSpan = Math.round((rect.width + gap) / step);
    const expectedWidth = expectedTrackWidth * trackSpan + gap * (trackSpan - 1);
    const spanWidthTolerance = Math.max(widthTolerance, expectedTrackWidth * trackSpan * EQUAL_TRACK_WIDTH_TOLERANCE_PERCENT / 100);
    if (trackIndex < 0
      || trackIndex >= estimatedTrackCount
      || trackSpan < 1
      || trackIndex + trackSpan > estimatedTrackCount
      || Math.abs(rect.left - (bounds.left + trackIndex * step)) > positionTolerance
      || Math.abs(rect.width - expectedWidth) > spanWidthTolerance) {
      return null;
    }
    occupiedTracks.add(trackIndex);
  }
  if (occupiedTracks.size < 2) {
    return null;
  }

  return { token, trackCount: estimatedTrackCount };
}

function isGridMeasurement(measurement) {
  const display = String(measurement?.display || '').toLowerCase();
  return display === 'grid' || display === 'inline-grid' || Number(measurement?.columns || 1) > 1;
}

function measuredSidebarToken(rects) {
  const closestToken = (width) => FIXED_SIDEBAR_WIDTHS.find((size) => (
    Math.abs(width - size) <= Math.max(18, size * 0.08)
  ));
  const leftSize = closestToken(rects[0].width);
  if (leftSize && rects[1].width >= rects[0].width * 1.35) {
    return `sidebar-left-${leftSize}`;
  }
  const rightSize = closestToken(rects[1].width);
  if (rightSize && rects[0].width >= rects[1].width * 1.35) {
    return `sidebar-right-${rightSize}`;
  }
  return '';
}

function normalizeFirstColumnPercent(value) {
  return Math.max(10, Math.min(90, Math.round(value)));
}

function measuredColumnGap(measurement, row) {
  const explicit = parsePixelValue(measurement?.columnGap ?? measurement?.gap);
  if (explicit !== null) {
    return explicit;
  }

  const gaps = row.slice(1)
    .map((rect, index) => rect.left - row[index].right)
    .filter((gap) => Number.isFinite(gap) && gap >= 0)
    .sort((left, right) => left - right);
  return gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;
}

function parsePixelValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(String(value || '').trim());
  return match ? Number(match[1]) : null;
}

function normalizeRect(rect) {
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) {
    return null;
  }
  const left = finiteNumber(rect.left, rect.x);
  const top = finiteNumber(rect.top, rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    left,
    top,
    width,
    height,
    right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
    bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
  };
}

function finiteNumber(primary, fallback) {
  const primaryNumber = Number(primary);
  return Number.isFinite(primaryNumber) ? primaryNumber : Number(fallback);
}

function rectsShareRow(left, right) {
  const overlap = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return overlap >= Math.min(left.height, right.height) * 0.25;
}

module.exports = {
  PROPORTIONAL_GRID_TOKEN,
  measureEqualColumnGrid,
  measureTwoColumnGrid,
};
