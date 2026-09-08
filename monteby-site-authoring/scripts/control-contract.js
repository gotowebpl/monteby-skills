'use strict';

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionValues(options) {
  const values = Array.isArray(options)
    ? options
    : isRecord(options) ? Object.values(options) : [];
  return values.flatMap((option) => {
    if (['string', 'number', 'boolean'].includes(typeof option)) return [option];
    if (isRecord(option) && ['string', 'number', 'boolean'].includes(typeof option.value)) {
      return [option.value];
    }
    return [];
  });
}

function controlProps(control) {
  if (!isRecord(control)) return [];
  return [...new Set([
    ...(typeof control.prop === 'string' ? [control.prop] : []),
    ...(Array.isArray(control.props) ? control.props.filter((prop) => typeof prop === 'string') : []),
    ...(isRecord(control.spacingProps)
      ? Object.values(control.spacingProps).filter((prop) => typeof prop === 'string')
      : []),
  ].map((prop) => prop.trim()).filter(Boolean))];
}

function visitControls(value, callback) {
  if (Array.isArray(value)) {
    for (const child of value) visitControls(child, callback);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.type === 'string' && value.type.trim()) callback(value);
  for (const child of Object.values(value)) visitControls(child, callback);
}

function repeaterItemPropNames(control) {
  if (!isRecord(control) || control.type !== 'repeater') return null;
  const names = new Set();
  visitControls([control.itemControls, control.itemFields], (itemControl) => {
    for (const prop of controlProps(itemControl)) names.add(prop);
  });
  if (isRecord(control.itemFields)) {
    for (const key of Object.keys(control.itemFields)) names.add(key);
  }
  return names.size > 0 ? names : null;
}

function collectControlMetadata(value) {
  const props = [];
  const propOptions = new Map();
  const propRules = new Map();
  const repeaterItemProps = new Map();
  const repeaterItemRules = new Map();
  const controls = new Map();

  visitControls(value, (control) => {
    const propsForControl = controlProps(control);
    const values = optionValues(control.options);
    const rule = {
      type: String(control.type),
      ...(typeof control.pattern === 'string' ? { pattern: control.pattern } : {}),
      ...(typeof control.min === 'number' ? { min: control.min } : {}),
      ...(typeof control.max === 'number' ? { max: control.max } : {}),
      ...(typeof control.step === 'number' ? { step: control.step } : {}),
      ...(Array.isArray(control.units)
        ? { units: control.units.filter((unit) => typeof unit === 'string') }
        : {}),
    };
    const itemProps = repeaterItemPropNames(control);
    const nestedMetadata = control.type === 'repeater'
      ? collectControlMetadata([control.itemControls, control.itemFields])
      : null;
    for (const prop of propsForControl) {
      props.push(prop);
      if (!controls.has(prop)) controls.set(prop, control);
      propRules.set(prop, { ...(propRules.get(prop) || {}), ...rule });
      if (values.length > 0) {
        const existing = propOptions.get(prop) || new Set();
        for (const value of values) existing.add(String(value));
        propOptions.set(prop, existing);
      }
      if (itemProps) {
        repeaterItemProps.set(prop, itemProps);
        const itemRules = new Map();
        for (const [itemProp, itemRule] of nestedMetadata.propRules) {
          const options = nestedMetadata.propOptions.get(itemProp);
          itemRules.set(itemProp, options instanceof Set ? { ...itemRule, options } : itemRule);
        }
        repeaterItemRules.set(prop, itemRules);
      }
    }
  });

  return {
    props: [...new Set(props)],
    propOptions,
    propRules,
    repeaterItemProps,
    repeaterItemRules,
    controls,
  };
}

function buildControlIndex(contract) {
  const index = new Map();
  for (const component of Array.isArray(contract?.components) ? contract.components : []) {
    if (!isRecord(component) || typeof component.name !== 'string') continue;
    const metadata = collectControlMetadata([component.controls, component.schema]);
    for (const [prop, control] of metadata.controls) {
      index.set(`${component.name}.${prop}`, control);
    }
  }
  return index;
}

function snap(value, step) {
  return Number((Math.round(value / step) * step).toFixed(6));
}

function normalizeControlValue(control, value, publishedReferences = new Set()) {
  if (!isRecord(control)) return { accepted: true, value };
  const label = JSON.stringify(value);
  const type = String(control.type || '');
  const values = optionValues(control.options);

  if (typeof value === 'string' && /^var\s*\(/iu.test(value.trim())) {
    const reference = value.trim();
    return publishedReferences.has(reference)
      ? { accepted: true, value: reference }
      : { accepted: false, reason: `nieopublikowana referencja CSS ${label}` };
  }
  if (values.length > 0 && ['custom', 'select', 'segment'].includes(type) && !values.includes(value)) {
    return { accepted: false, reason: `${label} spoza ${JSON.stringify(values)}` };
  }
  if (typeof control.pattern === 'string' && typeof value === 'string') {
    let pattern;
    try {
      pattern = new RegExp(control.pattern, 'u');
    } catch {
      return { accepted: false, contractError: true, reason: 'kontrakt publikuje nieprawidłowy wzorzec kontrolki' };
    }
    if (!pattern.test(value)) return { accepted: false, reason: `${label} nie spełnia wzorca kontrolki` };
  }
  if (type === 'toggle' && typeof value !== 'boolean') {
    return { accepted: false, reason: `${label} nie jest wartością logiczną` };
  }
  if (type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return { accepted: false, reason: `${label} nie jest liczbą` };
    let normalized = typeof control.step === 'number' && control.step > 0 ? snap(numeric, control.step) : numeric;
    if (typeof control.min === 'number') normalized = Math.max(control.min, normalized);
    if (typeof control.max === 'number') normalized = Math.min(control.max, normalized);
    return {
      accepted: true,
      value: normalized,
      changed: normalized !== value,
      ...(normalized !== value && typeof control.step === 'number'
        ? { changeReason: `dociągnięte do kroku ${control.step}: ${value} → ${normalized}` }
        : {}),
    };
  }
  if (['css-value', 'spacing'].includes(type) && typeof value === 'string') {
    if (/\S\s+\S/u.test(value.trim())) {
      return { accepted: false, reason: `kontrolka przyjmuje jedną wartość, podano ${label}` };
    }
    const match = /^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/iu.exec(value);
    if (!match) return { accepted: false, reason: `${label} nie jest pojedynczą wartością CSS kontrolki` };
    const unit = match[2] || '';
    if (Array.isArray(control.units) && !control.units.includes(unit)) {
      return { accepted: false, reason: `jednostka ${JSON.stringify(unit)} spoza ${JSON.stringify(control.units)}` };
    }
    let numeric = Number(match[1]);
    if (typeof control.step === 'number' && control.step > 0) numeric = snap(numeric, control.step);
    if (typeof control.min === 'number') numeric = Math.max(control.min, numeric);
    if (typeof control.max === 'number') numeric = Math.min(control.max, numeric);
    const normalized = `${numeric}${unit}`;
    return {
      accepted: true,
      value: normalized,
      changed: normalized !== value.trim(),
      ...(normalized !== value.trim() && typeof control.step === 'number'
        ? { changeReason: `dociągnięte do kroku ${control.step}: ${value} → ${normalized}` }
        : {}),
    };
  }
  return { accepted: true, value };
}

module.exports = {
  buildControlIndex,
  collectControlMetadata,
  controlProps,
  normalizeControlValue,
  optionValues,
};
