/**
 * layout-kit.mjs
 *
 * Buduje node mapę Monteby deklaratywnie. Kit pilnuje kontraktu i pułapek
 * renderera, więc autor pisze wyłącznie strukturę i treść.
 *
 * Wbudowane (bez konfiguracji):
 *   - odrzucenie komponentu/propa spoza kontraktu i propa zablokowanego,
 *   - sprawdzenie allowedParents przy każdym zagnieżdżeniu,
 *   - normalizacja wartości wg kontrolki (step, min/max, options, liczba vs tekst),
 *   - walidacja repeaterów (np. backgroundLayers, FormBlock.fields/steps):
 *     klucze pozycji tylko z itemControls kontraktu, wartości dociągane
 *     do zagnieżdżonych kontrolek,
 *   - marginTop: 0 na tekstach (motyw dokłada 1em),
 *   - borderWidth: 0 przy pojedynczej krawędzi (inaczej renderer obrysuje pudełko),
 *   - twarda blokada backgroundVideo bez backgroundVideoPoster (budżet
 *     wydajności) i uwaga o domyślnej polityce mobilnej "poster",
 *   - uwaga, gdy sectionRhythmPreset miesza się z ręcznymi paddingami,
 *   - ostrzeżenia dla ListBlock/FormBlock/ImageBlock i jednowartościowego gap.
 *
 * Użycie:
 *   import { Kit } from './layout-kit.mjs';
 *   const k = await Kit.fromContract('./contract.json');
 *   const hero = k.section({ background: '#0a0b0d', paddingTop: '104px' }, [
 *     k.heading('Tytuł', { tag: 'h1', fontSize: '78px', textColor: '#fff' }),
 *     k.text('Lead…', { fontSize: '20px', textColor: '#e6e2da' }),
 *     k.button('Kontakt', '#kontakt', { backgroundColor: '#ffbe00', textColor: '#0a0b0d' }),
 *   ]);
 *   await k.write('./layout.json', [hero]);   // zgłasza wyjątek, jeśli są błędy
 */

import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import designProfileModule from './resolved-design-profile.js';
import controlContractModule from './control-contract.js';
import motionContractModule from './motion-contract.js';

const {
  UNMEASURED_CONTENT_SECTION_DEFAULTS,
  applyResolvedDesignDefaults,
  buildResolvedDesignProfile,
  effectiveTypographyValue,
  tokenReference,
} = designProfileModule;
const {
  buildControlIndex,
  nestedControlMap,
  normalizeControlValue,
  publishedControlReferences,
  validateButtonFormPrefillRelationships,
  validateQueryControlRelationships,
} = controlContractModule;
const { applySemanticMotionPlan } = motionContractModule;

const TEXT_NODES = new Set(['Heading', 'Text', 'MultilineHeading']);
const EDGE_WIDTHS = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];
const ANCHOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export class Kit {
  constructor(contract, options = {}) {
    this.contract = contract;
    this.designProfile = buildResolvedDesignProfile(contract, options.projectTokens || {});
    this.components = new Map((contract.components || []).map((c) => [c.name, c]));
    this.blocked = new Set(contract.authoring?.blockedProps || []);
    this.rootComponents = new Set(contract.authoring?.topLevelRootComponents || ['Section']);
    this.controls = buildControlIndex(contract);
    this.repeaterItemControls = new Map(
      [...this.controls.entries()]
        .map(([key, control]) => [key, nestedControlMap(control)])
        .filter(([, controls]) => controls.size > 0)
    );
    this.nodes = {};
    this.counter = 0;
    this.initialNotes = this.designProfile.rejectedProjectTokens.map((key) => `project-token-rejected: ${key}; provide a safe literal or published token reference`);
    this.initialNotes.push(...this.designProfile.conflicts.map((conflict) => (
      `${conflict.code}: ${conflict.token}; globalStyles=${conflict.globalStylesValue}; designTokens=${conflict.designTokensValue}`
    )));
    this.notes = [...this.initialNotes];
    this.publishedReferences = new Set(
      Object.values(this.designProfile.tokens).map((token) => token.reference).filter(Boolean)
    );
  }

  static async fromContract(path, options = {}) {
    return new Kit(JSON.parse(await readFile(path, 'utf8')), options);
  }

  /**
   * Świeży kontrakt z działającej instalacji — zawsze preferowany.
   * Uwierzytelnienie może wskazać wyłącznie nazwę zmiennej środowiskowej:
   * Kit.fromSite(url, { authEnv: 'MONTEBY_WP_AUTH' }).
   */
  static async fromSite(baseUrl, options = {}) {
    if (!options || Array.isArray(options) || typeof options !== 'object') {
      throw new Error(
        'blocked_secrets: nie przekazuj poświadczeń jako argumentu; wskaż wyłącznie { authEnv: "NAZWA_ZMIENNEJ" }'
      );
    }
    const unknownOptions = Object.keys(options).filter((key) => key !== 'authEnv');
    if (unknownOptions.length > 0) {
      throw new Error(
        `blocked_secrets: niedozwolone opcje uwierzytelnienia: ${unknownOptions.join(', ')}; dozwolone jest tylko authEnv`
      );
    }
    const authEnv = options.authEnv;
    if (authEnv !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(authEnv)) {
      throw new Error('blocked_secrets: authEnv musi być nazwą zmiennej środowiskowej, nie wartością poświadczeń');
    }
    const auth = authEnv === undefined ? '' : process.env[authEnv];
    if (authEnv !== undefined && !auth) {
      throw new Error(`blocked_secrets: zmienna środowiskowa ${authEnv} nie jest ustawiona`);
    }
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/wp-json/monteby/v1/contract`, {
      headers: auth ? { Authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {},
    });
    if (!response.ok) throw new Error(`Kontrakt niedostępny: HTTP ${response.status}`);
    return new Kit(await response.json());
  }

  #normalize(component, prop, value, componentProps) {
    const control = this.controls.get(`${component}.${prop}`);
    if (!control) return value;
    return this.#normalizeControlValue(
      control,
      `${component}.${prop}`,
      value,
      publishedControlReferences(this.contract, component, prop, control),
      componentProps
    );
  }

  #normalizeControlValue(control, label, value, references, componentProps) {
    const result = normalizeControlValue(control, value, references, { componentProps });
    if (!result.accepted) {
      this.notes.push(`${label}: ${result.reason}, pominięte`);
      return undefined;
    }
    if (result.changed) this.notes.push(`${label}: ${result.changeReason || `${JSON.stringify(value)} → ${JSON.stringify(result.value)}`}`);
    return result.value;
  }

  /** Dowolny komponent z kontraktu. */
  node(component, props = {}, children = [], semanticRole = '') {
    const definition = this.components.get(component);
    if (!definition) throw new Error(`Komponent spoza kontraktu: ${component}`);

    const allowed = new Set(definition.props || []);
    const out = {};
    const resolvedProps = applyResolvedDesignDefaults(
      component,
      props,
      this.designProfile,
      semanticRole
    );
    for (const [prop, raw] of Object.entries(resolvedProps)) {
      if (raw === undefined || raw === null || (raw === '' && !/^(?:alt|.*Alt)$/.test(prop))) continue;
      if (
        typeof raw === 'string'
        && /^var\s*\(/iu.test(raw.trim())
        && (
          this.controls.has(`${component}.${prop}`)
          || /(?:color|fontFamily|fontSize|lineHeight|letterSpacing|padding|margin|radius|shadow|width|height|gap)$/iu.test(prop)
        )
        && !(this.controls.has(`${component}.${prop}`)
          ? publishedControlReferences(
            this.contract,
            component,
            prop,
            this.controls.get(`${component}.${prop}`)
          )
          : this.publishedReferences).has(raw.trim())
      ) {
        this.notes.push(`${component}.${prop}: nieopublikowana referencja CSS ${JSON.stringify(raw)}, pominięta`);
        continue;
      }
      if (this.blocked.has(prop)) throw new Error(`Prop zablokowany przez kontrakt: ${component}.${prop}`);
      if (!allowed.has(prop)) {
        if (/^(fontSize|lineHeight|letterSpacing|textAlign|marginTop|marginBottom)(Tablet|Mobile)$/.test(prop)) {
          throw new Error(
            `${component} nie wystawia wariantu responsywnego ${prop} — ten komponent ma tylko wartość bazową. `
            + 'Reguła „zawsze podawaj warianty” dotyczy wyłącznie komponentów, które je mają (Heading, Text, Container).'
          );
        }
        throw new Error(`Prop spoza kontraktu: ${component}.${prop}`);
      }
      const value = this.#normalize(component, prop, raw, resolvedProps);
      if (value !== undefined) out[prop] = value;
    }

    // pułapki renderera — naprawiane domyślnie
    if (TEXT_NODES.has(component) && out.marginTop === undefined) out.marginTop = '0px';
    if (EDGE_WIDTHS.some((edge) => edge in out) && out.borderWidth === undefined && allowed.has('borderWidth')) {
      out.borderWidth = '0px';
    }
    if (component === 'ListBlock' && Array.isArray(out.items) && out.items.some((i) => i && typeof i === 'object')) {
      throw new Error('ListBlock.items przyjmuje teksty — obiekt wywraca kanwę edytora (React #31)');
    }
    if (component === 'FormBlock' && out.formBackgroundColor === undefined) {
      this.notes.push('FormBlock bez formBackgroundColor maluje własne białe tło <form>');
    }
    if (component === 'ImageBlock') {
      if (out.height === undefined && out.aspectRatio === undefined) {
        this.notes.push('ImageBlock bez height ma zerową wysokość do czasu wczytania obrazu');
      } else if (out.height !== undefined && (out.heightTablet === undefined || out.heightMobile === undefined)) {
        // Motyw wymusza height:auto poniżej 768px selektorem o wyższej
        // specyficzności niż klasa węzła.
        this.notes.push('ImageBlock z height bez heightTablet/heightMobile — motyw wymusi height:auto poniżej 768px');
      }
    }
    if (TEXT_NODES.has(component) && !effectiveTypographyValue(out, this.designProfile, 'lineHeight')) {
      // Nagłówek bez własnej interlinii dziedziczy wartość z body motywu.
      this.notes.push(`${component} bez lineHeight dziedziczy interlinię z motywu — podaj ją jawnie`);
    }
    if (TEXT_NODES.has(component) && out.fontSize !== undefined) {
      const size = parseFloat(out.fontSize);
      if (Number.isFinite(size) && size >= 30
          && (out.fontSizeTablet === undefined || out.fontSizeMobile === undefined)) {
        // Renderer przepisuje każdy font-size >= 30px na clamp() i bez jawnych
        // wariantów rozmiar płynie między breakpointami.
        this.notes.push(`${component} fontSize ${out.fontSize} bez wariantów responsywnych — renderer nałoży clamp()`);
      }
    }
    if (out.backgroundType === 'image' && out.background !== undefined) {
      this.notes.push(`${component}: backgroundType "image" pomija kolor tła`);
    }
    if (out.backgroundVideo !== undefined || out.backgroundMedia === 'video' || out.backgroundType === 'video') {
      if (out.backgroundVideoPoster === undefined) {
        // Budżet wydajności protokołu: zakaz wideo bez posteru. Bez posteru
        // wolny transfer zostawia pustą sekcję, a mobilna polityka "poster"
        // nie ma czego pokazać.
        throw new Error(
          `${component}: backgroundVideo bez backgroundVideoPoster jest zablokowane przez budżet wydajności; podaj poster`
        );
      }
      if (out.backgroundVideoMobileBehavior === undefined) {
        this.notes.push(
          `${component}: backgroundVideoMobileBehavior nieustawione; polityka budżetu to "poster" na mobile, ustaw jawnie`
        );
      }
    }
    if (out.sectionRhythmPreset !== undefined
      && (out.paddingTop !== undefined || out.paddingBottom !== undefined)) {
      this.notes.push(
        `${component}: sectionRhythmPreset razem z ręcznym paddingTop/paddingBottom; preset ma zastępować ręczny rytm, zostaw jedno źródło`
      );
    }

    const isCanvas = Boolean(definition.isCanvas);
    this.counter += 1;
    const id = `${component.toLowerCase()}-${this.counter}`;
    const entry = { type: { resolvedName: component }, isCanvas, props: out, nodes: [] };
    this.nodes[id] = entry;

    for (const child of children) {
      if (!isCanvas) throw new Error(`${component} nie jest kanwą — nie może mieć dzieci`);
      const childName = this.nodes[child].type.resolvedName;
      const parents = this.components.get(childName).allowedParents || [];
      if (parents.length && !parents.includes(component)) {
        throw new Error(`${childName} niedozwolony w ${component} (dozwolone: ${parents.join(', ')})`);
      }
      this.nodes[child].parent = id;
      entry.nodes.push(child);
    }
    return id;
  }

  // ---- skróty na najczęstsze węzły -------------------------------------
  section(props, children) { return this.node('Section', props, children); }
  box(props, children) { return this.node('Container', props, children); }
  heading(text, props = {}) {
    const { typographyRole, ...nodeProps } = props;
    return this.node('Heading', { text, ...nodeProps }, [], typographyRole || (/^h[1-6]$/.test(props.tag) ? props.tag : 'h2'));
  }
  text(value, props = {}) {
    const { typographyRole = 'body', ...nodeProps } = props;
    return this.node('Text', { text: value, ...nodeProps }, [], typographyRole);
  }
  button(label, href, props = {}) { return this.node('ButtonBlock', { label, href, ...props }, [], 'button'); }
  image(src, props = {}) { return this.node('ImageBlock', { src, ...props }); }
  icon(name, props = {}) { return this.node('IconBlock', { icon: name, ...props }); }

  /**
   * Sekcja z wideo w tle (Builder 1.2.0). Poster jest obowiązkowy, polityka
   * mobilna jawna (domyślnie "poster" zgodnie z budżetem wydajności).
   */
  videoSection(src, poster, props = {}, children = []) {
    return this.section({
      // Renderer wymaga dyskryminatora modelu 2, inaczej wideo nie maluje się wcale.
      backgroundModelVersion: 2,
      backgroundMedia: 'video',
      backgroundVideo: src,
      backgroundVideoPoster: poster,
      backgroundVideoMobileBehavior: props.backgroundVideoMobileBehavior ?? 'poster',
      ...props,
    }, children);
  }

  /** Sekcja z kolumną treści o szerokości serwisu. */
  shell(props, children) {
    return this.node(
      'Section',
      {
        innerMaxWidth: props.innerMaxWidth ?? this.designProfile.layout.contentWidth ?? '1280px',
        innerPaddingX: props.innerPaddingX ?? '56px',
        innerPaddingXTablet: props.innerPaddingXTablet ?? UNMEASURED_CONTENT_SECTION_DEFAULTS.innerPaddingXTablet,
        innerPaddingXMobile: props.innerPaddingXMobile ?? UNMEASURED_CONTENT_SECTION_DEFAULTS.innerPaddingXMobile,
        ...props,
      },
      children,
      'unmeasured-content-section'
    );
  }

  build(sections, motionPlan = undefined) {
    for (const id of sections) {
      const name = this.nodes[id].type.resolvedName;
      if (!this.rootComponents.has(name)) throw new Error(`${name} nie może być dzieckiem ROOT`);
      this.nodes[id].parent = 'ROOT';
    }
    this.nodes.ROOT = { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: [...sections] };
    this.#validateAnchorComposition();
    this.motionPlan = applySemanticMotionPlan(this.nodes, this.designProfile.motion, motionPlan);
    if (this.motionPlan.rejected.length > 0) {
      throw new Error(`motion plan rejected: ${this.motionPlan.rejected.map((entry) => (
        `${entry.recipeId || entry.nodeId || 'request'}: ${entry.reason}`
      )).join('; ')}`);
    }
    const relationshipErrors = [
      ...validateButtonFormPrefillRelationships(this.nodes, this.contract),
      ...validateQueryControlRelationships(this.nodes, this.contract),
    ];
    if (relationshipErrors.length > 0) {
      throw new Error(`relationship plan rejected: ${relationshipErrors.map((entry) => (
        `${entry.path}: ${entry.message}`
      )).join('; ')}`);
    }
    return this.nodes;
  }

  #validateAnchorComposition() {
    const targets = new Map();
    const references = [];

    for (const [nodeId, node] of Object.entries(this.nodes)) {
      const props = node?.props && typeof node.props === 'object' ? node.props : {};
      if (typeof props.anchorId === 'string' && props.anchorId !== '') {
        if (!ANCHOR_ID_PATTERN.test(props.anchorId)) {
          throw new Error(`${nodeId}.anchorId nie spełnia kontraktu kotwicy`);
        }
        const paths = targets.get(props.anchorId) || [];
        paths.push(`${nodeId}.anchorId`);
        targets.set(props.anchorId, paths);
      }

      const linkProps = ['href', 'url', ...Object.keys(props).filter((prop) => (
        prop.endsWith('Href') && this.controls.has(`${node.type.resolvedName}.${prop}`)
      ))];
      for (const prop of linkProps) {
        const value = props[prop];
        if (typeof value === 'string' && value.startsWith('#')) {
          references.push({ target: value.slice(1), path: `${nodeId}.${prop}` });
        }
      }
      for (const [prop, items] of Object.entries(props)) {
        const controls = this.repeaterItemControls.get(`${node.type.resolvedName}.${prop}`);
        if (!controls || !Array.isArray(items)) continue;
        for (const [index, item] of items.entries()) {
          for (const itemProp of ['href', 'url']) {
            const value = item?.[itemProp];
            if (controls.has(itemProp) && typeof value === 'string' && value.startsWith('#')) {
              references.push({ target: value.slice(1), path: `${nodeId}.${prop}[${index}].${itemProp}` });
            }
          }
        }
      }
      if (node?.type?.resolvedName === 'TableOfContents' && Array.isArray(props.items)) {
        props.items.forEach((item, index) => {
          const target = item && typeof item.anchor === 'string' ? item.anchor : '';
          if (target !== '') references.push({ target, path: `${nodeId}.items[${index}].anchor` });
        });
      }
    }

    for (const [target, paths] of targets) {
      if (paths.length !== 1) {
        throw new Error(`Kotwica ${JSON.stringify(target)} występuje ${paths.length} razy: ${paths.join(', ')}`);
      }
    }
    for (const reference of references) {
      if (!ANCHOR_ID_PATTERN.test(reference.target)) {
        throw new Error(`${reference.path} nie wskazuje poprawnej kotwicy`);
      }
      const matches = targets.get(reference.target) || [];
      if (matches.length !== 1) {
        throw new Error(`${reference.path} wymaga dokładnie jednego anchorId ${JSON.stringify(reference.target)}`);
      }
    }
  }

  async write(path, sections, motionPlan = undefined) {
    const map = this.build(sections, motionPlan);
    await writeFile(path, JSON.stringify(map, null, 1), 'utf8');
    const result = { path, nodes: Object.keys(map).length, notes: [...this.notes], motionPlan: this.motionPlan };
    this.nodes = {};
    this.counter = 0;
    this.notes = [...this.initialNotes];
    return result;
  }
}

function compositionRecord(value, allowed, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: expected object`);
  }
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || (allowed && !allowed.includes(key))) {
      throw new Error(`${path}.${key}: unknown field`);
    }
  }
}

function compositionUrl(value, media, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()
      || /[\u0000-\u0020\u007f-\u009f\\<>"`]/.test(value)) {
    throw new Error(`${path}: invalid URL`);
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    let url;
    try { url = new URL(value); } catch { throw new Error(`${path}: invalid URL`); }
    if (!(media ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(url.protocol)
        || url.username || url.password) throw new Error(`${path}: unsafe URL`);
  } else if (value.startsWith('//') || (media && /^[?#]/.test(value))) {
    throw new Error(`${path}: unsafe URL`);
  }
}

function compositionContent(content, slots, path, depth = 0) {
  if (depth > 2) throw new Error(`${path}: nested item budget exceeded`);
  compositionRecord(slots, null, `${path}.slots`);
  compositionRecord(content, Object.keys(slots), path);
  for (const [name, slot] of Object.entries(slots)) {
    compositionRecord(slot, ['type', 'required', 'minItems', 'maxItems', 'itemSlots'], `${path}.slots.${name}`);
    if (slot.required !== undefined && typeof slot.required !== 'boolean') throw new Error(`${path}.${name}: invalid required flag`);
    if (!['text', 'media', 'link', 'items'].includes(slot.type)) throw new Error(`${path}.${name}: unknown slot type`);
    const value = content[name];
    if (value === undefined) {
      if (slot.required) throw new Error(`${path}.${name}: required slot missing`);
      continue;
    }
    if (slot.type === 'text') {
      if (typeof value !== 'string' || !value.trim() || value.length > 20000) {
        throw new Error(`${path}.${name}: expected nonempty text within 20000 characters`);
      }
    } else if (slot.type === 'media' || slot.type === 'link') {
      const media = slot.type === 'media';
      compositionRecord(value, media ? ['src', 'alt'] : ['href', 'label'], `${path}.${name}`);
      compositionUrl(value[media ? 'src' : 'href'], media, `${path}.${name}`);
      const text = value[media ? 'alt' : 'label'];
      if (typeof text !== 'string' || text.length > 20000 || (!media && !text.trim())) {
        throw new Error(`${path}.${name}: ${media ? 'alt' : 'label'} must be explicit text`);
      }
    } else {
      const minimum = slot.minItems ?? (slot.required ? 1 : 0);
      const maximum = slot.maxItems ?? 8;
      if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum > 8 || minimum > maximum
          || !Array.isArray(value) || value.length < minimum || value.length > maximum) {
        throw new Error(`${path}.${name}: expected ${minimum}–${maximum} items; received ${Array.isArray(value) ? value.length : 'non-array'}`);
      }
      value.forEach((item, index) => compositionContent(item, slot.itemSlots, `${path}.${name}[${index}]`, depth + 1));
    }
  }
}

/** Expands only recipes supplied by the current full live contract. */
export function expandCompositionPlan(contract, plan, options = {}) {
  compositionRecord(plan, ['version', 'sections', 'motion'], 'plan');
  if (plan.version !== 1 || !Array.isArray(plan.sections) || plan.sections.length < 1 || plan.sections.length > 20) {
    throw new Error('plan: version 1 and 1–20 sections required');
  }
  const manifest = contract?.authoring?.compositions;
  if (manifest?.version !== 1 || !Array.isArray(manifest.recipes) || !Array.isArray(contract.components)) {
    throw new Error('contract: full live components and compositions version 1 required');
  }
  const recipes = new Map();
  for (const recipe of manifest.recipes) {
    compositionRecord(recipe, ['id', 'label', 'description', 'slots', 'tree'], 'recipe');
    if (typeof recipe.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(recipe.id) || recipes.has(recipe.id)) {
      throw new Error('recipe: invalid or duplicate id');
    }
    if (recipe.description !== undefined && typeof recipe.description !== 'string') {
      throw new Error(`recipe ${recipe.id}: description must be text`);
    }
    recipes.set(recipe.id, recipe);
  }
  if (options.projectTokens !== undefined) compositionRecord(options.projectTokens, null, 'projectTokens');
  const kit = new Kit(contract, options);
  if (kit.designProfile.rejectedProjectTokens.length > 0) {
    throw new Error(`projectTokens: rejected values for ${kit.designProfile.rejectedProjectTokens.join(', ')}; correct the supplied tokens before expansion`);
  }
  let expandedNodes = 0;
  let levelOneHeadings = 0;
  const ancestry = new Set();
  const decisions = [];
  const sections = [];

  function reference(scope, path, label) {
    if (typeof path !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){0,2}$/.test(path)) {
      throw new Error(`${label}: invalid slot reference`);
    }
    let value = scope;
    for (const part of path.split('.')) {
      if (['__proto__', 'constructor', 'prototype'].includes(part) || !Object.hasOwn(value || {}, part)) {
        throw new Error(`${label}: missing slot ${path}`);
      }
      value = value[part];
    }
    return value;
  }

  function expand(tree, scope, path, depth = 0, repeated = false, declarations = {}) {
    if (depth > 16 || ancestry.has(tree)) throw new Error(`${path}: cyclic or oversized recipe`);
    compositionRecord(tree, ['component', 'props', 'tokenProps', 'slotProps', 'children', 'repeat', 'optionalWhen', 'typographyRole'], path);
    if (tree.optionalWhen !== undefined) {
      if (typeof tree.optionalWhen !== 'string' || !/^(?:item\.)?[a-zA-Z][a-zA-Z0-9_]*$/.test(tree.optionalWhen)) {
        throw new Error(`${path}: invalid optional slot`);
      }
      const [first, second] = tree.optionalWhen.split('.');
      const declared = second ? declarations[first]?.itemSlots : declarations;
      if (!Object.hasOwn(declared || {}, second || first)) throw new Error(`${path}: unknown optional slot`);
      const owner = second ? scope[first] : scope;
      if (!Object.hasOwn(owner || {}, second || first)) return [];
    }
    if (tree.repeat !== undefined && !repeated) {
      const items = reference(scope, tree.repeat, path);
      if (!Array.isArray(items) || items.length > 8) throw new Error(`${path}: invalid repeat`);
      return items.flatMap((item, index) => expand(tree, { ...scope, item }, `${path}[${index}]`, depth, true, { ...declarations, item: declarations[tree.repeat] }));
    }
    expandedNodes += 1;
    if (expandedNodes > 1000) throw new Error(`${path}: node budget exceeded`);
    ancestry.add(tree);
    const props = { ...(tree.props || {}) };
    compositionRecord(props, null, `${path}.props`);
    for (const key of ['tokenProps', 'slotProps']) compositionRecord(tree[key] || {}, null, `${path}.${key}`);
    const assigned = new Set(Object.keys(props));
    for (const [prop, token] of Object.entries(tree.tokenProps || {})) {
      if (assigned.has(prop) || typeof token !== 'string' || !token) throw new Error(`${path}.${prop}: invalid token binding`);
      const value = tokenReference(kit.designProfile, token);
      if (!value) throw new Error(`${path}.${prop}: missing token ${token}`);
      props[prop] = value;
      assigned.add(prop);
    }
    for (const [prop, slot] of Object.entries(tree.slotProps || {})) {
      if (assigned.has(prop)) throw new Error(`${path}.${prop}: duplicate binding`);
      if (typeof slot !== 'string' || !/^(?:item\.)?[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)?$/.test(slot)) {
        throw new Error(`${path}.${prop}: invalid slot reference`);
      }
      const parts = slot.split('.');
      const itemScoped = parts[0] === 'item';
      if (itemScoped) parts.shift();
      const name = parts.shift();
      const declared = itemScoped ? declarations.item?.itemSlots : declarations;
      if (!Object.hasOwn(declared || {}, name)) throw new Error(`${path}.${prop}: undeclared slot ${slot}`);
      const declaration = declared[name];
      const scalar = declaration.type === 'text' && parts.length === 0;
      const media = declaration.type === 'media' && parts.length === 1 && ['src', 'alt'].includes(parts[0]);
      const link = declaration.type === 'link' && parts.length === 1 && ['href', 'label'].includes(parts[0]);
      const collection = declaration.type === 'items' && parts.length === 0;
      if (!(scalar || media || link || collection)) throw new Error(`${path}.${prop}: incompatible slot reference`);
      const owner = itemScoped ? scope.item : scope;
      if (!declaration.required && !Object.hasOwn(owner || {}, name)) continue;
      const value = reference(scope, slot, `${path}.${prop}`);
      if (collection) {
        const control = kit.controls.get(`${tree.component}.${prop}`);
        const itemControls = kit.repeaterItemControls.get(`${tree.component}.${prop}`);
        const itemSlots = declaration.itemSlots || {};
        const minimum = declaration.minItems ?? (declaration.required ? 1 : 0);
        const maximum = declaration.maxItems ?? 8;
        const controlMin = control?.minItems ?? 0;
        const controlMax = control?.maxItems ?? 8;
        if (control?.type !== 'repeater' || !itemControls?.size || !Array.isArray(value)
            || !Number.isInteger(controlMin) || !Number.isInteger(controlMax)
            || controlMin < 0 || controlMax < controlMin || minimum < controlMin || maximum > controlMax
            || Object.keys(itemSlots).length !== itemControls.size) {
          throw new Error(`${path}.${prop}: items require compatible live repeater controls and bounds`);
        }
        for (const [field, itemSlot] of Object.entries(itemSlots)) {
          if (itemSlot.type !== 'text' || !['text', 'textarea'].includes(itemControls.get(field)?.type) || kit.blocked.has(field)) {
            throw new Error(`${path}.${prop}.${field}: incompatible repeater item slot`);
          }
        }
        value.forEach((item, index) => {
          for (const field of ['href', 'url']) {
            if (Object.hasOwn(item, field)) compositionUrl(item[field], false, `${path}.${prop}[${index}].${field}`);
          }
        });
      } else if (typeof value !== 'string') {
        throw new Error(`${path}.${prop}: slot must resolve to text`);
      }
      props[prop] = value;
    }
    if (tree.typographyRole !== undefined && !['h1', 'h2', 'h3', 'body', 'button'].includes(tree.typographyRole)) {
      throw new Error(`${path}: invalid typography role`);
    }
    if (['Heading', 'MultilineHeading'].includes(tree.component) && props.tag === 'h1' && ++levelOneHeadings > 1) {
      throw new Error(`${path}: multiple level-one headings`);
    }
    if (tree.children !== undefined && !Array.isArray(tree.children)) throw new Error(`${path}: children must be an array`);
    const children = (tree.children || []).flatMap((child, index) => expand(child, scope, `${path}.children[${index}]`, depth + 1, false, declarations));
    ancestry.delete(tree);
    return [kit.node(tree.component, props, children, tree.typographyRole || '')];
  }

  for (const [index, section] of plan.sections.entries()) {
    compositionRecord(section, ['compositionId', 'content'], `sections[${index}]`);
    const recipe = recipes.get(section.compositionId);
    if (!recipe) throw new Error(`sections[${index}]: unknown composition ${section.compositionId}; choose ${[...recipes.keys()].join(', ') || 'a recipe from a full live contract with available compositions'}`);
    compositionContent(section.content, recipe.slots, `sections[${index}].content`);
    const roots = expand(recipe.tree, section.content, `sections[${index}].tree`, 0, false, recipe.slots);
    if (roots.length !== 1) throw new Error(`sections[${index}]: exactly one section root required`);
    sections.push(...roots);
    decisions.push({ section: index, compositionId: recipe.id, rootId: roots[0] });
  }
  const layout = kit.build(sections, plan.motion);
  return { layout, notes: kit.notes, decisions, motionPlan: kit.motionPlan };
}

async function compositionCli() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--contract', '--plan', '--out', '--report', '--project-tokens'].includes(flag) || !args[index + 1] || options[flag]) {
      throw new Error('Usage: layout-kit.mjs --contract full-live-contract.json --plan plan.json --out layout.json [--report report.json] [--project-tokens approved-tokens.json]');
    }
    options[flag] = args[index + 1];
  }
  if (!options['--contract'] || !options['--plan'] || !options['--out']) throw new Error('contract, plan and out are required');
  const inputKeys = ['--contract', '--plan', ...(options['--project-tokens'] ? ['--project-tokens'] : [])];
  const paths = [...inputKeys, '--out', ...(options['--report'] ? ['--report'] : [])].map((key) => resolve(options[key]));
  if (new Set(paths).size !== paths.length) throw new Error('input and output paths must be distinct');
  const identities = await Promise.all(paths.map(async (path) => {
    try {
      const info = await stat(path);
      return `${info.dev}:${info.ino}`;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return join(await realpath(dirname(path)), basename(path));
    }
  }));
  if (new Set(identities).size !== identities.length) throw new Error('input and output files must be distinct; symbolic links and hard links cannot alias source files');
  const [contract, plan, projectTokens] = await Promise.all(inputKeys.map(async (key) => {
    const source = await readFile(options[key], 'utf8');
    if (source.length > 10000000) throw new Error(`${key}: input budget exceeded`);
    return JSON.parse(source);
  }));
  const result = expandCompositionPlan(contract, plan, { projectTokens });
  await writeFile(options['--out'], `${JSON.stringify(result.layout, null, 2)}\n`);
  const report = { verdict: 'diagnostic_passed', nodes: Object.keys(result.layout).length, notes: result.notes, decisions: result.decisions };
  if (options['--report']) await writeFile(options['--report'], `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  compositionCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
