'use strict';

const { validateIconCatalog } = require('./icon-mapping');

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const CONTROL_CONTEXT = Symbol('montebyControlContext');
const CONTROL_RULE_FIELDS = Object.freeze([
  'type',
  'pattern',
  'min',
  'max',
  'step',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'allowEmpty',
  'atomic',
  'source',
  'uniqueItems',
  'columns',
  'maxColumns',
  'itemControls',
  'itemFields',
]);
const ALLOWED_AUTHORING_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em',
  'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'a', 'form',
]);
const CSS_COLOR_KEYWORDS = new Set((
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood '
  + 'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray '
  + 'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen '
  + 'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue '
  + 'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew '
  + 'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan '
  + 'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray '
  + 'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid '
  + 'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream '
  + 'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen '
  + 'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown '
  + 'royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow '
  + 'springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent '
  + 'currentcolor inherit'
).split(' '));
const SYSTEM_FONT_FAMILIES = new Set([
  'system', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system',
  'blinkmacsystemfont', 'sfprodisplay-regular', 'arial', 'helvetica', 'georgia', 'times',
  'times new roman', 'courier', 'courier new', 'verdana', 'geneva', 'trebuchet ms', 'segoe ui',
  'inherit', 'initial', 'unset', 'revert', 'revert-layer',
]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const CUSTOM_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function codePointLength(value) {
  return Array.from(value).length;
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nodeComponent(node) {
  return isRecord(node?.type) && typeof node.type.resolvedName === 'string'
    ? node.type.resolvedName
    : '';
}

function relationshipError(code, path, message) {
  return { code, path, message };
}

function validateButtonFormPrefillRelationships(nodeMap, contract) {
  const rules = contract?.authoring?.relationshipRules?.buttonFormPrefill;
  const nodes = isRecord(nodeMap) ? nodeMap : {};
  const buttons = Object.entries(nodes).filter(([, node]) => nodeComponent(node) === rules?.buttonComponent);
  if (buttons.length === 0) return [];

  const requiredStrings = [
    'buttonComponent', 'formComponent', 'formReferenceProp', 'fieldReferenceProp',
    'valueProp', 'formIdentityProp', 'fieldsProp', 'fieldTypeProp', 'optionsProp',
  ];
  const malformed = !isRecord(rules)
    || requiredStrings.some((field) => typeof rules[field] !== 'string' || !rules[field].trim())
    || !Array.isArray(rules.fieldIdentityProps)
    || rules.fieldIdentityProps.length === 0
    || rules.fieldIdentityProps.some((field) => typeof field !== 'string' || !field.trim())
    || !Array.isArray(rules.supportedFieldTypes)
    || rules.supportedFieldTypes.length === 0
    || rules.supportedFieldTypes.some((type) => typeof type !== 'string' || !type.trim())
    || !Number.isInteger(rules.maximumValueCodePoints)
    || rules.maximumValueCodePoints < 0;
  if (malformed) {
    return [relationshipError(
      'invalid_relationship_contract',
      'authoring.relationshipRules.buttonFormPrefill',
      'The live buttonFormPrefill relationship contract is incomplete.'
    )];
  }

  const forms = Object.entries(nodes).filter(([, node]) => nodeComponent(node) === rules.formComponent);
  const supportedTypes = new Set(rules.supportedFieldTypes);
  const errors = [];
  for (const [nodeId, node] of buttons) {
    const props = isRecord(node?.props) ? node.props : {};
    const hasValue = hasOwn(props, rules.valueProp);
    const rawFormId = props[rules.formReferenceProp] ?? '';
    const rawFieldId = props[rules.fieldReferenceProp] ?? '';
    const rawValue = hasValue ? props[rules.valueProp] : '';
    const allEmpty = (!hasOwn(props, rules.formReferenceProp) || rawFormId === '')
      && (!hasOwn(props, rules.fieldReferenceProp) || rawFieldId === '')
      && (!hasValue || rawValue === '');
    if (rules.allEmptyInert === true && allEmpty) continue;

    const formPath = `${nodeId}.${rules.formReferenceProp}`;
    const fieldPath = `${nodeId}.${rules.fieldReferenceProp}`;
    const valuePath = `${nodeId}.${rules.valueProp}`;
    if (typeof rawFormId !== 'string' || !rawFormId) {
      errors.push(relationshipError('incomplete_form_prefill', formPath, 'Form prefill requires a non-empty form identifier.'));
    }
    if (typeof rawFieldId !== 'string' || !rawFieldId) {
      errors.push(relationshipError('incomplete_form_prefill', fieldPath, 'Form prefill requires a non-empty field identifier.'));
    }
    if (typeof rawValue !== 'string') {
      errors.push(relationshipError('invalid_form_prefill_value', valuePath, 'Form prefill value must be text.'));
      continue;
    }
    if (Array.from(rawValue).length > rules.maximumValueCodePoints || /[\u0000-\u001f\u007f]/u.test(rawValue)) {
      errors.push(relationshipError('invalid_form_prefill_value', valuePath, 'Form prefill value exceeds the published limit or contains control characters.'));
    }
    if (typeof rawFormId !== 'string' || !rawFormId || typeof rawFieldId !== 'string' || !rawFieldId) continue;

    const matchingForms = forms.filter(([, form]) => {
      const formProps = isRecord(form?.props) ? form.props : {};
      return formProps[rules.formIdentityProp] === rawFormId;
    });
    if (matchingForms.length !== 1) {
      errors.push(relationshipError(
        matchingForms.length === 0 ? 'unknown_form_prefill_form' : 'ambiguous_form_prefill_form',
        formPath,
        'Form prefill must identify exactly one FormBlock.'
      ));
      continue;
    }
    const [, form] = matchingForms[0];
    if (form.hidden === true) {
      errors.push(relationshipError('hidden_form_prefill_form', formPath, 'Form prefill cannot target a hidden form.'));
      continue;
    }
    const formProps = isRecord(form.props) ? form.props : {};
    const fields = Array.isArray(formProps[rules.fieldsProp]) ? formProps[rules.fieldsProp] : [];
    const matchingFields = fields.filter((field) => {
      if (!isRecord(field)) return false;
      const identity = rules.fieldIdentityProps
        .map((prop) => field[prop])
        .find((value) => typeof value === 'string' && value !== '');
      return identity === rawFieldId;
    });
    if (matchingFields.length !== 1) {
      errors.push(relationshipError(
        matchingFields.length === 0 ? 'unknown_form_prefill_field' : 'ambiguous_form_prefill_field',
        fieldPath,
        'Form prefill must identify exactly one field in the target form.'
      ));
      continue;
    }
    const field = matchingFields[0];
    const fieldType = typeof field[rules.fieldTypeProp] === 'string' && field[rules.fieldTypeProp]
      ? field[rules.fieldTypeProp]
      : 'text';
    if (!supportedTypes.has(fieldType)) {
      errors.push(relationshipError('unsupported_form_prefill_field', fieldPath, 'The target field type is not published as prefillable.'));
      continue;
    }
    if (['select', 'radio'].includes(fieldType)) {
      const options = typeof field[rules.optionsProp] === 'string'
        ? field[rules.optionsProp].split('\n').map((line) => line.trim()).filter(Boolean)
        : [];
      const matches = options.filter((line) => {
        const separator = line.indexOf('|');
        const label = (separator < 0 ? line : line.slice(0, separator)).trim();
        const optionValue = (separator < 0 ? line : line.slice(separator + 1)).trim() || label;
        return optionValue === rawValue;
      }).length;
      if (matches !== 1 || (fieldType === 'radio' && rawValue === '')) {
        errors.push(relationshipError('invalid_form_prefill_option', valuePath, 'Form prefill must identify exactly one published option.'));
      }
      continue;
    }
    if (fieldType === 'checkbox' && !['', '1'].includes(rawValue)) {
      errors.push(relationshipError('invalid_form_prefill_checkable_value', valuePath, 'Checkbox prefill accepts only an empty value or 1.'));
      continue;
    }
    if (fieldType === 'number' && rawValue !== '') {
      const number = Number(rawValue);
      const minimum = typeof field.min === 'number' && Number.isFinite(field.min) ? field.min : null;
      const maximum = typeof field.max === 'number' && Number.isFinite(field.max) ? field.max : null;
      const step = typeof field.step === 'number' && Number.isFinite(field.step) && field.step > 0 ? field.step : null;
      const base = minimum ?? 0;
      const steps = step === null ? 0 : (number - base) / step;
      const offStep = step !== null && Math.abs(steps - Math.round(steps)) > 1e-7;
      if (rawValue.trim() !== rawValue || !Number.isFinite(number)
          || (minimum !== null && number < minimum) || (maximum !== null && number > maximum) || offStep) {
        errors.push(relationshipError('invalid_form_prefill_number', valuePath, 'Number prefill violates the target field range or step.'));
      }
    }
  }
  return errors;
}

function validateQueryControlRelationships(nodeMap, contract) {
  const rules = contract?.authoring?.relationshipRules?.queryControls;
  if (rules === undefined) return [];

  const requiredStrings = ['loopComponent', 'referenceProp'];
  const requiredComponentLists = [
    'controlComponents',
    'postTypeParityComponents',
    'sortOptionsRequiredComponents',
  ];
  const malformedLists = requiredComponentLists.some((field) => (
    !Array.isArray(rules?.[field])
    || rules[field].some((component) => typeof component !== 'string' || !component.trim())
    || new Set(rules[field]).size !== rules[field].length
  ));
  const controls = Array.isArray(rules?.controlComponents) ? new Set(rules.controlComponents) : new Set();
  const malformed = !isRecord(rules)
    || requiredStrings.some((field) => typeof rules[field] !== 'string' || !rules[field].trim())
    || malformedLists
    || controls.size === 0
    || rules.requiresExplicitId !== true
    || rules.requiresExactlyOne !== true
    || rules.inheritSourceAllowed !== false
    || [...(rules.postTypeParityComponents || []), ...(rules.sortOptionsRequiredComponents || [])]
      .some((component) => !controls.has(component));
  if (malformed) {
    return [relationshipError(
      'invalid_relationship_contract',
      'authoring.relationshipRules.queryControls',
      'The live queryControls relationship contract is incomplete.'
    )];
  }

  const nodes = isRecord(nodeMap) ? nodeMap : {};
  const loops = new Map();
  const queryControls = [];
  for (const [nodeId, node] of Object.entries(nodes)) {
    const component = nodeComponent(node);
    const props = isRecord(node?.props) ? node.props : {};
    if (component === rules.loopComponent) {
      const value = props[rules.referenceProp];
      const queryId = typeof value === 'string' ? value.trim() : '';
      if (queryId) {
        const matches = loops.get(queryId) || [];
        matches.push({ nodeId, props });
        loops.set(queryId, matches);
      }
    } else if (controls.has(component)) {
      queryControls.push({ nodeId, component, props });
    }
  }

  const errors = [];
  for (const matches of loops.values()) {
    if (matches.length < 2) continue;
    for (const match of matches) {
      errors.push(relationshipError(
        'duplicate_query_loop_id',
        `${match.nodeId}.${rules.referenceProp}`,
        `A ${rules.referenceProp} must identify exactly one ${rules.loopComponent} in the layout.`
      ));
    }
  }

  const postTypeParityComponents = new Set(rules.postTypeParityComponents);
  const sortOptionsRequiredComponents = new Set(rules.sortOptionsRequiredComponents);
  for (const control of queryControls) {
    const value = control.props[rules.referenceProp];
    const queryId = typeof value === 'string' ? value.trim() : '';
    const path = `${control.nodeId}.${rules.referenceProp}`;
    const matches = queryId ? loops.get(queryId) || [] : [];
    if (matches.length !== 1) {
      errors.push(relationshipError(
        'orphan_query_control',
        path,
        `${control.component} must reference exactly one explicitly named ${rules.loopComponent}.`
      ));
      continue;
    }

    const loopProps = matches[0].props;
    if (loopProps.source === 'inherit') {
      errors.push(relationshipError(
        'unsupported_inherited_query_control',
        path,
        `Public ${rules.loopComponent} controls cannot bind to source="inherit" because the page query owns that URL.`
      ));
    }
    if (postTypeParityComponents.has(control.component)) {
      const loopPostType = typeof loopProps.postType === 'string' ? loopProps.postType : 'post';
      const controlPostType = typeof control.props.postType === 'string' ? control.props.postType : 'post';
      if (loopPostType !== controlPostType) {
        errors.push(relationshipError(
          'query_control_post_type_mismatch',
          `${control.nodeId}.postType`,
          `${control.component} and its ${rules.loopComponent} must use the same postType.`
        ));
      }
    }
    if (sortOptionsRequiredComponents.has(control.component)
        && (!Array.isArray(loopProps.sortOptions) || loopProps.sortOptions.length === 0)) {
      errors.push(relationshipError(
        'query_sort_options_missing',
        path,
        `${control.component} requires at least one stored sort option on its ${rules.loopComponent}.`
      ));
    }
  }

  return errors;
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
    ...(typeof control.ofProp === 'string' ? [control.ofProp] : []),
    ...(Array.isArray(control.props) ? control.props.filter((prop) => typeof prop === 'string') : []),
    ...(isRecord(control.spacingProps)
      ? Object.values(control.spacingProps).filter((prop) => typeof prop === 'string')
      : []),
    ...(isRecord(control.spacingPropsTablet)
      ? Object.values(control.spacingPropsTablet).filter((prop) => typeof prop === 'string')
      : []),
    ...(isRecord(control.spacingPropsMobile)
      ? Object.values(control.spacingPropsMobile).filter((prop) => typeof prop === 'string')
      : []),
    ...(typeof control.spacingFallbackProp === 'string' ? [control.spacingFallbackProp] : []),
    ...(isRecord(control.borderColorProps)
      ? Object.values(control.borderColorProps).filter((prop) => typeof prop === 'string')
      : []),
    ...(typeof control.borderColorModeProp === 'string' ? [control.borderColorModeProp] : []),
  ].map((prop) => prop.trim()).filter(Boolean))];
}

function controlRule(control) {
  const rule = {};
  for (const field of CONTROL_RULE_FIELDS) {
    if (hasOwn(control, field)) rule[field] = control[field];
  }
  if (Array.isArray(control.options) || isRecord(control.options)) rule.options = control.options;
  if (Array.isArray(control.units)) rule.units = control.units;
  return rule;
}

function nestedControlEntries(control) {
  const entries = [];
  for (const field of ['itemControls', 'itemFields']) {
    const children = control?.[field];
    if (Array.isArray(children)) {
      entries.push(...children.filter(isRecord));
      continue;
    }
    if (!isRecord(children)) continue;
    for (const [prop, descriptor] of Object.entries(children)) {
      if (isRecord(descriptor)) {
        entries.push(controlProps(descriptor).length > 0 ? descriptor : { ...descriptor, prop });
      } else if (typeof descriptor === 'string' && prop.trim()) {
        entries.push({ type: descriptor, prop });
      }
    }
  }
  return entries;
}

function visitControls(value, callback) {
  if (Array.isArray(value)) {
    for (const child of value) visitControls(child, callback);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.type === 'string' && value.type.trim()) {
    callback(value);
    return;
  }
  for (const child of Object.values(value)) visitControls(child, callback);
}

function repeaterItemPropNames(control) {
  if (!isRecord(control) || !['object', 'repeater'].includes(control.type)) return null;
  const names = new Set();
  visitControls(nestedControlEntries(control), (itemControl) => {
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
    const rule = controlRule(control);
    const itemProps = repeaterItemPropNames(control);
    const nestedMetadata = ['object', 'repeater'].includes(control.type)
      ? collectControlMetadata(nestedControlEntries(control))
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

function hostScopedPath(component, path) {
  return Array.isArray(component?.hostScopedProps)
    && component.hostScopedProps.some((entry) => entry === path);
}

function controlContext(component, contract, prop, path, bindingOverride) {
  const defaults = isRecord(component?.defaults) ? component.defaults : {};
  const valueSchemas = isRecord(component?.valueSchemas) ? component.valueSchemas : null;
  const hostBindings = isRecord(component?.hostBindings) ? component.hostBindings : {};
  const topLevel = path === prop;
  const malformedHostScopedProps = hasOwn(component, 'hostScopedProps')
    && (!Array.isArray(component.hostScopedProps)
      || component.hostScopedProps.some((entry) => typeof entry !== 'string' || !entry.trim()));
  const malformedHostBindings = hasOwn(component, 'hostBindings') && !isRecord(component.hostBindings);
  const malformedValueSchemas = hasOwn(component, 'valueSchemas') && !isRecord(component.valueSchemas);
  const boundValue = bindingOverride ?? hostBindings[path];
  return {
    componentName: component.name,
    prop,
    path,
    contract,
    hasPublishedValueSchemas: topLevel && valueSchemas !== null,
    valueSchema: topLevel ? valueSchemas?.[prop] : undefined,
    hasDefault: topLevel && Object.prototype.hasOwnProperty.call(defaults, prop),
    defaultValue: topLevel ? defaults[prop] : undefined,
    hostScoped: hostScopedPath(component, path),
    hostBinding: boundValue,
    metadataError: malformedHostScopedProps
      || malformedHostBindings
      || malformedValueSchemas
      || (Object.prototype.hasOwnProperty.call(hostBindings, path) && !isRecord(hostBindings[path]))
      || (bindingOverride !== undefined && !isRecord(bindingOverride)),
  };
}

function enrichControl(control, component, contract, prop, path = prop, bindingOverride) {
  const enriched = { ...control };
  const context = controlContext(component, contract, prop, path, bindingOverride);
  for (const field of ['itemControls', 'itemFields']) {
    if (!hasOwn(control, field)) continue;
    const nested = nestedControlEntries({ [field]: control[field] });
    enriched[field] = nested.map((itemControl) => {
      const itemProps = controlProps(itemControl);
      if (itemProps.length === 0) return { ...itemControl };
      const itemProp = itemProps[0];
      const itemPath = `${path}${control.type === 'repeater' ? '[]' : ''}.${itemProp}`;
      const itemBinding = isRecord(context.hostBinding?.itemFields)
        ? context.hostBinding.itemFields[itemProp]
        : undefined;
      return enrichControl(itemControl, component, contract, itemProp, itemPath, itemBinding);
    });
  }
  Object.defineProperty(enriched, CONTROL_CONTEXT, {
    value: context,
    enumerable: false,
  });
  return enriched;
}

function buildControlIndex(contract) {
  const index = new Map();
  for (const component of Array.isArray(contract?.components) ? contract.components : []) {
    if (!isRecord(component) || typeof component.name !== 'string') continue;
    const metadata = collectControlMetadata([component.controls, component.schema]);
    for (const [prop, control] of metadata.controls) {
      index.set(`${component.name}.${prop}`, enrichControl(control, component, contract, prop));
    }
  }
  return index;
}

function snap(value, step, base = 0) {
  return Number((base + Math.round((value - base) / step) * step).toFixed(6));
}

function publishedControlReferences(contract, component, prop, control = {}) {
  const references = new Set();
  if (control?.type === 'icon-svg') {
    try {
      for (const icon of validateIconCatalog(contract).icons) references.add(icon);
    } catch {
      return references;
    }
  }
  const tokens = isRecord(contract?.designTokens?.tokens) ? contract.designTokens.tokens : {};
  const binding = contract?.designTokens?.bindings?.[component]?.[prop];
  const boundReference = typeof binding === 'string' ? tokens[binding]?.reference : undefined;
  const color = ['color', 'border-color'].includes(control?.type) || /color$/i.test(prop);
  const font = control?.type === 'font-picker' || /fontfamily$/i.test(prop);
  for (const token of Object.values(tokens)) {
    const reference = token?.reference;
    if (typeof reference !== 'string' || !/^var\(--monteby-token-[a-z0-9_-]+\)$/i.test(reference)) continue;
    if (reference === boundReference || (color && /^var\(--monteby-token-colors-[a-z0-9_-]+\)$/i.test(reference))) {
      references.add(reference);
    }
  }
  const globalStyles = contract?.globalStyles || {};
  if (color) {
    for (const id of Object.keys(globalStyles.colors || {})) {
      if (!/^[a-z0-9_-]+$/i.test(id)) continue;
      references.add(`var(--gcb-color-${id})`);
      references.add(`var(--mb-${id})`);
    }
  }
  if (font) {
    for (const id of Object.keys(globalStyles.typography?.fonts || {})) {
      if (/^[a-z0-9_-]+$/i.test(id)) references.add(`var(--gcb-font-${id})`);
    }
  }
  const typographyFields = {
    fontsize: 'font-size', fontweight: 'font-weight', lineheight: 'line-height',
    letterspacing: 'letter-spacing', texttransform: 'text-transform',
  };
  const typographyField = font ? 'font-family' : Object.entries(typographyFields)
    .find(([suffix]) => prop.toLowerCase().endsWith(suffix))?.[1];
  if (typographyField && !color) {
    for (const id of Object.keys(globalStyles.typography?.presets || {})) {
      if (/^[a-z0-9_-]+$/i.test(id)) references.add(`var(--gcb-typo-${id}-${typographyField})`);
    }
  }
  if (component === 'Section' && prop === 'innerMaxWidth' && contract?.designTokens?.layout?.contentWidth) {
    references.add('var(--monteby-token-layout-content-width)');
  }
  return references;
}

function schemaValidation(value, schema, path = 'value') {
  if (!isRecord(schema)) {
    return { valid: false, contractError: true, reason: `${path}: schema must be an object` };
  }
  const supported = new Set([
    'type', 'const', 'oneOf', 'minimum', 'maximum', 'minLength', 'maxLength',
    'minItems', 'maxItems', 'items', 'enum', 'additionalProperties', 'required', 'properties',
  ]);
  const unsupported = Object.keys(schema).filter((key) => !supported.has(key));
  if (unsupported.length > 0) {
    return { valid: false, contractError: true, reason: `${path}: unsupported schema fields ${unsupported.join(', ')}` };
  }
  if (hasOwn(schema, 'oneOf')) {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length === 0) {
      return { valid: false, contractError: true, reason: `${path}.oneOf must be a non-empty array` };
    }
    const results = schema.oneOf.map((candidate, index) => schemaValidation(value, candidate, `${path}.oneOf[${index}]`));
    const contractFailure = results.find((result) => result.contractError);
    if (contractFailure) return contractFailure;
    return results.some((result) => result.valid)
      ? { valid: true }
      : { valid: false, reason: `${path} does not match any published schema` };
  }
  if (hasOwn(schema, 'const') && !sameJsonValue(value, schema.const)) {
    return { valid: false, reason: `${path} does not match the published constant` };
  }
  if (hasOwn(schema, 'enum')) {
    if (!Array.isArray(schema.enum)) {
      return { valid: false, contractError: true, reason: `${path}.enum must be an array` };
    }
    if (!schema.enum.some((candidate) => sameJsonValue(candidate, value))) {
      return { valid: false, reason: `${path} is outside the published enum` };
    }
  }
  if (hasOwn(schema, 'type')) {
    const validTypes = new Set(['string', 'boolean', 'integer', 'number', 'array', 'object', 'null']);
    if (typeof schema.type !== 'string' || !validTypes.has(schema.type)) {
      return { valid: false, contractError: true, reason: `${path}.type is unsupported` };
    }
    const matchesType = {
      string: typeof value === 'string',
      boolean: typeof value === 'boolean',
      integer: Number.isInteger(value),
      number: typeof value === 'number' && Number.isFinite(value),
      array: Array.isArray(value),
      object: isRecord(value),
      null: value === null,
    }[schema.type];
    if (!matchesType) return { valid: false, reason: `${path} is not ${schema.type}` };
  }
  for (const key of ['minimum', 'maximum']) {
    if (!hasOwn(schema, key)) continue;
    if (typeof schema[key] !== 'number' || !Number.isFinite(schema[key])) {
      return { valid: false, contractError: true, reason: `${path}.${key} must be finite` };
    }
    if (typeof value === 'number' && (key === 'minimum' ? value < schema[key] : value > schema[key])) {
      return { valid: false, reason: `${path} violates ${key}` };
    }
  }
  for (const key of ['minLength', 'maxLength']) {
    if (!hasOwn(schema, key)) continue;
    if (!Number.isInteger(schema[key]) || schema[key] < 0) {
      return { valid: false, contractError: true, reason: `${path}.${key} must be a non-negative integer` };
    }
    if (typeof value === 'string') {
      const length = codePointLength(value);
      if (key === 'minLength' ? length < schema[key] : length > schema[key]) {
        return { valid: false, reason: `${path} violates ${key}` };
      }
    }
  }
  for (const key of ['minItems', 'maxItems']) {
    if (!hasOwn(schema, key)) continue;
    if (!Number.isInteger(schema[key]) || schema[key] < 0) {
      return { valid: false, contractError: true, reason: `${path}.${key} must be a non-negative integer` };
    }
    if (Array.isArray(value) && (key === 'minItems' ? value.length < schema[key] : value.length > schema[key])) {
      return { valid: false, reason: `${path} violates ${key}` };
    }
  }
  if (hasOwn(schema, 'items')) {
    if (!Array.isArray(value)) return { valid: false, reason: `${path} is not an array` };
    for (let index = 0; index < value.length; index += 1) {
      const result = schemaValidation(value[index], schema.items, `${path}[${index}]`);
      if (!result.valid) return result;
    }
  }
  if (hasOwn(schema, 'properties') || hasOwn(schema, 'required') || schema.additionalProperties === false) {
    if (!isRecord(value)) return { valid: false, reason: `${path} is not an object` };
    if (hasOwn(schema, 'properties') && !isRecord(schema.properties)) {
      return { valid: false, contractError: true, reason: `${path}.properties must be an object` };
    }
    if (hasOwn(schema, 'required') && (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== 'string'))) {
      return { valid: false, contractError: true, reason: `${path}.required must be a string array` };
    }
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        return { valid: false, reason: `${path}.${required} is required` };
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      const unknown = Object.keys(value).find((key) => !allowed.has(key));
      if (unknown) return { valid: false, reason: `${path}.${unknown} is not published` };
    } else if (hasOwn(schema, 'additionalProperties') && schema.additionalProperties !== true) {
      return { valid: false, contractError: true, reason: `${path}.additionalProperties must be boolean` };
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const result = schemaValidation(value[key], childSchema, `${path}.${key}`);
      if (!result.valid) return result;
    }
  }
  return { valid: true };
}

function sourceValue(contract, source, componentProps) {
  if (typeof source !== 'string' || !source.trim()) {
    return { found: false, contractError: true, reason: 'host source must be a non-empty string' };
  }
  let resolved = source;
  for (const match of source.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu)) {
    const replacement = componentProps?.[match[1]];
    if (!['string', 'number'].includes(typeof replacement) || String(replacement) === '') {
      return { found: false, reason: `host source dependency ${match[1]} is unresolved` };
    }
    resolved = resolved.replace(match[0], String(replacement));
  }
  let current = contract;
  for (const segment of resolved.split('.')) {
    if (!segment || ['__proto__', 'prototype', 'constructor'].includes(segment) || !isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false, reason: `host source ${resolved} is not published` };
    }
    current = current[segment];
  }
  return { found: true, value: current, source: resolved };
}

function sourceChoices(value) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  return Object.entries(value).map(([key, entry]) => (
    isRecord(entry) ? { key, ...entry } : { key, value: entry }
  ));
}

function choiceField(binding) {
  if (typeof binding?.valueField === 'string' && binding.valueField) return binding.valueField;
  if (binding?.kind === 'dynamic-field') return 'key';
  if (['form-destination-list', 'retention-policy'].includes(binding?.kind)) return 'id';
  if (binding?.kind === 'exact-term-set-allowlist') return 'slug';
  return '';
}

function publishedChoiceValues(choices, binding) {
  const field = choiceField(binding);
  if (!field) {
    return choices.every((choice) => ['string', 'number', 'boolean'].includes(typeof choice))
      ? choices
      : null;
  }
  return choices.flatMap((choice) => isRecord(choice) && Object.prototype.hasOwnProperty.call(choice, field)
    ? [choice[field]]
    : []);
}

function validateExactTermSets(value, choices, componentProps) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return false;
  const allowed = new Set(publishedChoiceValues(choices, { kind: 'exact-term-set-allowlist' }) || []);
  const offered = Array.isArray(componentProps?.terms) ? new Set(componentProps.terms) : null;
  const seen = new Set();
  for (const item of value) {
    const terms = item.split(',').filter(Boolean);
    const canonical = [...new Set(terms)].sort().join(',');
    if (!canonical || canonical !== item || seen.has(item)) return false;
    if (componentProps?.selectionMode !== 'multiple' && terms.length > 1) return false;
    if (terms.some((term) => !allowed.has(term) || (offered && offered.size > 0 && !offered.has(term)))) return false;
    seen.add(item);
  }
  return componentProps?.indexPolicy === 'allowlist' || value.length === 0;
}

function validateTaxonomyBinding(value, binding, context) {
  if (!Array.isArray(value)) return false;
  for (const filter of value) {
    if (!isRecord(filter)) return false;
    const taxonomySource = sourceValue(context.contract, binding.taxonomySource, context.componentProps);
    if (!taxonomySource.found) return false;
    const taxonomyChoices = sourceChoices(taxonomySource.value);
    const taxonomyValues = taxonomyChoices && publishedChoiceValues(taxonomyChoices, { valueField: 'name' });
    if (!taxonomyValues?.includes(filter.taxonomy)) return false;
    const termSource = sourceValue(context.contract, binding.termSource, { ...context.componentProps, taxonomy: filter.taxonomy });
    if (!termSource.found) return false;
    const termChoices = sourceChoices(termSource.value);
    const termValues = termChoices && publishedChoiceValues(termChoices, { valueField: 'id' });
    if (!Array.isArray(filter.terms) || filter.terms.some((term) => !termValues?.includes(term))) return false;
  }
  return true;
}

function validateHostBinding(control, value, options) {
  const metadata = control?.[CONTROL_CONTEXT];
  if (metadata?.metadataError) {
    return { valid: false, contractError: true, reason: 'component host/value metadata is malformed' };
  }
  const binding = metadata?.hostBinding;
  const controlSource = typeof control?.source === 'string' ? control.source : '';
  if (!isRecord(binding) && !controlSource) {
    if (!metadata?.hostScoped) return { valid: true };
    const boundedHostNumber = control.type === 'number'
      && Number.isInteger(control.min)
      && control.min >= 0
      && Number.isInteger(control.max)
      && control.max >= control.min
      && control.step === 1;
    return boundedHostNumber
      ? { valid: true }
      : { valid: false, contractError: true, reason: 'host-scoped prop has no published binding or bounded numeric reference rule' };
  }
  const effective = isRecord(binding) ? binding : { source: controlSource };
  const supportedBindingFields = new Set([
    'source', 'valueField', 'dependsOn', 'emptyValue', 'prefix', 'kind', 'target',
    'itemFields', 'schema', 'taxonomySource', 'termSource', 'assignedWhen', 'excludeValues',
  ]);
  const unsupportedBindingFields = Object.keys(effective).filter((key) => !supportedBindingFields.has(key));
  if (unsupportedBindingFields.length > 0) {
    return { valid: false, contractError: true, reason: `host binding contains unsupported fields ${unsupportedBindingFields.join(', ')}` };
  }
  for (const key of ['source', 'valueField', 'dependsOn', 'prefix', 'kind', 'target', 'taxonomySource', 'termSource']) {
    if (hasOwn(effective, key) && (typeof effective[key] !== 'string' || !effective[key].trim())) {
      return { valid: false, contractError: true, reason: `host binding ${key} must be a non-empty string` };
    }
  }
  if (typeof effective.dependsOn === 'string'
      && typeof effective.source === 'string'
      && !effective.source.includes(`{${effective.dependsOn}}`)) {
    return { valid: false, contractError: true, reason: 'host binding dependsOn does not match its source placeholder' };
  }
  if (hasOwn(effective, 'itemFields') && !isRecord(effective.itemFields)) {
    return { valid: false, contractError: true, reason: 'host binding itemFields must be an object' };
  }
  if (isRecord(effective.itemFields)
      && Object.values(effective.itemFields).some((itemBinding) => !isRecord(itemBinding))) {
    return { valid: false, contractError: true, reason: 'host binding itemFields entries must be objects' };
  }
  if (hasOwn(effective, 'excludeValues')
      && (!Array.isArray(effective.excludeValues)
        || effective.excludeValues.some((item) => !['string', 'number', 'boolean'].includes(typeof item)))) {
    return { valid: false, contractError: true, reason: 'host binding excludeValues must be a scalar array' };
  }
  if (hasOwn(effective, 'assignedWhen')) {
    const assigned = effective.assignedWhen;
    if (!isRecord(assigned)
        || Object.keys(assigned).some((key) => !['field', 'minimum'].includes(key))
        || typeof assigned.field !== 'string'
        || !assigned.field
        || typeof assigned.minimum !== 'number'
        || !Number.isFinite(assigned.minimum)) {
      return { valid: false, contractError: true, reason: 'host binding assignedWhen is malformed' };
    }
  }
  if (hasOwn(effective, 'kind')
      && !['dynamic-field', 'form-destination-list', 'retention-policy', 'exact-term-set-allowlist'].includes(effective.kind)) {
    return { valid: false, contractError: true, reason: 'host binding kind is unsupported' };
  }
  if (controlSource && isRecord(binding) && typeof binding.source === 'string' && controlSource !== binding.source) {
    return { valid: false, contractError: true, reason: 'control source and host binding source differ' };
  }
  if (hasOwn(effective, 'schema')) {
    const schema = schemaValidation(value, effective.schema, metadata?.path || 'value');
    if (!schema.valid && (schema.contractError || options?.metadataOnly !== true)) return schema;
  }
  if (options?.metadataOnly === true) return { valid: true };
  if (hasOwn(effective, 'emptyValue') && sameJsonValue(value, effective.emptyValue)) return { valid: true };
  if (isRecord(effective.itemFields)) return { valid: true };
  const context = {
    contract: metadata?.contract,
    componentProps: options?.componentProps || {},
  };
  if (typeof effective.taxonomySource === 'string' || typeof effective.termSource === 'string') {
    return validateTaxonomyBinding(value, effective, context)
      ? { valid: true }
      : { valid: false, reason: 'value does not match the published taxonomy and term sources' };
  }
  const resolved = sourceValue(context.contract, effective.source || controlSource, context.componentProps);
  if (!resolved.found) return { valid: false, contractError: resolved.contractError, reason: resolved.reason };
  const choices = sourceChoices(resolved.value);
  if (!choices) return { valid: false, contractError: true, reason: `host source ${resolved.source} is not a collection` };
  if (effective.kind === 'exact-term-set-allowlist') {
    return validateExactTermSets(value, choices, context.componentProps)
      ? { valid: true }
      : { valid: false, reason: 'value is not a canonical published exact term set' };
  }
  const values = publishedChoiceValues(choices, effective);
  if (!values) return { valid: false, contractError: true, reason: 'host binding does not publish a valueField' };
  if (effective.kind === 'form-destination-list' || Array.isArray(value)) {
    if (!Array.isArray(value) || value.some((item) => !values.some((choice) => sameJsonValue(choice, item)))) {
      return { valid: false, reason: 'list contains a value outside the published host choices' };
    }
    return { valid: true };
  }
  let matchingChoices = choices;
  if (isRecord(effective.assignedWhen)) {
    const field = effective.assignedWhen.field;
    const minimum = effective.assignedWhen.minimum;
    if (typeof field !== 'string' || typeof minimum !== 'number') {
      return { valid: false, contractError: true, reason: 'assignedWhen is malformed' };
    }
    matchingChoices = choices.filter((choice) => isRecord(choice) && typeof choice[field] === 'number' && choice[field] >= minimum);
  }
  if (typeof effective.prefix === 'string') {
    const field = choiceField(effective);
    matchingChoices = matchingChoices.filter((choice) => (
      isRecord(choice)
      && typeof choice[field] === 'string'
      && choice[field].startsWith(effective.prefix)
    ));
  }
  if (typeof effective.target === 'string') {
    matchingChoices = matchingChoices.filter((choice) => (
      isRecord(choice) && choice.target === effective.target
    ));
  }
  const excludedValues = Array.isArray(effective.excludeValues) ? effective.excludeValues : [];
  const matchingValues = publishedChoiceValues(matchingChoices, effective)?.filter((choice) => (
    !excludedValues.some((excluded) => sameJsonValue(excluded, choice))
  ));
  return matchingValues?.some((choice) => sameJsonValue(choice, value))
    ? { valid: true }
    : { valid: false, reason: 'value is outside the exact published host choices' };
}

function validatePublishedValueSchema(control, value) {
  const context = control?.[CONTROL_CONTEXT];
  if (!context?.hasPublishedValueSchemas) {
    return {
      valid: true,
      defaultMatch: context?.hasDefault === true && sameJsonValue(value, context.defaultValue),
    };
  }
  if (!context.hasDefault) {
    return { valid: true, defaultMatch: false };
  }
  if (!isRecord(context.valueSchema)) {
    return { valid: false, contractError: true, reason: 'component valueSchemas do not cover the published default' };
  }
  const defaultSchema = schemaValidation(context.defaultValue, context.valueSchema, `${context.componentName}.${context.prop}.default`);
  if (!defaultSchema.valid) {
    return { ...defaultSchema, contractError: true, reason: `published default violates valueSchemas: ${defaultSchema.reason}` };
  }
  return { valid: true, defaultMatch: sameJsonValue(value, context.defaultValue) };
}

function controlContractValidation(control) {
  if (!isRecord(control) || typeof control.type !== 'string' || !control.type.trim()) {
    return { valid: false, reason: 'kontrolka nie publikuje typu' };
  }
  for (const key of ['min', 'max', 'step']) {
    if (hasOwn(control, key) && (typeof control[key] !== 'number' || !Number.isFinite(control[key]))) {
      return { valid: false, reason: `${key} kontrolki musi być skończoną liczbą` };
    }
  }
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems', 'columns', 'maxColumns']) {
    if (hasOwn(control, key) && (!Number.isInteger(control[key]) || control[key] < 0)) {
      return { valid: false, reason: `${key} kontrolki musi być nieujemną liczbą całkowitą` };
    }
  }
  for (const [minimum, maximum] of [['min', 'max'], ['minLength', 'maxLength'], ['minItems', 'maxItems']]) {
    if (hasOwn(control, minimum) && hasOwn(control, maximum) && control[minimum] > control[maximum]) {
      return { valid: false, reason: `${minimum} kontrolki przekracza ${maximum}` };
    }
  }
  for (const key of ['allowEmpty', 'atomic', 'uniqueItems']) {
    if (hasOwn(control, key) && typeof control[key] !== 'boolean') {
      return { valid: false, reason: `${key} kontrolki musi być wartością logiczną` };
    }
  }
  if (hasOwn(control, 'source') && (typeof control.source !== 'string' || !control.source.trim())) {
    return { valid: false, reason: 'source kontrolki musi być niepustym tekstem' };
  }
  if (hasOwn(control, 'units') && (!Array.isArray(control.units) || control.units.some((unit) => typeof unit !== 'string'))) {
    return { valid: false, reason: 'units kontrolki musi być listą tekstów' };
  }
  if (hasOwn(control, 'pattern')) {
    if (typeof control.pattern !== 'string' || control.pattern.length > 512) {
      return { valid: false, reason: 'pattern kontrolki jest nieprawidłowy' };
    }
    try {
      new RegExp(control.pattern, 'u');
    } catch {
      return { valid: false, reason: 'pattern kontrolki nie jest prawidłowym wyrażeniem regularnym' };
    }
  }
  if (['object', 'repeater'].includes(control.type) && nestedControlEntries(control).length === 0) {
    return { valid: false, reason: `${control.type} nie publikuje zagnieżdżonych kontrolek` };
  }
  return { valid: true };
}

function normalizeTextValue(control, value) {
  if (!['string', 'number', 'boolean'].includes(typeof value)) {
    return { accepted: false, reason: `${JSON.stringify(value)} nie jest tekstową wartością skalarną` };
  }
  const normalized = String(value);
  const length = codePointLength(normalized);
  if (typeof control.minLength === 'number' && length < control.minLength) {
    return { accepted: false, reason: `tekst jest krótszy niż minLength ${control.minLength}` };
  }
  if (typeof control.maxLength === 'number' && length > control.maxLength) {
    return { accepted: false, reason: `tekst jest dłuższy niż maxLength ${control.maxLength}` };
  }
  if (typeof control.pattern === 'string' && !new RegExp(control.pattern, 'u').test(normalized)) {
    return { accepted: false, reason: `${JSON.stringify(normalized)} nie spełnia wzorca kontrolki` };
  }
  return {
    accepted: true,
    value: normalized,
    ...(normalized !== value ? { changed: true, changeReason: `${JSON.stringify(value)} → ${JSON.stringify(normalized)}` } : {}),
  };
}

function nestedControlMap(control) {
  const controls = new Map();
  for (const nested of nestedControlEntries(control)) {
    for (const prop of controlProps(nested)) {
      if (!controls.has(prop)) controls.set(prop, nested);
    }
  }
  return controls;
}

function normalizeNestedObject(control, value, publishedReferences, options, label) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return { accepted: false, reason: `${label} musi być niepustym obiektem` };
  }
  const controls = nestedControlMap(control);
  const unknown = Object.keys(value).find((key) => !controls.has(key));
  if (unknown) return { accepted: false, reason: `${label}.${unknown} nie jest opublikowanym polem` };
  const normalized = {};
  let changed = false;
  for (const [key, item] of Object.entries(value)) {
    const result = normalizeControlValue(controls.get(key), item, publishedReferences, options);
    if (!result.accepted) return result;
    normalized[key] = result.value;
    changed ||= result.changed === true;
  }
  if (control.atomic === true && changed) {
    return { accepted: false, reason: `${label} jest atomowy i wymagałby normalizacji` };
  }
  return {
    accepted: true,
    value: normalized,
    ...(changed ? { changed: true, changeReason: `${label}: znormalizowano zagnieżdżone wartości` } : {}),
  };
}

function normalizeCollection(control, value, publishedReferences, options) {
  if (!Array.isArray(value)) return { accepted: false, reason: `${JSON.stringify(value)} nie jest listą` };
  if (typeof control.minItems === 'number' && value.length < control.minItems) {
    return { accepted: false, reason: `lista ma mniej niż minItems ${control.minItems}` };
  }
  if (typeof control.maxItems === 'number' && value.length > control.maxItems) {
    return { accepted: false, reason: `lista ma więcej niż maxItems ${control.maxItems}` };
  }
  if (control.type === 'tag-list') {
    if (value.some((item) => typeof item !== 'string' || !item.trim())) {
      return { accepted: false, reason: 'tag-list przyjmuje wyłącznie niepuste teksty' };
    }
    const normalized = value.map((item) => item.trim());
    if (control.uniqueItems !== false && new Set(normalized).size !== normalized.length) {
      return { accepted: false, reason: 'tag-list nie dopuszcza duplikatów' };
    }
    if (typeof control.pattern === 'string' && normalized.some((item) => !new RegExp(control.pattern, 'u').test(item))) {
      return { accepted: false, reason: 'element tag-list nie spełnia wzorca kontrolki' };
    }
    const changed = normalized.some((item, index) => item !== value[index]);
    return {
      accepted: true,
      value: normalized,
      ...(changed ? { changed: true, changeReason: 'przycięto białe znaki tag-list' } : {}),
    };
  }
  if (control.type === 'string-matrix') {
    for (const row of value) {
      if (!Array.isArray(row) || row.some((cell) => typeof cell !== 'string')) {
        return { accepted: false, reason: 'string-matrix wymaga list wierszy tekstowych' };
      }
      if (typeof control.columns === 'number' && row.length !== control.columns) {
        return { accepted: false, reason: `wiersz string-matrix musi mieć ${control.columns} pól` };
      }
      if (typeof control.maxColumns === 'number' && row.length > control.maxColumns) {
        return { accepted: false, reason: `wiersz string-matrix przekracza maxColumns ${control.maxColumns}` };
      }
    }
    return { accepted: true, value };
  }
  if (control.type !== 'repeater') return { accepted: true, value };
  const normalized = [];
  let changed = false;
  for (let index = 0; index < value.length; index += 1) {
    const item = normalizeNestedObject(control, value[index], publishedReferences, options, `repeater[${index}]`);
    if (!item.accepted) return item;
    normalized.push(item.value);
    changed ||= item.changed === true;
  }
  if (control.atomic === true && changed) {
    return { accepted: false, reason: 'repeater jest atomowy i wymagałby normalizacji' };
  }
  return {
    accepted: true,
    value: normalized,
    ...(changed ? { changed: true, changeReason: 'znormalizowano zagnieżdżone wartości repeatera' } : {}),
  };
}

function validateLinkValue(control, value) {
  const prop = control?.[CONTROL_CONTEXT]?.prop;
  if (typeof prop !== 'string' || prop === '') return { valid: true };
  const dynamic = prop.startsWith('dynamic') && (prop.endsWith('Href') || prop.endsWith('Url'));
  const link = !dynamic && (
    prop === 'href'
    || prop === 'url'
    || prop.endsWith('Href')
    || ['linkUrl', 'ctaUrl', 'redirectUrl'].includes(prop)
  );
  if (!dynamic && !link) return { valid: true };
  if (!['string', 'number'].includes(typeof value) || !Number.isFinite(typeof value === 'number' ? value : 0)) {
    return { valid: false, reason: 'odnośnik musi być wartością tekstową' };
  }
  const raw = String(value).trim();
  if (raw === '') return { valid: true };
  if (dynamic) {
    return /^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+){0,2}$/u.test(raw)
      ? { valid: true }
      : { valid: false, reason: 'dynamiczny odnośnik musi być kluczem opublikowanego pola' };
  }
  if (CONTROL_CHARACTER_PATTERN.test(raw)) {
    return { valid: false, reason: 'odnośnik zawiera znak sterujący' };
  }
  return /^(?:https?:\/\/|\/|\.\/|\.\.\/|\?|mailto:|tel:|#)/iu.test(raw)
    ? { valid: true }
    : { valid: false, reason: 'odnośnik nie przechodzi polityki bezpiecznych adresów renderera' };
}

function rendererColorIsSafe(value) {
  if (typeof value !== 'string') return false;
  const color = value.trim();
  return /^#[0-9a-f]{3,8}$/iu.test(color)
    || CSS_COLOR_KEYWORDS.has(color.toLowerCase())
    || /^rgba?\([0-9.,\s%]+\)$/iu.test(color);
}

function normalizeRendererColor(value, label) {
  if (!['string', 'number', 'boolean'].includes(typeof value)) {
    return { accepted: false, reason: `${label} nie jest skalarnym kolorem` };
  }
  const color = String(value).trim();
  if (color === '') return { accepted: true, value: '' };
  if (!rendererColorIsSafe(color)) {
    return { accepted: false, reason: `${label} nie jest kolorem obsługiwanym przez renderer` };
  }
  return {
    accepted: true,
    value: color,
    ...(color !== value ? { changed: true, changeReason: `${label} → ${JSON.stringify(color)}` } : {}),
  };
}

function splitFontStack(value) {
  const families = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== '') {
      if (character === '\\') {
        if (index + 1 >= value.length) return null;
        current += character + value[index + 1];
        index += 1;
        continue;
      }
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ',') {
      families.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (quote !== '') return null;
  families.push(current.trim());
  return families;
}

function normalizeFontFamilyName(value) {
  let family = value.trim();
  if (family === '') return '';
  const first = family[0];
  const last = family[family.length - 1];
  if (['"', "'"].includes(first) || ['"', "'"].includes(last)) {
    if (first !== last || !['"', "'"].includes(first)) return null;
    family = family.slice(1, -1).trim();
  }
  if (family.toLowerCase().startsWith('_system_')) return '';
  family = family.replace(/_/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (family === '') return '';
  if (Buffer.byteLength(family, 'utf8') > 80 || !/^[A-Za-z0-9][A-Za-z0-9 .'-]*$/u.test(family)) return null;
  return SYSTEM_FONT_FAMILIES.has(family.toLowerCase()) ? '' : family;
}

function fontValueIsPublished(control, value) {
  const contract = control?.[CONTROL_CONTEXT]?.contract;
  if (!isRecord(contract)) return { valid: true };
  const catalog = contract.fontCatalog;
  if (!isRecord(catalog)
      || catalog.version !== 1
      || !isRecord(catalog.system)
      || !isRecord(catalog.google)
      || !isRecord(catalog.local)
      || !Array.isArray(catalog.local.choices)) {
    return { valid: false, contractError: true, reason: 'live contract nie publikuje kompletnego fontCatalog' };
  }
  if (hasOwn(catalog.system, value)) return { valid: true };
  if (catalog.local.choices.some((choice) => (
    isRecord(choice) && typeof choice.value === 'string' && choice.value.toLowerCase() === value.toLowerCase()
  ))) {
    return { valid: true };
  }
  if (value.includes('(') || value.includes(')') || value.includes(';')) {
    return { valid: false, reason: 'font zawiera niedozwoloną składnię CSS' };
  }
  const families = splitFontStack(value);
  if (!families) return { valid: false, reason: 'stos fontów ma nieprawidłowe cudzysłowy' };
  const google = new Set(Object.entries(catalog.google).flatMap(([key, entry]) => (
    typeof entry?.family === 'string' ? [key.toLowerCase(), entry.family.toLowerCase()] : [key.toLowerCase()]
  )));
  for (const rawFamily of families) {
    const family = normalizeFontFamilyName(rawFamily);
    if (family === null || (family !== '' && !google.has(family.toLowerCase()))) {
      return { valid: false, reason: `${JSON.stringify(rawFamily)} nie występuje w bieżącym fontCatalog` };
    }
  }
  return { valid: true };
}

function normalizeCustomValue(control, value, label) {
  if (!['string', 'number', 'boolean'].includes(typeof value)
      || (typeof value === 'number' && !Number.isFinite(value))) {
    return { accepted: false, reason: `${label} nie jest skalarną wartością kontrolki custom` };
  }
  const context = control?.[CONTROL_CONTEXT];
  if (context?.hasDefault === true) {
    const defaultValue = context.defaultValue;
    if ((typeof defaultValue === 'boolean' && typeof value !== 'boolean')
        || (typeof defaultValue === 'number' && typeof value !== 'number')) {
      return { accepted: false, reason: `${label} nie ma typu opublikowanej wartości domyślnej` };
    }
  }
  if (typeof value === 'string' && CUSTOM_CONTROL_CHARACTER_PATTERN.test(value)) {
    return { accepted: false, reason: 'wartość custom zawiera niedozwolony znak sterujący' };
  }
  if (context?.prop === 'tag') {
    const tag = String(value).trim().toLowerCase();
    if (tag !== '' && !ALLOWED_AUTHORING_TAGS.has(tag)) {
      return { accepted: false, reason: `${JSON.stringify(tag)} nie jest tagiem obsługiwanym przez renderer` };
    }
  }
  return { accepted: true, value };
}

function normalizeControlValue(control, value, publishedReferences = new Set(), options = {}) {
  if (!isRecord(control)) return { accepted: true, value };
  const label = JSON.stringify(value);
  const type = String(control.type || '');
  const values = optionValues(control.options);

  const validContract = controlContractValidation(control);
  if (!validContract.valid) {
    return { accepted: false, contractError: true, reason: `kontrakt kontrolki jest nieprawidłowy: ${validContract.reason}` };
  }
  const hostContract = validateHostBinding(control, value, { ...options, metadataOnly: true });
  if (!hostContract.valid) {
    return { accepted: false, contractError: true, reason: hostContract.reason };
  }
  const link = validateLinkValue(control, value);
  if (!link.valid) {
    return { accepted: false, reason: link.reason };
  }
  const publishedSchema = validatePublishedValueSchema(control, value);
  if (!publishedSchema.valid) {
    return { accepted: false, contractError: true, reason: publishedSchema.reason };
  }
  if (publishedSchema.defaultMatch && type !== 'icon-svg') return { accepted: true, value };

  const host = validateHostBinding(control, value, options);
  if (!host.valid) {
    return { accepted: false, contractError: host.contractError === true, reason: host.reason };
  }

  if (typeof value === 'string' && /^var\s*\(/iu.test(value.trim())) {
    const reference = value.trim();
    return publishedReferences.has(reference)
      ? { accepted: true, value: reference }
      : { accepted: false, reason: `nieopublikowana referencja CSS ${label}` };
  }
  if (type === 'icon-svg') {
    if (typeof value !== 'string') {
      return { accepted: false, reason: `${label} nie jest nazwą natywnej ikony` };
    }
    let iconCatalog;
    try {
      iconCatalog = validateIconCatalog(control[CONTROL_CONTEXT]?.contract);
    } catch {
      return {
        accepted: false,
        contractError: true,
        reason: 'kontrolka icon-svg nie ma kompletnego katalogu ikon związanego SHA',
      };
    }
    const icon = value.trim();
    if (icon === '') return { accepted: true, value: '' };
    if (icon.length > 64 || !/^[a-z0-9_]+$/u.test(icon)) {
      return { accepted: false, reason: `${label} nie jest nazwą Material Symbols` };
    }
    return iconCatalog.iconSet.has(icon)
      ? {
        accepted: true,
        value: icon,
        ...(icon !== value ? { changed: true, changeReason: `${JSON.stringify(value)} → ${JSON.stringify(icon)}` } : {}),
      }
      : { accepted: false, reason: `${JSON.stringify(icon)} nie występuje w bieżącym iconCatalog` };
  }
  if (value === '' && control.allowEmpty === true) return { accepted: true, value: '' };
  if (values.length > 0 && ['custom', 'select', 'segment'].includes(type)
      && !values.some((option) => String(option) === String(value))) {
    return { accepted: false, reason: `${label} spoza ${JSON.stringify(values)}` };
  }
  if (['text', 'textarea'].includes(type)) {
    return normalizeTextValue(control, value);
  }
  if (type === 'custom') {
    const custom = normalizeCustomValue(control, value, label);
    if (!custom.accepted) return custom;
    if (hasOwn(control, 'pattern') || hasOwn(control, 'minLength') || hasOwn(control, 'maxLength')) {
      return normalizeTextValue(control, custom.value);
    }
    return custom;
  }
  if (type === 'border-color') {
    const prop = control?.[CONTROL_CONTEXT]?.prop || '';
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return { accepted: false, reason: `${label} nie jest skalarną wartością obramowania` };
    }
    const scalar = String(value).trim();
    if (scalar === '') return { accepted: true, value: '' };
    if (prop.endsWith('Mode')) {
      return ['all', 'sides'].includes(scalar)
        ? { accepted: true, value: scalar }
        : { accepted: false, reason: 'tryb koloru obramowania musi mieć wartość all albo sides' };
    }
    return normalizeRendererColor(value, label);
  }
  if (type === 'color') {
    return normalizeRendererColor(value, label);
  }
  if (type === 'font-picker') {
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      return { accepted: false, reason: `${label} nie jest skalarną nazwą fontu` };
    }
    const font = String(value).trim();
    if (font === '') return { accepted: true, value: '' };
    if (Buffer.byteLength(font, 'utf8') > 2048) {
      return { accepted: false, reason: 'wartość fontu przekracza opublikowany limit' };
    }
    const published = fontValueIsPublished(control, font);
    if (!published.valid) {
      return { accepted: false, contractError: published.contractError === true, reason: published.reason };
    }
    return {
      accepted: true,
      value: font,
      ...(font !== value ? { changed: true, changeReason: `${label} → ${JSON.stringify(font)}` } : {}),
    };
  }
  if (type === 'media' && !['string', 'number', 'boolean'].includes(typeof value)) {
    return { accepted: false, reason: `${label} nie jest skalarnym odwołaniem do medium` };
  }
  if (type === 'toggle' && typeof value !== 'boolean') {
    return { accepted: false, reason: `${label} nie jest wartością logiczną` };
  }
  if (type === 'number') {
    if (value === '') return { accepted: false, reason: 'pusta liczba wymaga allowEmpty lub opublikowanej wartości domyślnej' };
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return { accepted: false, reason: `${label} nie jest liczbą` };
    const stepBase = typeof control.min === 'number' ? control.min : 0;
    let normalized = typeof control.step === 'number' && control.step > 0
      ? snap(numeric, control.step, stepBase)
      : numeric;
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
  if (type === 'spacing' && isRecord(value)) {
    const allowedEdges = new Set(['top', 'right', 'bottom', 'left']);
    if (Object.keys(value).length === 0 || Object.keys(value).some((edge) => !allowedEdges.has(edge))) {
      return { accepted: false, reason: 'mapa spacing przyjmuje tylko top, right, bottom i left' };
    }
    const normalized = {};
    let changed = false;
    for (const [edge, edgeValue] of Object.entries(value)) {
      const result = normalizeControlValue({ ...control, type: 'css-value' }, edgeValue, publishedReferences, options);
      if (!result.accepted) return result;
      normalized[edge] = result.value;
      changed ||= result.changed === true;
    }
    return {
      accepted: true,
      value: normalized,
      ...(changed ? { changed: true, changeReason: 'znormalizowano krawędzie spacing' } : {}),
    };
  }
  if (['css-value', 'spacing'].includes(type) && typeof value === 'string') {
    if (value.trim() === '') {
      return { accepted: false, reason: 'pusta wartość CSS wymaga allowEmpty lub opublikowanej wartości domyślnej' };
    }
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
    if (typeof control.step === 'number' && control.step > 0) {
      numeric = snap(numeric, control.step, typeof control.min === 'number' ? control.min : 0);
    }
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
  if (type === 'object') {
    return normalizeNestedObject(control, value, publishedReferences, options, 'object');
  }
  if (['repeater', 'tag-list', 'string-matrix'].includes(type)) {
    return normalizeCollection(control, value, publishedReferences, options);
  }
  if (hasOwn(control, 'pattern') || hasOwn(control, 'minLength') || hasOwn(control, 'maxLength')) {
    return normalizeTextValue(control, value);
  }
  return { accepted: true, value };
}

module.exports = {
  buildControlIndex,
  collectControlMetadata,
  controlProps,
  nestedControlMap,
  normalizeControlValue,
  publishedControlReferences,
  optionValues,
  validateButtonFormPrefillRelationships,
  validateQueryControlRelationships,
};
