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
 *   - marginTop: 0 na tekstach (motyw dokłada 1em),
 *   - borderWidth: 0 przy pojedynczej krawędzi (inaczej renderer obrysuje pudełko),
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

const TEXT_NODES = new Set(['Heading', 'Text', 'MultilineHeading']);
const EDGE_WIDTHS = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];

function snap(value, step) {
  return Number((Math.round(value / step) * step).toFixed(6));
}

export class Kit {
  constructor(contract) {
    this.contract = contract;
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
    this.nodes = {};
    this.counter = 0;
    this.notes = [];
  }

  static async fromContract(path) {
    return new Kit(JSON.parse(await readFile(path, 'utf8')));
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
    const { type, options, step, min, max } = control;

    if ((type === 'select' || type === 'segment') && Array.isArray(options)) {
      if (!options.includes(value)) {
        this.notes.push(`${component}.${prop}: ${JSON.stringify(value)} spoza ${JSON.stringify(options)} — pominięte`);
        return undefined;
      }
      return value;
    }

    if (type === 'number') {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        this.notes.push(`${component}.${prop}: ${JSON.stringify(value)} nie jest liczbą — pominięte`);
        return undefined;
      }
      let out = step ? snap(numeric, step) : numeric;
      if (typeof min === 'number') out = Math.max(min, out);
      if (typeof max === 'number') out = Math.min(max, out);
      return out;
    }

    if (type === 'css-value' && typeof value === 'string') {
      if (/\S\s+\S/.test(value.trim())) {
        this.notes.push(`${component}.${prop}: kontrolka przyjmuje jedną wartość, podano „${value}” — pominięte`);
        return undefined;
      }
      if (!step) return value;
      const match = /^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/i.exec(value);
      if (!match) return value;
      let out = snap(Number(match[1]), step);
      if (typeof min === 'number') out = Math.max(min, out);
      if (typeof max === 'number') out = Math.min(max, out);
      return `${out}${match[2] || ''}`;
    }

    return value;
  }

  /** Dowolny komponent z kontraktu. */
  node(component, props = {}, children = []) {
    const definition = this.components.get(component);
    if (!definition) throw new Error(`Komponent spoza kontraktu: ${component}`);

    const allowed = new Set(definition.props || []);
    const out = {};
    for (const [prop, raw] of Object.entries(props)) {
      if (raw === undefined || raw === null || raw === '') continue;
      if (this.blocked.has(prop)) throw new Error(`Prop zablokowany przez kontrakt: ${component}.${prop}`);
      if (!allowed.has(prop)) throw new Error(`Prop spoza kontraktu: ${component}.${prop}`);
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
    if (component === 'ImageBlock' && out.height === undefined && out.aspectRatio === undefined) {
      this.notes.push('ImageBlock bez height ma zerową wysokość do czasu wczytania obrazu');
    }
    if (out.backgroundType === 'image' && out.background !== undefined) {
      this.notes.push(`${component}: backgroundType "image" pomija kolor tła`);
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
  heading(text, props = {}) { return this.node('Heading', { text, ...props }); }
  text(value, props = {}) { return this.node('Text', { text: value, ...props }); }
  button(label, href, props = {}) { return this.node('ButtonBlock', { label, href, ...props }); }
  image(src, props = {}) { return this.node('ImageBlock', { src, ...props }); }
  icon(name, props = {}) { return this.node('IconBlock', { icon: name, ...props }); }

  /** Sekcja z kolumną treści o szerokości serwisu. */
  shell(props, children) {
    return this.section(
      {
        innerMaxWidth: props.innerMaxWidth ?? '1280px',
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
    return this.nodes;
  }

  async write(path, sections) {
    const map = this.build(sections);
    await writeFile(path, JSON.stringify(map, null, 1), 'utf8');
    return { path, nodes: Object.keys(map).length, notes: this.notes };
  }
}
