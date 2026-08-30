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

import { readFile, writeFile } from 'node:fs/promises';
import designProfileModule from './resolved-design-profile.js';

const {
  applyResolvedDesignDefaults,
  buildResolvedDesignProfile,
} = designProfileModule;

const TEXT_NODES = new Set(['Heading', 'Text', 'MultilineHeading']);
const EDGE_WIDTHS = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];
const ANCHOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function snap(value, step) {
  return Number((Math.round(value / step) * step).toFixed(6));
}

export class Kit {
  constructor(contract, options = {}) {
    this.contract = contract;
    this.designProfile = buildResolvedDesignProfile(contract, options.projectTokens || {});
    this.components = new Map((contract.components || []).map((c) => [c.name, c]));
    this.blocked = new Set(contract.authoring?.blockedProps || []);
    this.rootComponents = new Set(contract.authoring?.topLevelRootComponents || ['Section']);
    this.controls = new Map();
    for (const component of contract.components || []) {
      for (const control of component.controls || []) {
        for (const prop of control.props || []) {
          const key = `${component.name}.${prop}`;
          if (!this.controls.has(key)) this.controls.set(key, control);
        }
      }
    }
    // Kontrolki zagnieżdżone repeaterów (itemControls), np. Section.backgroundLayers
    // czy FormBlock.fields; klucz: "Komponent.propRepeatera".
    this.repeaterItemControls = new Map();
    for (const component of contract.components || []) {
      for (const control of component.controls || []) {
        if (control.type !== 'repeater' || !Array.isArray(control.itemControls)) continue;
        for (const prop of control.props || []) {
          const itemControls = new Map();
          for (const itemControl of control.itemControls) {
            for (const itemProp of itemControl.props || []) {
              if (!itemControls.has(itemProp)) itemControls.set(itemProp, itemControl);
            }
          }
          this.repeaterItemControls.set(`${component.name}.${prop}`, itemControls);
        }
      }
    }
    this.nodes = {};
    this.counter = 0;
    this.notes = [];
    this.notes.push(...this.designProfile.conflicts.map((conflict) => (
      `${conflict.code}: ${conflict.token}; globalStyles=${conflict.globalStylesValue}; designTokens=${conflict.designTokensValue}`
    )));
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

  #normalize(component, prop, value) {
    const control = this.controls.get(`${component}.${prop}`);
    if (!control) return value;
    if (control.type === 'repeater' && Array.isArray(value)) {
      return this.#normalizeRepeater(component, prop, control, value);
    }
    return this.#normalizeControlValue(control, `${component}.${prop}`, value);
  }

  #normalizeControlValue(control, label, value) {
    const { type, options, step, min, max } = control;

    if ((type === 'select' || type === 'segment') && Array.isArray(options)) {
      if (!options.includes(value)) {
        this.notes.push(`${label}: ${JSON.stringify(value)} spoza ${JSON.stringify(options)}, pominięte`);
        return undefined;
      }
      return value;
    }

    if (type === 'number') {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        this.notes.push(`${label}: ${JSON.stringify(value)} nie jest liczbą, pominięte`);
        return undefined;
      }
      let out = step ? snap(numeric, step) : numeric;
      if (typeof min === 'number') out = Math.max(min, out);
      if (typeof max === 'number') out = Math.min(max, out);
      return out;
    }

    if (type === 'css-value' && typeof value === 'string') {
      if (/\S\s+\S/.test(value.trim())) {
        this.notes.push(`${label}: kontrolka przyjmuje jedną wartość, podano „${value}”, pominięte`);
        return undefined;
      }
      if (!step) return value;
      const match = /^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/i.exec(value);
      if (!match) return value;
      let out = snap(Number(match[1]), step);
      if (typeof min === 'number') out = Math.max(min, out);
      if (typeof max === 'number') out = Math.min(max, out);
      const snapped = `${out}${match[2] || ''}`;
      if (snapped !== value.trim()) {
        // Docięcie do kroku kontrolki jest rozbieżnością z referencją/briefem,
        // więc musi zostawić ślad — inaczej pre-flight widzi już czystą wartość
        // i raportuje „0 napraw”, a autor sądzi, że ma 1:1.
        this.notes.push(`${label}: dociągnięte do kroku ${step}: ${value} → ${snapped}`);
      }
      return snapped;
    }

    return value;
  }

  #normalizeRepeater(component, prop, control, value) {
    const itemControls = this.repeaterItemControls.get(`${component}.${prop}`);
    if (!itemControls || itemControls.size === 0) return value;

    const items = [];
    for (const [index, item] of value.entries()) {
      const label = `${component}.${prop}[${index}]`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        this.notes.push(`${label}: pozycja repeatera musi być obiektem, pominięta`);
        continue;
      }
      const out = {};
      for (const [itemProp, raw] of Object.entries(item)) {
        if (raw === undefined || raw === null || raw === '') continue;
        if (!itemControls.has(itemProp)) {
          // Wymyślony klucz potrafi przejść render PHP i wywrócić edytor,
          // dlatego nie wchodzi do node mapy.
          this.notes.push(`${label}.${itemProp}: klucz spoza itemControls kontraktu, pominięty`);
          continue;
        }
        const normalized = this.#normalizeControlValue(itemControls.get(itemProp), `${label}.${itemProp}`, raw);
        if (normalized !== undefined) out[itemProp] = normalized;
      }
      items.push(out);
    }
    if (typeof control.minItems === 'number' && items.length < control.minItems) {
      this.notes.push(`${component}.${prop}: ${items.length} pozycji poniżej minItems ${control.minItems}`);
    }
    if (typeof control.maxItems === 'number' && items.length > control.maxItems) {
      this.notes.push(`${component}.${prop}: ${items.length} pozycji ponad maxItems ${control.maxItems}`);
    }
    return items;
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
      if (raw === undefined || raw === null || raw === '') continue;
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
      const value = this.#normalize(component, prop, raw);
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
    if (TEXT_NODES.has(component) && out.lineHeight === undefined) {
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
    return this.node('Heading', { text, ...nodeProps }, [], typographyRole || (props.tag === 'h1' ? 'h1' : 'h2'));
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
    return this.section(
      {
        innerMaxWidth: props.innerMaxWidth ?? this.designProfile.layout.contentWidth ?? '1280px',
        innerPaddingX: props.innerPaddingX ?? '56px',
        innerPaddingXTablet: props.innerPaddingXTablet ?? '40px',
        innerPaddingXMobile: props.innerPaddingXMobile ?? '20px',
        ...props,
      },
      children
    );
  }

  build(sections) {
    for (const id of sections) {
      const name = this.nodes[id].type.resolvedName;
      if (!this.rootComponents.has(name)) throw new Error(`${name} nie może być dzieckiem ROOT`);
      this.nodes[id].parent = 'ROOT';
    }
    this.nodes.ROOT = { type: { resolvedName: 'RootCanvas' }, isCanvas: true, props: {}, nodes: [...sections] };
    this.#validateAnchorComposition();
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

      for (const prop of ['href', 'url']) {
        const value = props[prop];
        if (typeof value === 'string' && /^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) {
          references.push({ target: value.slice(1), path: `${nodeId}.${prop}` });
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

  async write(path, sections) {
    const map = this.build(sections);
    await writeFile(path, JSON.stringify(map, null, 1), 'utf8');
    return { path, nodes: Object.keys(map).length, notes: this.notes };
  }
}
