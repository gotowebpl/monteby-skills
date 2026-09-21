'use strict';

const { buildResolvedMotionProfile } = require('./motion-contract');

const SAFE_ID_PATTERN = /^[a-z0-9_-]+$/;
const COLOR_PROP_PATTERN = /(?:^|(?:background|border|button|input|label|text|accent|focus|checkbox))color$/i;
const LOCAL_TYPOGRAPHY_PROPS = new Set([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'textTransform',
]);
const UNMEASURED_CONTENT_SECTION_DEFAULTS = Object.freeze({
  innerPaddingXTablet: '24px',
  innerPaddingXMobile: '16px',
});

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return SAFE_ID_PATTERN.test(normalized) ? normalized : '';
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function safeProjectTokenValue(value) {
  const normalized = stringValue(value);
  if (
    !normalized
    || /[;{}]/.test(normalized)
    || /(?:@import|expression|url\s*\()/i.test(normalized)
  ) {
    return '';
  }
  return normalized;
}

function flattenProjectTokens(value, prefix = '', target = {}) {
  if (!isRecord(value)) return target;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string' || typeof child === 'number') {
      target[path] = String(child).trim();
    } else if (isRecord(child) && ('value' in child || 'reference' in child)) {
      target[path] = {
        value: stringValue(child.value),
        reference: stringValue(child.reference),
      };
    } else {
      flattenProjectTokens(child, path, target);
    }
  }
  return target;
}

function contractComponents(contract) {
  const raw = Array.isArray(contract)
    ? contract
    : contract?.components || contract?.widgets || contract?.catalog || [];
  return Array.isArray(raw) ? raw : Object.values(raw || {});
}

function componentProps(contract) {
  const result = {};
  for (const component of contractComponents(contract)) {
    const name = stringValue(component?.name || component?.type || component?.resolvedName);
    if (!name) continue;
    result[name] = new Set([
      ...(Array.isArray(component.props) ? component.props : []),
      ...(Array.isArray(component.aiProps) ? component.aiProps : []),
    ].filter((prop) => typeof prop === 'string' && prop));
  }
  return result;
}

function normalizePublishedToken(key, token) {
  if (!isRecord(token)) return null;
  const value = stringValue(token.value);
  const cssVariable = stringValue(token.cssVariable);
  const reference = stringValue(token.reference)
    || (cssVariable.startsWith('--monteby-token-') ? `var(${cssVariable})` : '');
  if (!value || !/^var\(--monteby-token-[a-z0-9_-]+\)$/i.test(reference)) return null;
  return { key, value, reference, source: 'designTokens' };
}

function normalizedBindings(value) {
  if (!isRecord(value)) return {};
  const result = {};
  for (const [component, props] of Object.entries(value)) {
    if (!isRecord(props)) continue;
    const componentBindings = {};
    for (const [prop, binding] of Object.entries(props)) {
      const tokenKey = typeof binding === 'string'
        ? binding.trim()
        : stringValue(binding?.token || binding?.tokenKey);
      if (tokenKey) componentBindings[prop] = tokenKey;
    }
    if (Object.keys(componentBindings).length > 0) result[component] = componentBindings;
  }
  return result;
}

function globalColorTokens(globalStyles) {
  const result = {};
  const colors = isRecord(globalStyles?.colors) ? globalStyles.colors : {};
  for (const [rawId, rawValue] of Object.entries(colors)) {
    const id = cleanId(rawId);
    const value = stringValue(rawValue);
    if (!id || !value) continue;
    result[`colors.${id}`] = {
      key: `colors.${id}`,
      value,
      reference: `var(--gcb-color-${id})`,
      source: 'globalStyles',
    };
  }
  return result;
}

function globalFontTokens(globalStyles) {
  const result = {};
  const fonts = isRecord(globalStyles?.typography?.fonts) ? globalStyles.typography.fonts : {};
  for (const [rawId, rawFont] of Object.entries(fonts)) {
    const id = cleanId(rawId);
    const value = stringValue(isRecord(rawFont) ? rawFont.value : rawFont);
    if (!id || !value) continue;
    result[`fonts.${id}`] = {
      key: `fonts.${id}`,
      value,
      reference: `var(--gcb-font-${id})`,
      source: 'globalStyles',
    };
  }
  return result;
}

function normalizedTypographyPresetEntries(value, source) {
  const result = {};
  const presets = isRecord(value) ? value : {};
  for (const [rawId, rawPreset] of Object.entries(presets)) {
    const id = cleanId(rawId);
    if (!id || !isRecord(rawPreset)) continue;
    result[id] = {
      id,
      ...Object.fromEntries(
        Object.entries(rawPreset)
          .filter(([, value]) => typeof value === 'string')
          .map(([key, value]) => [
            key,
            source === 'projectTokens' ? safeProjectTokenValue(value) : value.trim(),
          ])
          .filter(([, value]) => value)
      ),
      source,
    };
  }
  return result;
}

function typographyPresets(globalStyles, projectTokens) {
  const globalPresets = normalizedTypographyPresetEntries(
    globalStyles?.typography?.presets,
    'globalStyles'
  );
  const projectPresets = normalizedTypographyPresetEntries(
    projectTokens?.typography?.presets || projectTokens?.typographyPresets,
    'projectTokens'
  );
  return { ...globalPresets, ...projectPresets };
}

function buildResolvedDesignProfile(contract, projectTokens = {}) {
  const globalStyles = isRecord(contract?.globalStyles) ? contract.globalStyles : {};
  const publishedTokens = {};
  const rawTokens = isRecord(contract?.designTokens?.tokens) ? contract.designTokens.tokens : {};
  for (const [key, rawToken] of Object.entries(rawTokens)) {
    const token = normalizePublishedToken(key, rawToken);
    if (token) publishedTokens[key] = token;
  }

  const conflicts = [];
  const globals = { ...globalColorTokens(globalStyles), ...globalFontTokens(globalStyles) };
  const tokens = { ...publishedTokens };
  for (const [key, token] of Object.entries(globals)) {
    if (tokens[key] && tokens[key].value !== token.value) {
      conflicts.push({
        code: 'global-design-token-conflict',
        token: key,
        preferredSource: 'globalStyles',
        globalStylesValue: token.value,
        designTokensValue: tokens[key].value,
      });
    }
    tokens[key] = token;
  }

  const rejectedProjectTokens = [];
  for (const [key, rawToken] of Object.entries(flattenProjectTokens(projectTokens))) {
    const value = safeProjectTokenValue(typeof rawToken === 'string' ? rawToken : rawToken.value);
    const reference = safeProjectTokenValue(
      typeof rawToken === 'string' ? rawToken : rawToken.reference || rawToken.value
    );
    if (!value || !reference) {
      rejectedProjectTokens.push(key);
      continue;
    }
    tokens[key] = { key, value, reference, source: 'projectTokens' };
  }

  return {
    version: 1,
    tokens,
    bindings: normalizedBindings(contract?.designTokens?.bindings),
    layout: isRecord(contract?.designTokens?.layout) ? { ...contract.designTokens.layout } : {},
    typographyPresets: typographyPresets(globalStyles, projectTokens),
    componentProps: componentProps(contract),
    motion: buildResolvedMotionProfile(contract),
    conflicts,
    customCSSConsumed: false,
    rejectedProjectTokens,
  };
}

function tokenReference(profile, key) {
  return stringValue(profile?.tokens?.[key]?.reference);
}

function firstTokenReference(profile, keys) {
  for (const key of keys) {
    const reference = tokenReference(profile, key);
    if (reference) return reference;
  }
  return '';
}

function semanticPreset(component, props, semanticRole = '') {
  if (semanticRole) return cleanId(semanticRole);
  if (component === 'Heading' || component === 'MultilineHeading') {
    const tag = String(props?.tag || '').toLowerCase();
    return /^h[1-6]$/.test(tag) ? tag : 'h2';
  }
  if (component === 'Text' || component === 'RichText') return 'body';
  if (component === 'ButtonBlock') return 'button';
  return '';
}

function applyResolvedDesignDefaults(component, props, profile, semanticRole = '') {
  const resolved = { ...(isRecord(props) ? props : {}) };
  const allowedProps = profile?.componentProps?.[component] || new Set();
  if (component === 'Section' && semanticRole === 'unmeasured-content-section') {
    for (const [prop, value] of Object.entries(UNMEASURED_CONTENT_SECTION_DEFAULTS)) {
      if (
        allowedProps.has(prop)
        && (resolved[prop] === undefined || resolved[prop] === null || resolved[prop] === '')
      ) {
        resolved[prop] = value;
      }
    }
  }
  const bindings = profile?.bindings?.[component] || {};
  for (const [prop, tokenKey] of Object.entries(bindings)) {
    if (
      (resolved[prop] !== undefined && resolved[prop] !== null && resolved[prop] !== '')
      || !allowedProps.has(prop)
    ) continue;
    const reference = tokenReference(profile, tokenKey);
    if (reference) resolved[prop] = reference;
  }

  const preset = cleanId(resolved.typographyPreset) || semanticPreset(component, resolved, semanticRole);
  const presetDefinition = preset ? profile?.typographyPresets?.[preset] : null;
  if (preset === 'h3' && !presetDefinition && resolved.typographyPreset === undefined) {
    const heading = profile?.typographyPresets?.h2 || profile?.typographyPresets?.h1 || {};
    const fallback = {
      fontFamily: heading.fontFamily,
      fontWeight: heading.fontWeight,
      ...((resolved.fontSize === undefined || resolved.fontSize === null || resolved.fontSize === '')
        ? { fontSize: '28px', fontSizeTablet: '26px', fontSizeMobile: '24px' }
        : {}),
      lineHeight: '1.3',
    };
    for (const [prop, value] of Object.entries(fallback)) {
      if (allowedProps.has(prop) && stringValue(value)
          && (resolved[prop] === undefined || resolved[prop] === null || resolved[prop] === '')) {
        resolved[prop] = value;
      }
    }
  }
  if (presetDefinition?.source === 'projectTokens') {
    for (const key of LOCAL_TYPOGRAPHY_PROPS) {
      let inheritsExplicitValue = false;
      for (const prop of [key, `${key}Tablet`, `${key}Mobile`]) {
        const explicit = props?.[prop] !== undefined && props?.[prop] !== null && props?.[prop] !== '';
        inheritsExplicitValue ||= explicit;
        if (
          !inheritsExplicitValue
          && allowedProps.has(prop)
          && (resolved[prop] === undefined || resolved[prop] === null || resolved[prop] === '')
          && stringValue(presetDefinition[prop])
        ) {
          resolved[prop] = presetDefinition[prop];
        }
      }
    }
    return resolved;
  }
  if (
    preset
    && allowedProps.has('typographyPreset')
    && presetDefinition
    && resolved.typographyPreset === undefined
  ) {
    resolved.typographyPreset = preset;
  }
  return resolved;
}

function candidateTokensForProp(profile, component, prop) {
  const candidates = [];
  const binding = profile?.bindings?.[component]?.[prop];
  if (binding && profile?.tokens?.[binding]) candidates.push(profile.tokens[binding]);
  if (COLOR_PROP_PATTERN.test(prop)) {
    candidates.push(...Object.values(profile?.tokens || {}).filter((token) => token.key.startsWith('colors.')));
  }
  if (prop === 'fontFamily') {
    candidates.push(...Object.values(profile?.tokens || {}).filter((token) => token.key.startsWith('fonts.')));
  }
  return [...new Map(candidates.map((token) => [token.key, token])).values()]
    .sort((left, right) => left.key.localeCompare(right.key));
}

function globalStyleLiteralMatch(profile, component, prop, value, requestedToken = '') {
  if (typeof value !== 'string' || /^var\(/i.test(value.trim())) return null;
  const candidates = candidateTokensForProp(profile, component, prop)
    .filter((token) => !requestedToken || token.key === requestedToken);
  const matches = candidates.filter((token) => value.trim() === token.value.trim());
  if (matches.length !== 1) return null;
  const token = matches[0];
  return {
    code: 'global-style-literal-match',
    token: token.key,
    literal: value,
    reference: token.reference,
    source: token.source,
  };
}

function effectiveTypographyValue(props, profile, prop) {
  return stringValue(props?.[prop])
    || stringValue(profile?.typographyPresets?.[props?.typographyPreset]?.[prop]);
}

function localTypographyOverrides(props) {
  return [...LOCAL_TYPOGRAPHY_PROPS].filter((prop) => props?.[prop] !== undefined);
}

module.exports = {
  UNMEASURED_CONTENT_SECTION_DEFAULTS,
  applyResolvedDesignDefaults,
  buildResolvedDesignProfile,
  firstTokenReference,
  effectiveTypographyValue,
  globalStyleLiteralMatch,
  localTypographyOverrides,
  semanticPreset,
  tokenReference,
};
