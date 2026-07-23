#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const GRID_COLUMNS = new Map([
  ['one', 'repeat(1,minmax(0,1fr))'],
  ['two', 'repeat(2,minmax(0,1fr))'],
  ['three', 'repeat(3,minmax(0,1fr))'],
  ['four', 'repeat(4,minmax(0,1fr))'],
  ['six', 'repeat(6,minmax(0,1fr))'],
  ['sidebar-left-280', '280px minmax(0,1fr)'],
  ['sidebar-left-320', '320px minmax(0,1fr)'],
  ['sidebar-left-360', '360px minmax(0,1fr)'],
  ['sidebar-right-280', 'minmax(0,1fr) 280px'],
  ['sidebar-right-320', 'minmax(0,1fr) 320px'],
  ['sidebar-right-360', 'minmax(0,1fr) 360px'],
]);

const GRID_ROWS = new Map(GRID_COLUMNS);

const SHADOWS = new Map([
  ['shadow-sm', '0 1px 2px 0 rgb(0 0 0 / 0.08)'],
  ['shadow', '0 1px 3px 0 rgb(0 0 0 / 0.12), 0 1px 2px -1px rgb(0 0 0 / 0.12)'],
  ['shadow-md', '0 4px 6px -1px rgb(0 0 0 / 0.12), 0 2px 4px -2px rgb(0 0 0 / 0.12)'],
  ['shadow-lg', '0 10px 15px -3px rgb(0 0 0 / 0.14), 0 4px 6px -4px rgb(0 0 0 / 0.14)'],
  ['shadow-xl', '0 20px 25px -5px rgb(0 0 0 / 0.16), 0 8px 10px -6px rgb(0 0 0 / 0.16)'],
]);

const SYSTEM_FONT_STACKS = new Map([
  ['system-ui', 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'],
  ['ui-sans-serif', 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'],
  ['ui-rounded', 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'],
  ['sans-serif', 'sans-serif'],
  ['ui-serif', 'Georgia,"Times New Roman",serif'],
  ['serif', 'serif'],
  ['ui-monospace', '"SFMono-Regular",Consolas,"Liberation Mono",monospace'],
  ['monospace', 'monospace'],
  ['_system_Arial', 'Arial,Helvetica,sans-serif'],
  ['_system_Georgia', 'Georgia,serif'],
  ['_system_Helvetica', 'Helvetica,Arial,sans-serif'],
  ['_system_Times', '"Times New Roman",Times,serif'],
  ['_system_Courier', '"Courier New",Courier,monospace'],
  ['_system_Verdana', 'Verdana,Geneva,sans-serif'],
  ['_system_Trebuchet', '"Trebuchet MS",Helvetica,sans-serif'],
]);

const SUPPORTED_GOOGLE_FONT_TOKENS = new Set([
  'Inter', 'Roboto', 'Open_Sans', 'Noto_Sans', 'Montserrat', 'Lato', 'Poppins', 'Roboto_Condensed',
  'Source_Sans_3', 'Oswald', 'Raleway', 'Nunito', 'Ubuntu', 'Roboto_Mono', 'Nunito_Sans', 'Playfair_Display',
  'Rubik', 'Merriweather', 'PT_Sans', 'Kanit', 'Work_Sans', 'Noto_Sans_JP', 'Lora', 'Fira_Sans',
  'DM_Sans', 'Barlow', 'Manrope', 'Mulish', 'Quicksand', 'Heebo', 'Noto_Serif', 'IBM_Plex_Sans',
  'Libre_Franklin', 'Mukta', 'Inconsolata', 'Space_Grotesk', 'Titillium_Web', 'Karla', 'Cabin',
  'PT_Serif', 'Dosis', 'Arimo', 'Hind', 'Libre_Baskerville', 'Anton', 'Bitter', 'Abel', 'Josefin_Sans',
  'Exo_2', 'Noto_Sans_KR', 'Source_Code_Pro', 'Bebas_Neue', 'Signika', 'Archivo', 'Cairo',
  'Overpass', 'Cormorant_Garamond', 'Assistant', 'Catamaran', 'Varela_Round', 'Maven_Pro',
  'IBM_Plex_Mono', 'Outfit', 'Red_Hat_Display', 'Lexend', 'Figtree', 'Sora', 'Plus_Jakarta_Sans',
  'Sarabun', 'Noto_Sans_TC', 'Crimson_Text', 'Space_Mono', 'Comfortaa', 'Prompt', 'EB_Garamond',
  'Yanone_Kaffeesatz', 'Asap', 'Barlow_Condensed', 'Oxygen', 'Teko', 'Fjalla_One', 'Abril_Fatface',
  'Archivo_Narrow', 'Righteous', 'Dancing_Script', 'Pacifico', 'Satisfy', 'Lobster', 'Great_Vibes',
  'Permanent_Marker', 'Caveat', 'Indie_Flower', 'Shadows_Into_Light', 'Amatic_SC',
  'Press_Start_2P', 'Fira_Code', 'JetBrains_Mono', 'Source_Serif_4', 'Zilla_Slab',
  'Spectral', 'Chivo', 'Albert_Sans', 'Urbanist', 'Geist',
]);
const SUPPORTED_GOOGLE_FONT_BY_NAME = new Map(
  Array.from(SUPPORTED_GOOGLE_FONT_TOKENS, (token) => [token.replace(/_/g, ' ').toLowerCase(), token])
);

const NON_GOOGLE_FONT_NAMES = new Set([
  '-apple-system',
  'arial',
  'blinkmacsystemfont',
  'courier',
  'courier new',
  'cursive',
  'fantasy',
  'fangsong',
  'geneva',
  'georgia',
  'helvetica',
  'helvetica neue',
  'math',
  'monospace',
  'sans-serif',
  'segoe ui',
  'serif',
  'system-ui',
  'times',
  'times new roman',
  'trebuchet ms',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif',
  'verdana',
]);

const BUTTON_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const BACKGROUND_MEDIA_URL_SCHEMES = new Set(['http', 'https']);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const URL_SCHEME_PATTERN = /^([a-z][a-z\d+.-]*):/i;
const UNSAFE_CSS_PAYLOAD_PATTERN = /(?:expression|url)\s*\(|javascript\s*:|@\s*import\b|behavior\s*:/i;

function parseArgs(argv) {
  const options = {
    layout: '',
    out: '',
    title: 'Monteby Preview',
    fragmentOut: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--layout') {
      options.layout = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--out') {
      options.out = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--title') {
      options.title = requiredValue(argv, index += 1, arg);
    } else if (arg === '--fragment-out') {
      options.fragmentOut = path.resolve(requiredValue(argv, index += 1, arg));
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.layout) {
    throw new Error('--layout is required');
  }
  if (!options.out) {
    throw new Error('--out is required');
  }

  return options;
}

function requiredValue(argv, index, arg) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  render-monteby-preview.js --layout layout.json --out preview.html [--fragment-out fragment.html] [--title "Monteby Preview"]

Renders a diagnostic static HTML preview from a Monteby node map. This is only for local screenshot/capture loops; WordPress/PHP remains the canonical frontend renderer.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractNodeMap(payload) {
  if (isNodeMap(payload)) {
    return payload;
  }

  for (const key of ['layout', 'nodeMap', 'nodes', 'builderJson']) {
    if (payload && typeof payload === 'object' && isNodeMap(payload[key])) {
      return payload[key];
    }
  }

  throw new Error('Could not find a Monteby node map in the layout payload.');
}

function isNodeMap(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.ROOT && typeof value.ROOT === 'object');
}

function renderDocument(nodeMap, title) {
  const fragment = renderChildren(nodeMap, 'ROOT');
  return {
    fragment,
    html: [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${escapeHtml(title)}</title>`,
      googleFontLinks(nodeMap),
      `<style>${baseCss()}</style>`,
      '</head>',
      '<body>',
      '<div class="monteby-preview">',
      fragment,
      '</div>',
      '<script>(function(){document.querySelectorAll("[data-gotoweb-tabs]").forEach(function(root){if(root.dataset.montebyPreviewReady==="true"){return;}root.dataset.montebyPreviewReady="true";var buttons=Array.prototype.slice.call(root.querySelectorAll("[data-tab-index]"));var panels=Array.prototype.slice.call(root.querySelectorAll("[data-tab-panel]"));var tabList=root.querySelector("[role=tablist]");var desktopOrientation=tabList?(tabList.getAttribute("aria-orientation")||"horizontal"):"horizontal";var mobileLayout=function(){return root.getAttribute("data-mobile-tab-layout")||"";};var mobileQuery=typeof window.matchMedia==="function"?window.matchMedia("(max-width: 767px)"):null;var currentOrientation=function(){var layout=mobileLayout();if(mobileQuery&&mobileQuery.matches){if(layout==="stack"){return "vertical";}if(layout==="scroll"||layout==="wrap"){return "horizontal";}}return desktopOrientation;};var scrollActiveIntoView=function(){if(!(mobileQuery&&mobileQuery.matches&&mobileLayout()==="scroll")){return;}var activeButton=null;buttons.some(function(button){if(button.getAttribute("aria-selected")==="true"){activeButton=button;return true;}return false;});if(activeButton&&typeof activeButton.scrollIntoView==="function"){activeButton.scrollIntoView({block:"nearest",inline:"nearest"});}};var syncOrientation=function(){if(tabList){tabList.setAttribute("aria-orientation",currentOrientation());}if(typeof window.requestAnimationFrame==="function"){window.requestAnimationFrame(scrollActiveIntoView);}else{scrollActiveIntoView();}};var activate=function(index,moveFocus){buttons.forEach(function(button,buttonIndex){var active=buttonIndex===index;button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;if(panels[buttonIndex]){panels[buttonIndex].hidden=!active;}});if(moveFocus&&buttons[index]){buttons[index].focus({preventScroll:true});buttons[index].scrollIntoView({block:"nearest",inline:"nearest"});}};buttons.forEach(function(button,index){button.addEventListener("click",function(){activate(index,true);});button.addEventListener("keydown",function(event){var orientation=currentOrientation();var forward=orientation==="vertical"?"ArrowDown":"ArrowRight";var backward=orientation==="vertical"?"ArrowUp":"ArrowLeft";var next=-1;if(event.key==="Home"){next=0;}else if(event.key==="End"){next=buttons.length-1;}else if(event.key===forward){next=(index+1)%buttons.length;}else if(event.key===backward){next=(index-1+buttons.length)%buttons.length;}if(next<0){return;}event.preventDefault();activate(next,true);});});syncOrientation();if(mobileQuery){if(typeof mobileQuery.addEventListener==="function"){mobileQuery.addEventListener("change",syncOrientation);}else if(typeof mobileQuery.addListener==="function"){mobileQuery.addListener(syncOrientation);}}});})();</script>',
      '</body>',
      '</html>',
    ].join(''),
  };
}

function googleFontLinks(nodeMap) {
  const fontTokens = new Set();
  let usesMaterialSymbols = false;

  for (const node of Object.values(nodeMap)) {
    const rawFamily = typeof node?.props?.fontFamily === 'string' ? node.props.fontFamily.trim() : '';
    const fontToken = googleFontToken(rawFamily);
    if (fontToken) {
      fontTokens.add(fontToken);
    }

    if (nodeType(node) === 'StatsGrid' && Array.isArray(node?.props?.items)) {
      usesMaterialSymbols = usesMaterialSymbols || node.props.items.some((item) => /^[a-z0-9_]+$/i.test(String(item?.icon || '').trim()));
    }
    if (nodeType(node) === 'Navbar' && node?.props?.mobileMenuBehavior === 'drawer') {
      usesMaterialSymbols = usesMaterialSymbols || safeMaterialIcon(node?.props?.menuButtonIcon || 'menu') !== '';
    }
    if (nodeType(node) === 'FormBlock') {
      usesMaterialSymbols = usesMaterialSymbols || safeMaterialIcon(node?.props?.submitIcon) !== '';
    }
  }

  if (fontTokens.size === 0 && !usesMaterialSymbols) {
    return '';
  }

  const links = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  ];
  if (fontTokens.size > 0) {
    const familyQuery = Array.from(fontTokens)
      .sort((left, right) => left.localeCompare(right))
      .map((fontToken) => `family=${fontToken.replace(/_/g, '+')}:wght@100;200;300;400;500;600;700;800;900`)
      .join('&');
    links.push(`<link rel="stylesheet" href="${escapeAttr(`https://fonts.googleapis.com/css2?${familyQuery}&display=swap`)}">`);
  }
  if (usesMaterialSymbols) {
    links.push(`<link rel="stylesheet" href="${escapeAttr('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200')}">`);
  }
  return links.join('');
}

function googleFontToken(value) {
  if (typeof value !== 'string' || SYSTEM_FONT_STACKS.has(value.trim())) {
    return '';
  }

  const safeStack = cssFontFamilyValue(value);
  if (!safeStack) {
    return '';
  }
  const primary = safeStack.split(',')[0].trim().replace(/^"|"$/g, '').toLowerCase();
  return SUPPORTED_GOOGLE_FONT_BY_NAME.get(primary) || '';
}

function renderChildren(nodeMap, parentId) {
  const parent = nodeMap[parentId];
  const childIds = Array.isArray(parent?.nodes) ? parent.nodes : [];
  return childIds.map((childId) => renderNode(nodeMap, childId)).join('');
}

function renderNode(nodeMap, nodeId) {
  const node = nodeMap[nodeId];
  if (!node || typeof node !== 'object') {
    return '';
  }

  const type = nodeType(node);
  const props = node.props && typeof node.props === 'object' ? node.props : {};
  if (type === 'Section') {
    return renderSection(nodeMap, nodeId, props);
  }
  if (type === 'Container') {
    return renderElement('div', props, renderChildren(nodeMap, nodeId), '', true);
  }
  if (type === 'Heading') {
    const tag = safeHeadingTag(props.tag);
    return renderElement(tag, props, escapeHtml(textProp(props)));
  }
  if (type === 'MultilineHeading') {
    return renderMultilineHeading(props);
  }
  if (type === 'Text') {
    const tag = props.display === 'inline-block' || props.display === 'inline-flex' ? 'span' : 'p';
    return renderElement(tag, props, escapeHtml(textProp(props)));
  }
  if (type === 'ButtonBlock' || type === 'Button') {
    return renderButton(props);
  }
  if (type === 'ImageBlock' || type === 'Image') {
    return renderImage(props);
  }
  if (type === 'Divider') {
    return renderDivider(props);
  }
  if (type === 'StatsGrid') {
    return renderStatsGrid(props);
  }
  if (type === 'Navbar') {
    return renderNavbar(props);
  }
  if (type === 'FormBlock') {
    return renderFormBlock(props);
  }
  if (type === 'TabsBlock') {
    return renderTabsBlock(nodeId, props);
  }

  return renderElement('div', props, renderChildren(nodeMap, nodeId));
}

function nodeType(node) {
  return node?.type?.resolvedName || node?.type || '';
}

function renderSection(nodeMap, nodeId, props) {
  const tag = safeSectionTag(props.tag);
  const outerProps = { ...props };
  delete outerProps.innerMaxWidth;
  delete outerProps.innerPaddingX;
  delete outerProps.tag;
  const innerStyles = [
    styleDeclaration('box-sizing', 'border-box'),
    styleDeclaration('max-width', cssValue(props.innerMaxWidth)),
    styleDeclaration('margin-left', 'auto'),
    styleDeclaration('margin-right', 'auto'),
    styleDeclaration('padding-left', cssValue(props.innerPaddingX)),
    styleDeclaration('padding-right', cssValue(props.innerPaddingX)),
  ].filter(Boolean);
  const children = `<div style="${innerStyles.join(';')}">${renderChildren(nodeMap, nodeId)}</div>`;

  return renderElement(tag, outerProps, children, '', true);
}

function renderButton(props) {
  const rawHref = typeof props.url === 'string' && props.url ? props.url : typeof props.href === 'string' && props.href ? props.href : '#';
  const href = safeUrlValue(rawHref, BUTTON_URL_SCHEMES) || '#';
  const attrs = ` href="${escapeAttr(href)}"`;
  return renderElement('a', props, escapeHtml(props.label || props.text || 'Button'), attrs);
}

function renderImage(props) {
  const src = safeUrlValue(props.src || props.url || props.image || '', BACKGROUND_MEDIA_URL_SCHEMES);
  if (!src) {
    return '';
  }

  const style = styleFromProps({
    width: props.width || props.maxWidth || '100%',
    maxWidth: props.maxWidth,
    height: props.height || props.imageHeight || 'auto',
    objectFit: props.objectFit,
    objectPosition: props.objectPosition,
    borderRadius: props.borderRadius,
  });
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(props.alt || '')}" style="${escapeAttr(style)}">`;
}

function renderDivider(props) {
  const align = ['left', 'center', 'right'].includes(props.dividerAlign) ? props.dividerAlign : 'center';
  const marginLeft = align === 'left' ? '0' : 'auto';
  const marginRight = align === 'right' ? '0' : 'auto';
  const dividerStyle = ['solid', 'dashed', 'dotted', 'double'].includes(props.dividerStyle)
    ? props.dividerStyle
    : 'solid';
  const styles = [
    styleDeclaration('width', cssValue(props.dividerWidth) || '100%'),
    styleDeclaration('border-top', [
      cssValue(props.dividerThickness) || '1px',
      dividerStyle,
      cssColorValue(props.dividerColor) || '#d4d4d8',
    ].join(' ')),
    styleDeclaration('border-right', 'none'),
    styleDeclaration('border-bottom', 'none'),
    styleDeclaration('border-left', 'none'),
    styleDeclaration('margin-top', cssValue(props.dividerMargin) || '0px'),
    styleDeclaration('margin-right', marginRight),
    styleDeclaration('margin-bottom', cssValue(props.dividerMargin) || '0px'),
    styleDeclaration('margin-left', marginLeft),
  ];
  return `<hr style="${escapeAttr(styles.join(';'))}">`;
}

function renderMultilineHeading(props) {
  const tag = ['h1', 'h2', 'h3'].includes(props.tag) ? props.tag : 'h2';
  const lines = Array.isArray(props.lines) ? props.lines.slice(0, 12) : [];
  const fallbackColor = cssColorValue(props.textColor || props.color) || '#1f1d1b';
  const content = lines.map((rawLine) => {
    const line = rawLine && typeof rawLine === 'object' && !Array.isArray(rawLine) ? rawLine : {};
    const marginLeft = multilineHeadingLineOffset(line.marginLeft);
    const marginLeftTablet = multilineHeadingLineOffset(line.marginLeftTablet);
    const marginLeftMobile = multilineHeadingLineOffset(line.marginLeftMobile);
    const hasLineOffset = Boolean(marginLeft || marginLeftTablet || marginLeftMobile);
    const hasResponsiveLineOffset = Boolean(marginLeftTablet || marginLeftMobile);
    let lineHtml = `<span style="color:${escapeAttr(cssColorValue(line.color) || fallbackColor)}">${escapeHtml(line.text || '')}</span>`;

    if (hasLineOffset) {
      const marginLeftBase = marginLeft || '0px';
      const marginLeftTabletValue = marginLeftTablet || marginLeftBase;
      const styles = [
        styleDeclaration('display', 'inline-block'),
        styleDeclaration('margin-left', marginLeftBase),
        styleDeclaration('--gotoweb-margin-left-base', hasResponsiveLineOffset ? marginLeftBase : ''),
        styleDeclaration('--gotoweb-margin-left-tablet', hasResponsiveLineOffset ? marginLeftTabletValue : ''),
        styleDeclaration('--gotoweb-margin-left-mobile', hasResponsiveLineOffset ? marginLeftMobile || marginLeftTabletValue : ''),
      ].filter(Boolean).join(';');
      const lineClass = hasResponsiveLineOffset ? ' class="gotoweb-margin-left--responsive"' : '';
      lineHtml = `<span${lineClass} style="${escapeAttr(styles)}">${lineHtml}</span>`;
    }

    return lineHtml;
  }).join('<br>');

  return renderElement(tag, props, content);
}

function multilineHeadingLineOffset(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= -9999 && value <= 9999 ? `${value}px` : '';
  }
  if (typeof value !== 'string') {
    return '';
  }
  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|vw|%)$/iu.exec(value.trim());
  if (!match) {
    return '';
  }
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) && numeric >= -9999 && numeric <= 9999
    ? `${match[1]}${match[2].toLowerCase()}`
    : '';
}

function renderTabsBlock(nodeId, props) {
  const tabs = Array.isArray(props.tabs)
    ? props.tabs.filter((tab) => tab && typeof tab === 'object' && !Array.isArray(tab))
    : [];
  if (tabs.length === 0) {
    return '';
  }
  const tabLabels = tabs.map((tab, index) => String(tab.label ?? '').trim() || `Tab ${index + 1}`);

  const orientation = props.orientation === 'vertical' ? 'vertical' : 'horizontal';
  const mobileTabLayout = ['scroll', 'wrap', 'stack'].includes(props.mobileTabLayout)
    ? props.mobileTabLayout
    : '';
  const panelStackAt = props.panelStackAt === 'tablet' ? 'tablet' : 'mobile';
  const parsedDefaultIndex = Number(props.defaultActiveTab);
  const defaultActiveTab = Number.isFinite(parsedDefaultIndex)
    ? Math.min(tabs.length - 1, Math.max(0, Math.floor(parsedDefaultIndex)))
    : 0;
  const identifier = safeIdentifier(nodeId) || 'monteby-tabs';
  const tabBarWidth = statsGridLength(props.tabBarWidth, '320px');
  const tabBarWidthTablet = statsGridLength(props.tabBarWidthTablet, tabBarWidth);
  const tabBarWidthMobile = statsGridLength(props.tabBarWidthMobile, tabBarWidthTablet);
  const tabWidth = statsGridLength(props.tabWidth, orientation === 'vertical' ? '100%' : 'auto');
  const tabWidthTablet = statsGridLength(props.tabWidthTablet, tabWidth);
  const tabWidthMobile = statsGridLength(props.tabWidthMobile, tabWidthTablet);
  const tabMinHeight = statsGridLength(props.tabMinHeight, '44px');
  const tabMinHeightTablet = statsGridLength(props.tabMinHeightTablet, tabMinHeight);
  const tabMinHeightMobile = statsGridLength(props.tabMinHeightMobile, tabMinHeightTablet);
  const tabFontSize = statsGridLength(props.tabFontSize, '14px');
  const tabFontSizeTablet = statsGridLength(props.tabFontSizeTablet, tabFontSize);
  const tabFontSizeMobile = statsGridLength(props.tabFontSizeMobile, tabFontSizeTablet);
  const panelPadding = statsGridLength(props.panelPadding, '20px');
  const panelPaddingTablet = statsGridLength(props.panelPaddingTablet, panelPadding);
  const panelPaddingMobile = statsGridLength(props.panelPaddingMobile, panelPaddingTablet);
  const panelGap = statsGridLength(props.panelGap, '24px');
  const panelGapTablet = statsGridLength(props.panelGapTablet, panelGap);
  const panelGapMobile = statsGridLength(props.panelGapMobile, panelGapTablet);
  const panelImageWidth = statsGridLength(props.panelImageWidth, '40%');
  const panelImageHeight = statsGridLength(props.panelImageHeight, 'auto');
  const panelImageHeightTablet = statsGridLength(props.panelImageHeightTablet, panelImageHeight);
  const panelImageHeightMobile = statsGridLength(props.panelImageHeightMobile, panelImageHeightTablet);
  const panelImagePosition = props.panelImagePosition === 'left' ? 'left' : 'right';
  const panelImageObjectFit = ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(props.panelImageObjectFit)
    ? props.panelImageObjectFit
    : 'cover';
  const panelImageObjectPosition = cssValue(props.panelImageObjectPosition) || 'center';
  const baseObjectPositionX = cssValue(props.panelImageObjectPositionX) || panelImageObjectPosition.split(/\s+/)[0] || '50%';
  const baseObjectPositionY = cssValue(props.panelImageObjectPositionY) || panelImageObjectPosition.split(/\s+/)[1] || baseObjectPositionX;
  const tabletObjectPositionX = cssValue(props.panelImageObjectPositionXTablet) || baseObjectPositionX;
  const tabletObjectPositionY = cssValue(props.panelImageObjectPositionYTablet) || baseObjectPositionY;
  const mobileObjectPositionX = cssValue(props.panelImageObjectPositionXMobile) || tabletObjectPositionX;
  const mobileObjectPositionY = cssValue(props.panelImageObjectPositionYMobile) || tabletObjectPositionY;
  const tabBorderWidth = statsGridLength(props.tabBorderWidth, '0px');
  const activeTabBorderWidth = statsGridLength(props.tabActiveBorderWidth, tabBorderWidth);
  const tabFontWeight = String(props.tabFontWeight ?? '600').trim();
  const safeTabFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(tabFontWeight) ? tabFontWeight : '600';
  const panelTitleFontWeight = String(props.panelTitleFontWeight ?? '700').trim();
  const safePanelTitleFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(panelTitleFontWeight) ? panelTitleFontWeight : '700';
  const panelEyebrowFontWeight = String(props.panelEyebrowFontWeight ?? '600').trim();
  const safePanelEyebrowFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(panelEyebrowFontWeight) ? panelEyebrowFontWeight : '600';
  const panelCtaFontWeight = String(props.panelCtaFontWeight ?? '600').trim();
  const safePanelCtaFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(panelCtaFontWeight) ? panelCtaFontWeight : '600';
  const rootStyles = [
    styleDeclaration('display', 'grid'),
    styleDeclaration('grid-template-columns', orientation === 'vertical' ? `minmax(0,${tabBarWidth}) minmax(0,1fr)` : 'minmax(0,1fr)'),
    styleDeclaration('gap', statsGridLength(props.layoutGap, '18px')),
    styleDeclaration('--gotoweb-tabs-tab-bar-width-base', tabBarWidth),
    styleDeclaration('--gotoweb-tabs-tab-bar-width-tablet', tabBarWidthTablet),
    styleDeclaration('--gotoweb-tabs-tab-bar-width-mobile', tabBarWidthMobile),
  ].filter(Boolean).join(';');
  const alignment = ['start', 'center', 'end', 'stretch'].includes(props.tabBarAlignment)
    ? props.tabBarAlignment
    : 'start';
  const barBorderWidth = statsGridLength(props.tabBarBorderWidth, '0px');
  const barBorderColor = cssColorValue(props.tabBarBorderColor) || 'transparent';
  const barStyles = [
    styleDeclaration('display', 'flex'),
    styleDeclaration('flex-direction', orientation === 'vertical' ? 'column' : 'row'),
    styleDeclaration('flex-wrap', orientation === 'vertical' ? 'nowrap' : 'wrap'),
    styleDeclaration('align-items', orientation === 'vertical' ? (alignment === 'start' ? 'flex-start' : alignment === 'end' ? 'flex-end' : alignment) : ''),
    styleDeclaration('width', orientation === 'vertical' || alignment === 'stretch' ? '100%' : tabBarWidth),
    styleDeclaration('max-width', '100%'),
    styleDeclaration('box-sizing', 'border-box'),
    styleDeclaration('align-self', orientation === 'vertical' ? alignment : ''),
    styleDeclaration('gap', statsGridLength(props.tabGap, '8px')),
    styleDeclaration('padding', statsGridLength(props.tabBarPadding, '0px')),
    styleDeclaration('background-color', cssColorValue(props.tabBarBackgroundColor)),
    styleDeclaration('border', `${barBorderWidth} solid ${barBorderColor}`),
    styleDeclaration('border-radius', statsGridLength(props.tabBarBorderRadius, '0px')),
  ].filter(Boolean).join(';');
  const tabButtons = tabs.map((tab, index) => {
    const active = index === defaultActiveTab;
    const label = tabLabels[index];
    const labelPrefix = String(tab.labelPrefix ?? '');
    const labelSuffix = String(tab.labelSuffix ?? '');
    const hasMetadata = labelPrefix.trim() !== '' || labelSuffix.trim() !== '';
    const ariaLabel = [labelPrefix, label, labelSuffix].map((part) => part.trim()).filter(Boolean).join(' ');
    const buttonStyles = [
      styleDeclaration('appearance', 'none'),
      styleDeclaration('cursor', 'pointer'),
      styleDeclaration('width', orientation === 'vertical' && alignment === 'stretch' ? '100%' : tabWidth),
      styleDeclaration('min-height', tabMinHeight),
      styleDeclaration('padding', `${statsGridLength(props.tabPaddingY, '10px')} ${statsGridLength(props.tabPaddingX, '14px')}`),
      styleDeclaration('color', cssColorValue(props.tabTextColor) || '#18181b'),
      styleDeclaration('background-color', cssColorValue(props.tabBackgroundColor) || 'transparent'),
      styleDeclaration('border', `${tabBorderWidth} solid ${cssColorValue(props.tabBorderColor) || 'transparent'}`),
      styleDeclaration('border-radius', statsGridLength(props.tabBorderRadius, '0px')),
      styleDeclaration('font-size', tabFontSize),
      styleDeclaration('font-weight', safeTabFontWeight),
      styleDeclaration('font-family', cssFontFamilyValue(props.tabFontFamily)),
      styleDeclaration('line-height', statsGridLength(props.tabLineHeight, '1.2', 'px', true)),
      styleDeclaration('text-align', ['left', 'center', 'right'].includes(props.tabTextAlign) ? props.tabTextAlign : 'left'),
      styleDeclaration('--gotoweb-tabs-tab-width-base', tabWidth),
      styleDeclaration('--gotoweb-tabs-tab-width-tablet', tabWidthTablet),
      styleDeclaration('--gotoweb-tabs-tab-width-mobile', tabWidthMobile),
      styleDeclaration('--gotoweb-tabs-tab-min-height-base', tabMinHeight),
      styleDeclaration('--gotoweb-tabs-tab-min-height-tablet', tabMinHeightTablet),
      styleDeclaration('--gotoweb-tabs-tab-min-height-mobile', tabMinHeightMobile),
      styleDeclaration('--gotoweb-tabs-tab-font-size-base', tabFontSize),
      styleDeclaration('--gotoweb-tabs-tab-font-size-tablet', tabFontSizeTablet),
      styleDeclaration('--gotoweb-tabs-tab-font-size-mobile', tabFontSizeMobile),
      styleDeclaration('--monteby-tabs-active-color', cssColorValue(props.tabActiveTextColor) || '#ffffff'),
      styleDeclaration('--monteby-tabs-active-background', cssColorValue(props.tabActiveBackgroundColor) || '#18181b'),
      styleDeclaration('--monteby-tabs-active-border-color', cssColorValue(props.tabActiveBorderColor) || 'transparent'),
      styleDeclaration('--monteby-tabs-active-border-width', activeTabBorderWidth),
      styleDeclaration('--monteby-tabs-meta-color', cssColorValue(props.tabMetaColor) || 'currentColor'),
      styleDeclaration('--monteby-tabs-active-meta-color', cssColorValue(props.tabActiveMetaColor) || 'currentColor'),
    ].filter(Boolean).join(';');
    const metaStyles = [
      styleDeclaration('color', 'var(--monteby-tabs-meta-color,currentColor)'),
      styleDeclaration('font-size', statsGridLength(props.tabMetaFontSize, '0.85em')),
      styleDeclaration('font-weight', String(props.tabMetaFontWeight ?? '400')),
    ].filter(Boolean).join(';');
    const buttonContent = hasMetadata
      ? `<span class="gotoweb-tabs__tab-labels" style="display:inline-flex;align-items:baseline;justify-content:space-between;width:100%;gap:${escapeAttr(statsGridLength(props.tabMetaGap, '8px'))}"><span class="gotoweb-tabs__tab-meta gotoweb-tabs__tab-prefix" style="${escapeAttr(metaStyles)}">${escapeHtml(labelPrefix)}</span><span class="gotoweb-tabs__tab-label">${escapeHtml(label)}</span><span class="gotoweb-tabs__tab-meta gotoweb-tabs__tab-suffix" style="${escapeAttr(metaStyles)}">${escapeHtml(labelSuffix)}</span></span>`
      : escapeHtml(label);

    return `<button id="${escapeAttr(`${identifier}-tab-${index}`)}" type="button" role="tab" data-tab-index="${index}" aria-selected="${active ? 'true' : 'false'}" aria-controls="${escapeAttr(`${identifier}-panel-${index}`)}"${hasMetadata ? ` aria-label="${escapeAttr(ariaLabel)}"` : ''} tabindex="${active ? '0' : '-1'}" style="${escapeAttr(buttonStyles)}">${buttonContent}</button>`;
  }).join('');
  const panels = tabs.map((tab, index) => {
    const label = tabLabels[index];
    const eyebrow = String(tab.eyebrow ?? '');
    const title = String(tab.title ?? '').trim() || label;
    const content = String(tab.content ?? '');
    const ctaLabel = String(tab.ctaLabel ?? '').trim();
    const image = safeUrlValue(String(tab.image ?? ''), BACKGROUND_MEDIA_URL_SCHEMES);
    const hasImage = image !== '';
    const panelStyles = [
      styleDeclaration('display', hasImage ? 'grid' : 'block'),
      styleDeclaration('grid-template-columns', hasImage ? (panelImagePosition === 'left' ? `${panelImageWidth} minmax(0,1fr)` : `minmax(0,1fr) ${panelImageWidth}`) : ''),
      styleDeclaration('align-items', ['start', 'center', 'end', 'stretch'].includes(props.panelAlignItems) ? (props.panelAlignItems === 'start' || props.panelAlignItems === 'end' ? `flex-${props.panelAlignItems}` : props.panelAlignItems) : ''),
      styleDeclaration('gap', hasImage ? panelGap : ''),
      styleDeclaration('padding', panelPadding),
      styleDeclaration('background-color', cssColorValue(props.panelBackgroundColor)),
      styleDeclaration('color', cssColorValue(props.panelTextColor)),
      styleDeclaration('border', `${statsGridLength(props.panelBorderWidth, '0px')} solid ${cssColorValue(props.panelBorderColor) || 'transparent'}`),
      styleDeclaration('border-radius', statsGridLength(props.panelBorderRadius, '0px')),
      styleDeclaration('font-size', statsGridLength(props.panelFontSize, '16px')),
      styleDeclaration('line-height', statsGridLength(props.panelLineHeight, '1.5', 'px', true)),
      styleDeclaration('--gotoweb-tabs-panel-padding-base', panelPadding),
      styleDeclaration('--gotoweb-tabs-panel-padding-tablet', panelPaddingTablet),
      styleDeclaration('--gotoweb-tabs-panel-padding-mobile', panelPaddingMobile),
      styleDeclaration('--gotoweb-tabs-panel-gap-base', panelGap),
      styleDeclaration('--gotoweb-tabs-panel-gap-tablet', panelGapTablet),
      styleDeclaration('--gotoweb-tabs-panel-gap-mobile', panelGapMobile),
    ].filter(Boolean).join(';');
    const contentPaddingTop = statsGridLength(props.panelContentPaddingTop, '0px');
    const contentPaddingX = statsGridLength(props.panelContentPaddingX, '0px');
    const contentPaddingBottom = statsGridLength(props.panelContentPaddingBottom, '0px');
    const contentStyles = [
      styleDeclaration('box-sizing', 'border-box'),
      styleDeclaration('max-width', statsGridLength(props.panelContentMaxWidth, '100%')),
      styleDeclaration('padding', `${contentPaddingTop} ${contentPaddingX} ${contentPaddingBottom}`),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-top-base', contentPaddingTop),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-top-tablet', statsGridLength(props.panelContentPaddingTopTablet, contentPaddingTop)),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-top-mobile', statsGridLength(props.panelContentPaddingTopMobile, statsGridLength(props.panelContentPaddingTopTablet, contentPaddingTop))),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-x-base', contentPaddingX),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-x-tablet', statsGridLength(props.panelContentPaddingXTablet, contentPaddingX)),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-x-mobile', statsGridLength(props.panelContentPaddingXMobile, statsGridLength(props.panelContentPaddingXTablet, contentPaddingX))),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-bottom-base', contentPaddingBottom),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-bottom-tablet', statsGridLength(props.panelContentPaddingBottomTablet, contentPaddingBottom)),
      styleDeclaration('--gotoweb-tabs-panel-content-padding-bottom-mobile', statsGridLength(props.panelContentPaddingBottomMobile, statsGridLength(props.panelContentPaddingBottomTablet, contentPaddingBottom))),
    ].filter(Boolean).join(';');
    const eyebrowMargin = statsGridLength(props.panelEyebrowMarginBottom, '0px');
    const eyebrowLineHeight = statsGridLength(props.panelEyebrowLineHeight, '1.2', 'px', true);
    const eyebrowStyles = [
      styleDeclaration('margin', '0'),
      styleDeclaration('margin-bottom', eyebrowMargin),
      styleDeclaration('color', cssColorValue(props.panelEyebrowColor)),
      styleDeclaration('font-size', statsGridLength(props.panelEyebrowFontSize, '12px')),
      styleDeclaration('font-weight', safePanelEyebrowFontWeight),
      styleDeclaration('line-height', eyebrowLineHeight),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-margin-bottom-base', eyebrowMargin),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-margin-bottom-tablet', statsGridLength(props.panelEyebrowMarginBottomTablet, eyebrowMargin)),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-margin-bottom-mobile', statsGridLength(props.panelEyebrowMarginBottomMobile, statsGridLength(props.panelEyebrowMarginBottomTablet, eyebrowMargin))),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-line-height-base', eyebrowLineHeight),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-line-height-tablet', statsGridLength(props.panelEyebrowLineHeightTablet, eyebrowLineHeight, 'px', true)),
      styleDeclaration('--gotoweb-tabs-panel-eyebrow-line-height-mobile', statsGridLength(props.panelEyebrowLineHeightMobile, statsGridLength(props.panelEyebrowLineHeightTablet, eyebrowLineHeight, 'px', true), 'px', true)),
    ].filter(Boolean).join(';');
    const titleMargin = statsGridLength(props.panelTitleMarginBottom, '0px');
    const titleFontSize = statsGridLength(props.panelTitleFontSize, '32px');
    const titleLineHeight = statsGridLength(props.panelTitleLineHeight, '1.1', 'px', true);
    const titleStyles = [
      styleDeclaration('margin', '0'),
      styleDeclaration('margin-bottom', titleMargin),
      styleDeclaration('color', cssColorValue(props.panelTitleColor)),
      styleDeclaration('font-size', titleFontSize),
      styleDeclaration('font-weight', safePanelTitleFontWeight),
      styleDeclaration('line-height', titleLineHeight),
      styleDeclaration('--gotoweb-tabs-panel-title-margin-bottom-base', titleMargin),
      styleDeclaration('--gotoweb-tabs-panel-title-margin-bottom-tablet', statsGridLength(props.panelTitleMarginBottomTablet, titleMargin)),
      styleDeclaration('--gotoweb-tabs-panel-title-margin-bottom-mobile', statsGridLength(props.panelTitleMarginBottomMobile, statsGridLength(props.panelTitleMarginBottomTablet, titleMargin))),
      styleDeclaration('--gotoweb-tabs-panel-title-font-size-base', titleFontSize),
      styleDeclaration('--gotoweb-tabs-panel-title-font-size-tablet', statsGridLength(props.panelTitleFontSizeTablet, titleFontSize)),
      styleDeclaration('--gotoweb-tabs-panel-title-font-size-mobile', statsGridLength(props.panelTitleFontSizeMobile, statsGridLength(props.panelTitleFontSizeTablet, titleFontSize))),
      styleDeclaration('--gotoweb-tabs-panel-title-line-height-base', titleLineHeight),
      styleDeclaration('--gotoweb-tabs-panel-title-line-height-tablet', statsGridLength(props.panelTitleLineHeightTablet, titleLineHeight, 'px', true)),
      styleDeclaration('--gotoweb-tabs-panel-title-line-height-mobile', statsGridLength(props.panelTitleLineHeightMobile, statsGridLength(props.panelTitleLineHeightTablet, titleLineHeight, 'px', true), 'px', true)),
    ].filter(Boolean).join(';');
    const ctaStyles = [
      styleDeclaration('display', 'inline-flex'),
      styleDeclaration('align-items', 'center'),
      styleDeclaration('justify-content', 'center'),
      styleDeclaration('min-height', statsGridLength(props.panelCtaMinHeight, '44px')),
      styleDeclaration('margin-top', statsGridLength(props.panelCtaMarginTop, '0px')),
      styleDeclaration('padding', `${statsGridLength(props.panelCtaPaddingY, '10px')} ${statsGridLength(props.panelCtaPaddingX, '16px')}`),
      styleDeclaration('background-color', cssColorValue(props.panelCtaBackgroundColor)),
      styleDeclaration('color', cssColorValue(props.panelCtaTextColor)),
      styleDeclaration('border', `${statsGridLength(props.panelCtaBorderWidth, '0px')} solid ${cssColorValue(props.panelCtaBorderColor) || 'transparent'}`),
      styleDeclaration('border-radius', statsGridLength(props.panelCtaBorderRadius, '0px')),
      styleDeclaration('font-size', statsGridLength(props.panelCtaFontSize, '14px')),
      styleDeclaration('font-weight', safePanelCtaFontWeight),
      styleDeclaration('text-decoration', 'none'),
    ].filter(Boolean).join(';');
    const imageRadius = statsGridLength(props.panelImageBorderRadius, '0px');
    const imageStyles = [
      styleDeclaration('display', 'block'),
      styleDeclaration('width', '100%'),
      styleDeclaration('max-width', '100%'),
      styleDeclaration('height', panelImageHeight),
      styleDeclaration('object-fit', panelImageObjectFit),
      styleDeclaration('object-position', `${baseObjectPositionX} ${baseObjectPositionY}`),
      styleDeclaration('border-radius', imageRadius),
      styleDeclaration('--gotoweb-tabs-panel-image-height-base', panelImageHeight),
      styleDeclaration('--gotoweb-tabs-panel-image-height-tablet', panelImageHeightTablet),
      styleDeclaration('--gotoweb-tabs-panel-image-height-mobile', panelImageHeightMobile),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-x-base', baseObjectPositionX),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-y-base', baseObjectPositionY),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-x-tablet', tabletObjectPositionX),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-y-tablet', tabletObjectPositionY),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-x-mobile', mobileObjectPositionX),
      styleDeclaration('--gotoweb-tabs-panel-image-object-position-y-mobile', mobileObjectPositionY),
    ].filter(Boolean).join(';');
    const eyebrowHtml = eyebrow.trim() === '' ? '' : `<p class="gotoweb-tabs__eyebrow" style="${escapeAttr(eyebrowStyles)}">${escapeHtml(eyebrow)}</p>`;
    const titleHtml = props.showPanelTitle === true && title !== '' ? `<h3 class="gotoweb-tabs__title" style="${escapeAttr(titleStyles)}">${escapeHtml(title)}</h3>` : '';
    const ctaHref = safeUrlValue(String(tab.ctaUrl ?? ''), BUTTON_URL_SCHEMES) || '#';
    const ctaHtml = ctaLabel === '' ? '' : `<a class="gotoweb-tabs__cta" href="${escapeAttr(ctaHref)}" style="${escapeAttr(ctaStyles)}">${escapeHtml(ctaLabel)}</a>`;
    const contentHtml = `<div class="gotoweb-tabs__content" style="${escapeAttr(contentStyles)}">${eyebrowHtml}${titleHtml}<div class="gotoweb-tabs__body">${escapeHtml(content)}</div>${ctaHtml}</div>`;
    const imageHtml = hasImage
      ? `<img class="gotoweb-tabs__image" src="${escapeAttr(image)}" alt="${escapeAttr(Object.prototype.hasOwnProperty.call(tab, 'imageAlt') ? String(tab.imageAlt ?? '') : label)}" loading="${index === defaultActiveTab ? 'eager' : 'lazy'}" style="${escapeAttr(imageStyles)}">`
      : '';
    const panelInner = panelImagePosition === 'left' ? `${imageHtml}${contentHtml}` : `${contentHtml}${imageHtml}`;

    return `<div id="${escapeAttr(`${identifier}-panel-${index}`)}" class="gotoweb-tabs__panel${hasImage ? ` gotoweb-tabs__panel--with-image gotoweb-tabs__panel--image-${panelImagePosition}` : ''}" role="tabpanel" data-tab-panel="${index}" aria-labelledby="${escapeAttr(`${identifier}-tab-${index}`)}" tabindex="0"${index === defaultActiveTab ? '' : ' hidden'} style="${escapeAttr(panelStyles)}">${panelInner}</div>`;
  }).join('');
  const classes = ['gotoweb-tabs', `gotoweb-tabs--${orientation}`, mobileTabLayout ? `gotoweb-tabs--mobile-${mobileTabLayout}` : ''].filter(Boolean).join(' ');

  return `<div class="${classes}" data-gotoweb-tabs data-mobile-tab-layout="${escapeAttr(mobileTabLayout)}" data-panel-stack-at="${panelStackAt}" data-tabs-responsive style="${escapeAttr(rootStyles)}"><div class="gotoweb-tabs__bar" role="tablist" aria-orientation="${orientation}" style="${escapeAttr(barStyles)}">${tabButtons}</div><div class="gotoweb-tabs__panels" style="min-width:0">${panels}</div></div>`;
}

function renderStatsGrid(props) {
  const rawItems = Array.isArray(props.items) ? props.items : [];
  const [columns, columnsTablet, columnsMobile] = [
    [props.columns, 4],
    [props.columnsTablet, 2],
    [props.columnsMobile, 1],
  ].map(([value, fallback]) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(Math.max(1, Math.min(8, numeric))) : fallback;
  });
  const colorPattern = /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9.,\s%]+\)|var\(--(?:(?:mb|monteby)-|gcb-color-)[a-z0-9_-]+\))$/i;
  const [cellBg, borderColor, labelColor, valueColor, accentColor] = [
    [props.cellBg, '#ffffff'],
    [props.borderColor, '#e4e4e7'],
    [props.labelColor, '#71717a'],
    [props.valueColor, '#18181b'],
    [props.accentColor, '#2563eb'],
  ].map(([value, fallback]) => {
    const color = cssColorValue(value);
    return colorPattern.test(color) ? color : fallback;
  });
  const cellPadding = statsGridLength(props.cellPadding, '24px');
  const borderRadius = statsGridLength(props.borderRadius, '12px');
  const labelFontSize = statsGridLength(props.labelFontSize, '12px');
  const rawLabelFontWeight = String(props.labelFontWeight ?? '700').trim();
  const labelFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(rawLabelFontWeight) ? rawLabelFontWeight : '700';
  const labelLetterSpacing = statsGridLength(props.labelLetterSpacing, '0.08em');
  const labelTextTransform = ['none', 'uppercase', 'lowercase', 'capitalize'].includes(String(props.labelTextTransform))
    ? String(props.labelTextTransform)
    : 'uppercase';
  const valueFontSize = statsGridLength(props.valueFontSize, '2rem');
  const valueLineHeight = statsGridLength(props.valueLineHeight, '1', 'px', true);
  const rawValueFontWeight = String(props.valueFontWeight ?? '700').trim();
  const valueFontWeight = /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(rawValueFontWeight) ? rawValueFontWeight : '700';
  const valueLetterSpacing = statsGridLength(props.valueLetterSpacing, '0');
  const rootIconSize = statsGridLength(props.iconSize, '0.8em');
  const valueFirst = props.metricOrder === 'value-label';
  const outerStyles = [
    styleDeclaration('display', 'grid'),
    styleDeclaration('grid-template-columns', `repeat(${columns}, minmax(0, 1fr))`),
    styleDeclaration('--gotoweb-grid-template-columns-base', `repeat(${columns}, minmax(0, 1fr))`),
    styleDeclaration('--gotoweb-grid-template-columns-tablet', `repeat(${columnsTablet}, minmax(0, 1fr))`),
    styleDeclaration('--gotoweb-grid-template-columns-mobile', `repeat(${columnsMobile}, minmax(0, 1fr))`),
    styleDeclaration('gap', '1px'),
    styleDeclaration('background', borderColor),
    styleDeclaration('border', `1px solid ${borderColor}`),
    styleDeclaration('border-radius', borderRadius),
    styleDeclaration('overflow', 'hidden'),
  ];
  const cellStyles = [
    styleDeclaration('background', cellBg),
    styleDeclaration('padding', cellPadding),
    styleDeclaration('display', 'flex'),
    styleDeclaration('flex-direction', 'column'),
    styleDeclaration('gap', '4px'),
  ];
  const labelStyles = [
    styleDeclaration('color', labelColor),
    styleDeclaration('font-size', labelFontSize),
    styleDeclaration('font-weight', labelFontWeight),
    styleDeclaration('letter-spacing', labelLetterSpacing),
    styleDeclaration('text-transform', labelTextTransform),
    styleDeclaration('margin', '0'),
    styleDeclaration('order', valueFirst ? '2' : ''),
  ].filter(Boolean);
  const valueStyles = [
    styleDeclaration('color', valueColor),
    styleDeclaration('font-size', valueFontSize),
    styleDeclaration('line-height', valueLineHeight),
    styleDeclaration('font-weight', valueFontWeight),
    styleDeclaration('letter-spacing', valueLetterSpacing),
    styleDeclaration('margin', '0'),
    styleDeclaration('order', valueFirst ? '1' : ''),
  ].filter(Boolean);
  const itemsHtml = rawItems.map((rawItem) => {
    const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const label = String(item.dynamicLabel || item.label || '');
    const value = String(item.dynamicValue || item.value || '');
    const rawIcon = String(item.icon || '').trim();
    const icon = /^[a-z0-9_]+$/i.test(rawIcon) ? rawIcon : '';
    const iconGap = statsGridLength(item.iconGap, '4px');
    const iconSize = statsGridLength(item.iconSize, rootIconSize);
    const itemIconColor = cssColorValue(item.iconColor);
    const iconColor = colorPattern.test(itemIconColor) ? itemIconColor : accentColor;
    const iconHtml = icon
      ? `<span class="material-symbols-rounded" aria-hidden="true" style="font-size:${escapeAttr(iconSize)};line-height:1;color:${escapeAttr(iconColor)};flex-shrink:0">${escapeHtml(icon)}</span>`
      : '';
    const escapedValue = escapeHtml(value);
    const valueInner = iconHtml
      ? `<span style="display:inline-flex;align-items:center;gap:${escapeAttr(iconGap)}">${item.iconPosition === 'before' ? iconHtml : ''}${escapedValue}${item.iconPosition === 'before' ? '' : iconHtml}</span>`
      : `<span>${escapedValue}</span>`;

    return `<div style="${escapeAttr(cellStyles.join(';'))}"><dt style="${escapeAttr(labelStyles.join(';'))}">${escapeHtml(label)}</dt><dd style="${escapeAttr(valueStyles.join(';'))}">${valueInner}</dd></div>`;
  }).join('');

  return `<dl class="gotoweb-grid-template-columns--responsive" style="${escapeAttr(outerStyles.join(';'))}">${itemsHtml}</dl>`;
}

function renderNavbar(props) {
  const behavior = ['hide-links', 'drawer'].includes(props.mobileMenuBehavior) ? props.mobileMenuBehavior : 'default';
  const breakpoint = ['tablet', 'wide'].includes(props.mobileMenuBreakpoint) ? props.mobileMenuBreakpoint : 'mobile';
  const responsiveClass = behavior === 'default' ? '' : ` monteby-preview-navbar--${behavior}-${breakpoint}`;
  const innerPaddingY = cssValue(props.innerPaddingY) || '12px';
  const innerPaddingYTablet = cssValue(props.innerPaddingYTablet) || innerPaddingY;
  const innerPaddingYMobile = cssValue(props.innerPaddingYMobile) || innerPaddingYTablet;
  const rootStyles = [
    styleDeclaration('position', props.sticky === true ? 'sticky' : 'relative'),
    styleDeclaration('top', props.sticky === true ? '0' : ''),
    styleDeclaration('z-index', props.sticky === true ? '50' : ''),
    styleDeclaration('background-color', cssColorValue(props.backgroundColor) || '#ffffff'),
    styleDeclaration('border-width', cssValue(props.borderWidth) || '1px'),
    styleDeclaration('border-style', 'solid'),
    styleDeclaration('border-color', cssColorValue(props.borderColor) || '#e5e7eb'),
    styleDeclaration('border-radius', cssValue(props.borderRadius) || '0px'),
    styleDeclaration('box-shadow', boxShadowValue(props.boxShadow, props)),
  ].filter(Boolean).join(';');
  const innerStyles = [
    'display:flex', 'align-items:center', 'justify-content:space-between', 'flex-wrap:wrap',
    styleDeclaration('gap', cssValue(props.innerGap) || '16px'),
    styleDeclaration('padding-top', innerPaddingY),
    styleDeclaration('padding-right', cssValue(props.innerPaddingX) || '16px'),
    styleDeclaration('padding-bottom', innerPaddingY),
    styleDeclaration('padding-left', cssValue(props.innerPaddingX) || '16px'),
    styleDeclaration('--monteby-navbar-inner-padding-y-base', innerPaddingY),
    styleDeclaration('--monteby-navbar-inner-padding-y-tablet', innerPaddingYTablet),
    styleDeclaration('--monteby-navbar-inner-padding-y-mobile', innerPaddingYMobile),
  ].filter(Boolean).join(';');
  const brandStyles = `display:inline-flex;align-items:center;min-width:0;gap:${cssValue(props.brandGap) || '8px'}`;
  const logoText = safeTextValue(props.logoText, 'Logo');
  const logoSrc = safeUrlValue(props.logoSrc, BACKGROUND_MEDIA_URL_SCHEMES);
  const logoMark = props.showLogoMark === true
    ? `<span aria-hidden="true" style="display:inline-block;flex-shrink:0;width:${escapeAttr(statsGridLength(props.logoMarkSize, '34px'))};height:${escapeAttr(statsGridLength(props.logoMarkSize, '34px'))};border-radius:${escapeAttr(statsGridLength(props.logoMarkBorderRadius, '9999px'))};background-image:linear-gradient(${escapeAttr(gradientAngleValue(props.logoMarkGradientAngle))},${escapeAttr(cssColorValue(props.logoMarkGradientColor1) || '#16a085')},${escapeAttr(cssColorValue(props.logoMarkGradientColor2) || '#bf3f77')})"></span>`
    : '';
  const logo = logoSrc
    ? `<img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(logoText)}" style="height:${escapeAttr(cssValue(props.logoHeight) || '32px')};display:block;width:auto;max-width:100%">`
    : `<span style="color:${escapeAttr(cssColorValue(props.logoTextColor) || '#18181b')};font-size:${escapeAttr(cssValue(props.logoFontSize) || '18px')};font-weight:${escapeAttr(cssValue(props.logoFontWeight) || '700')};line-height:1.2;white-space:nowrap">${escapeHtml(logoText)}</span>`;
  const menuItems = Array.isArray(props.menuItems) ? props.menuItems : [];
  const menu = `<ul class="monteby-preview-navbar__menu" style="display:flex;align-items:center;flex-wrap:wrap;gap:${escapeAttr(cssValue(props.menuGap) || '24px')};list-style:none;margin:0;padding:0">${menuItems.map((item) => {
    const label = safeTextValue(item?.label, '');
    const href = safeUrlValue(item?.href, BUTTON_URL_SCHEMES) || '#';
    return `<li><a href="${escapeAttr(href)}" style="color:${escapeAttr(cssColorValue(props.linkColor) || '#52525b')};font-size:${escapeAttr(cssValue(props.linkFontSize) || '14px')};font-weight:${escapeAttr(cssValue(props.linkFontWeight) || '500')};text-decoration:none">${escapeHtml(label)}</a></li>`;
  }).join('')}</ul>`;
  const ctaLabel = safeTextValue(props.ctaLabel, '');
  const cta = ctaLabel ? `<div class="monteby-preview-navbar__actions" style="display:flex;align-items:center;gap:12px"><a href="${escapeAttr(safeUrlValue(props.ctaHref, BUTTON_URL_SCHEMES) || '#')}" style="display:inline-flex;align-items:center;justify-content:center;padding:${escapeAttr(cssValue(props.ctaPaddingY) || '8px')} ${escapeAttr(cssValue(props.ctaPaddingX) || '16px')};border:${escapeAttr(cssValue(props.ctaBorderWidth) || '1px')} solid ${escapeAttr(cssColorValue(props.ctaBorderColor) || '#2563eb')};border-radius:${escapeAttr(cssValue(props.ctaBorderRadius) || '8px')};background-color:${escapeAttr(cssColorValue(props.ctaBackgroundColor) || '#2563eb')};color:${escapeAttr(cssColorValue(props.ctaTextColor) || '#ffffff')};font-size:${escapeAttr(cssValue(props.ctaFontSize) || '14px')};font-weight:${escapeAttr(cssValue(props.ctaFontWeight) || '600')};line-height:1.2;text-decoration:none;white-space:nowrap">${escapeHtml(ctaLabel)}</a></div>` : '';
  if (behavior !== 'drawer') {
    return `<nav class="monteby-preview-navbar${responsiveClass}" style="${escapeAttr(rootStyles)}"><div class="monteby-preview-navbar__inner" style="${escapeAttr(innerStyles)}"><div style="${escapeAttr(brandStyles)}">${logoMark}${logo}</div>${menu}${cta}</div></nav>`;
  }
  const icon = safeMaterialIcon(props.menuButtonIcon || 'menu') || 'menu';
  const buttonLabel = safeTextValue(props.menuButtonLabel, 'Menu');
  const buttonStyles = `display:none;align-items:center;justify-content:center;padding:${cssValue(props.ctaPaddingY) || '8px'} ${cssValue(props.ctaPaddingX) || '16px'};border:${cssValue(props.borderWidth) || '1px'} solid ${cssColorValue(props.borderColor) || '#e5e7eb'};border-radius:${cssValue(props.ctaBorderRadius) || '8px'};background-color:${cssColorValue(props.backgroundColor) || '#ffffff'};color:${cssColorValue(props.linkColor) || '#52525b'};line-height:1`;
  return `<nav class="monteby-preview-navbar${responsiveClass}" style="${escapeAttr(rootStyles)}"><div class="monteby-preview-navbar__inner" style="${escapeAttr(innerStyles)}"><div style="${escapeAttr(brandStyles)}">${logoMark}${logo}</div><div class="monteby-preview-navbar__desktop" style="display:flex;align-items:center;gap:16px;margin-left:auto">${menu}${cta}</div><button type="button" class="monteby-preview-navbar__toggle" aria-expanded="false" aria-label="${escapeAttr(buttonLabel)}" style="${escapeAttr(buttonStyles)}"><span class="material-symbols-rounded" aria-hidden="true">${escapeHtml(icon)}</span></button><div class="monteby-preview-navbar__drawer" aria-hidden="true" hidden>${menu}${cta}</div></div></nav>`;
}

function renderFormBlock(props) {
  const columns = Number(props.formColumns) === 2 ? 2 : 1;
  const rootStyles = [
    'display:grid',
    styleDeclaration('grid-template-columns', columns === 2 ? 'repeat(2,minmax(0,1fr))' : ''),
    styleDeclaration('gap', cssValue(props.formGap) || '16px'),
    styleDeclaration('max-width', cssValue(props.formMaxWidth) || '640px'),
    styleDeclaration('align-items', ['stretch', 'flex-start', 'center', 'flex-end'].includes(props.formAlignItems) ? props.formAlignItems : 'stretch'),
    styleDeclaration('padding', `${cssValue(props.formPaddingY) || '0px'} ${cssValue(props.formPaddingX) || '0px'}`),
    styleDeclaration('background-color', cssColorValue(props.formBackgroundColor) || '#ffffff'),
    styleDeclaration('border-width', formBorderWidth(props.formBorderWidth)),
    'border-style:solid',
    styleDeclaration('border-color', cssColorValue(props.formBorderColor) || '#e5e7eb'),
    styleDeclaration('border-radius', formBorderRadius(props.formBorderRadius)),
  ].filter(Boolean).join(';');
  const fields = Array.isArray(props.fields) ? props.fields : [];
  const fieldsHtml = fields.map((field, index) => renderFormField(field, props, columns, index)).join('');
  const icon = safeMaterialIcon(props.submitIcon);
  const submitStyles = [
    'display:inline-flex', 'align-items:center', 'justify-content:center', 'gap:8px',
    styleDeclaration('grid-column', columns === 2 ? 'span 2' : ''),
    styleDeclaration('align-self', ['auto', 'stretch', 'flex-start', 'center', 'flex-end'].includes(props.buttonAlignSelf) ? props.buttonAlignSelf : 'flex-start'),
    styleDeclaration('min-height', cssValue(props.buttonMinHeight) || '48px'),
    styleDeclaration('padding', `${cssValue(props.buttonPaddingY) || '12px'} ${cssValue(props.buttonPaddingX) || '24px'}`),
    styleDeclaration('border-width', formBorderWidth(props.buttonBorderWidth) || '1px'), 'border-style:solid',
    styleDeclaration('border-color', cssColorValue(props.buttonBorderColor) || '#2563eb'), styleDeclaration('border-radius', formBorderRadius(props.buttonBorderRadius) || '8px'),
    styleDeclaration('background-color', cssColorValue(props.buttonBackgroundColor) || '#2563eb'), styleDeclaration('color', cssColorValue(props.buttonTextColor) || '#ffffff'),
    styleDeclaration('font-size', cssValue(props.buttonFontSize) || '16px'), styleDeclaration('font-weight', formFontWeight(props.buttonFontWeight) || '600'),
  ].filter(Boolean).join(';');
  return `<form class="monteby-preview-form${columns === 2 ? ' monteby-preview-form--two-columns' : ''}"${safeIdentifier(props.formId) ? ` id="${escapeAttr(safeIdentifier(props.formId))}"` : ''} style="${escapeAttr(rootStyles)}">${fieldsHtml}<button type="button" style="${escapeAttr(submitStyles)}">${icon ? `<span class="material-symbols-rounded" aria-hidden="true" style="font-size:1.1em;line-height:1">${escapeHtml(icon)}</span>` : ''}${escapeHtml(safeTextValue(props.submitLabel, 'Send'))}</button></form>`;
}

function renderFormField(rawField, props, columns, index) {
  const field = rawField && typeof rawField === 'object' ? rawField : {};
  const type = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'].includes(field.type) ? field.type : 'text';
  const name = safeFieldName(field.name, index);
  const label = safeTextValue(field.label, '');
  const required = field.required === true;
  const column = columns === 2 && Number(field.columnSpan) === 2 ? 'span 2' : '';
  const labelStyle = `color:${cssColorValue(props.labelColor) || '#111827'};font-size:${cssValue(props.labelFontSize) || '14px'};font-weight:${formFontWeight(props.labelFontWeight) || '600'};font-family:${cssFontFamilyValue(props.labelFontFamily) || 'inherit'};letter-spacing:${formLetterSpacing(props.labelLetterSpacing)};text-transform:${formTextTransform(props.labelTextTransform)}`;
  const controlStyle = `width:100%;height:${cssValue(props.inputHeight) || 'auto'};padding:${cssValue(props.inputPaddingTop) || '14px'} ${cssValue(props.inputPaddingRight) || '16px'} ${cssValue(props.inputPaddingBottom) || '14px'} ${cssValue(props.inputPaddingLeft) || '16px'};border:${formBorderWidth(props.inputBorderWidth) || '1px'} solid ${cssColorValue(props.inputBorderColor) || '#e5e7eb'};border-radius:${formBorderRadius(props.inputBorderRadius) || '12px'};background-color:${cssColorValue(props.inputBgColor) || '#ffffff'};color:${cssColorValue(props.inputColor) || '#111827'};font-size:${cssValue(props.inputFontSize) || '16px'};font-family:${cssFontFamilyValue(props.inputFontFamily) || 'inherit'};font-weight:${formFontWeight(props.inputFontWeight) || '400'};--monteby-preview-form-focus-color:${cssColorValue(props.inputFocusColor) || '#2563eb'}`;
  const mark = required ? `<span aria-hidden="true" style="color:${escapeAttr(cssColorValue(props.requiredColor) || '#ef4444')}">*</span>` : '';
  if (type === 'checkbox') {
    const linkText = safeTextValue(field.linkText, '');
    const linkUrl = safeUrlValue(field.linkUrl, BUTTON_URL_SCHEMES);
    const link = linkText ? (linkUrl ? `<a href="${escapeAttr(linkUrl)}">${escapeHtml(linkText)}</a>` : escapeHtml(linkText)) : '';
    return `<label style="display:flex;align-items:flex-start;gap:${escapeAttr(cssValue(props.fieldGap) || '6px')};line-height:1.5;grid-column:${escapeAttr(column || 'auto')};${escapeAttr(labelStyle)}"><input class="monteby-preview-form-control" type="checkbox" name="${escapeAttr(name)}"${required ? ' required' : ''} style="width:${escapeAttr(cssValue(props.checkboxSize) || '16px')};height:${escapeAttr(cssValue(props.checkboxSize) || '16px')};border:1px solid ${escapeAttr(cssColorValue(props.checkboxBorderColor) || '#d1d5db')};border-radius:${escapeAttr(formBorderRadius(props.checkboxBorderRadius) || '4px')};flex:0 0 auto"><span>${escapeHtml(label)}${label && link ? ' ' : ''}${link}${mark}</span></label>`;
  }
  const wrapStart = `<div style="display:flex;flex-direction:column;gap:${escapeAttr(cssValue(props.fieldGap) || '6px')};${column ? `grid-column:${escapeAttr(column)};` : ''}">`;
  const labelHtml = label ? `<label style="${escapeAttr(labelStyle)}">${escapeHtml(label)}${mark}</label>` : '';
  const placeholder = escapeAttr(safeTextValue(field.placeholder, ''));
  if (type === 'textarea') {
    const rows = Math.max(2, Math.min(30, Math.floor(Number(field.rows) || 5)));
    return `${wrapStart}${labelHtml}<textarea class="monteby-preview-form-control" name="${escapeAttr(name)}" rows="${rows}" placeholder="${placeholder}"${required ? ' required' : ''} style="${escapeAttr(controlStyle)};resize:vertical"></textarea></div>`;
  }
  if (type === 'select') {
    const options = formOptions(field.options);
    return `${wrapStart}${labelHtml}<select class="monteby-preview-form-control" name="${escapeAttr(name)}"${required ? ' required' : ''} style="${escapeAttr(controlStyle)}">${placeholder ? `<option value="">${placeholder}</option>` : ''}${options.map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`).join('')}</select></div>`;
  }
  return `${wrapStart}${labelHtml}<input class="monteby-preview-form-control" type="${type}" name="${escapeAttr(name)}" placeholder="${placeholder}"${required ? ' required' : ''} style="${escapeAttr(controlStyle)}"></div>`;
}

function statsGridLength(value, fallback, defaultUnit = 'px', allowUnitless = false) {
  const candidate = value ?? fallback;
  if (typeof candidate === 'number') {
    if (!Number.isFinite(candidate)) {
      return fallback;
    }
    return allowUnitless || candidate === 0 ? String(candidate) : `${candidate}${defaultUnit}`;
  }
  if (typeof candidate !== 'string') {
    return fallback;
  }

  const raw = candidate.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return allowUnitless || raw === '0' ? raw : `${raw}${defaultUnit}`;
  }
  return /^-?\d+(?:\.\d+)?(?:px|rem|em|vh|dvh|svh|lvh|vw|vmin|vmax|%|ch)$/.test(raw) ? raw : fallback;
}

function renderElement(tag, props, children, extraAttrs = '', forceBorderBox = false) {
  const className = classNameFromProps(props);
  const classAttr = className ? ` class="${escapeAttr(className)}"` : '';
  const style = [
    forceBorderBox ? styleDeclaration('box-sizing', 'border-box') : '',
    styleFromProps(props),
  ].filter(Boolean).join(';');
  const styleAttr = style ? ` style="${escapeAttr(style)}"` : '';
  return `<${tag}${classAttr}${styleAttr}${extraAttrs}>${children}</${tag}>`;
}

function classNameFromProps(props) {
  const classes = [];
  if (props.responsiveStack === 'tablet') {
    classes.push('monteby-stack-tablet');
  } else if (props.responsiveStack === 'mobile') {
    classes.push('monteby-stack-mobile');
  }
  if (props.responsiveDisplay === 'hide-mobile') {
    classes.push('monteby-hide-mobile');
  } else if (props.responsiveDisplay === 'hide-tablet-down') {
    classes.push('monteby-hide-tablet-down');
  } else if (props.responsiveDisplay === 'show-mobile-only') {
    classes.push('monteby-show-mobile-only');
  } else if (props.responsiveDisplay === 'show-tablet-down-only') {
    classes.push('monteby-show-tablet-down-only');
  }
  if (props.sticky === true && props.stickyResetAt === 'tablet') {
    classes.push('monteby-sticky-reset-tablet');
  } else if (props.sticky === true && props.stickyResetAt === 'mobile') {
    classes.push('monteby-sticky-reset-mobile');
  }
  return classes.join(' ');
}

function styleFromProps(props) {
  const styles = [];
  const backgroundColor = props.backgroundColor || props.background;
  const gridTemplateColumns = gridTemplateColumnsFromProps(props);
  const gridTemplateRows = GRID_ROWS.get(String(props.gridTemplateRows || '')) || cssValue(props.gridTemplateRows);
  const paddingTop = props.paddingTop || props.paddingY;
  const paddingRight = props.paddingRight || props.paddingX;
  const paddingBottom = props.paddingBottom || props.paddingY;
  const paddingLeft = props.paddingLeft || props.paddingX;
  const background = backgroundLayerStyles(props);

  styles.push(
    styleDeclaration('margin-top', cssValue(props.marginTop)),
    styleDeclaration('margin-right', cssValue(props.marginRight) || '0'),
    styleDeclaration('margin-bottom', cssValue(props.marginBottom)),
    styleDeclaration('margin-left', cssValue(props.marginLeft) || '0'),
    styleDeclaration('background-color', cssValue(backgroundColor)),
    styleDeclaration('background-image', background.image),
    styleDeclaration('background-size', background.size),
    styleDeclaration('background-position', background.position),
    styleDeclaration('background-position-x', background.layerCount > 1 ? '' : cssValue(props.backgroundPositionX)),
    styleDeclaration('background-position-y', background.layerCount > 1 ? '' : cssValue(props.backgroundPositionY)),
    styleDeclaration('background-repeat', background.repeat),
    styleDeclaration('display', displayValue(props)),
    styleDeclaration('gap', cssValue(props.gap)),
    styleDeclaration('row-gap', cssValue(props.rowGap)),
    styleDeclaration('column-gap', cssValue(props.columnGap)),
    styleDeclaration('width', cssValue(props.width)),
    styleDeclaration('max-width', cssValue(props.maxWidth)),
    styleDeclaration('min-width', cssValue(props.minWidth)),
    styleDeclaration('height', cssValue(props.height)),
    styleDeclaration('min-height', cssValue(props.minHeight)),
    styleDeclaration('max-height', cssValue(props.maxHeight)),
    styleDeclaration('flex-basis', cssValue(props.flexBasis)),
    styleDeclaration('flex-grow', cssNumber(props.flexGrow)),
    styleDeclaration('flex-shrink', cssNumber(props.flexShrink)),
    styleDeclaration('grid-template-columns', gridTemplateColumns.base),
    styleDeclaration('grid-template-rows', gridTemplateRows),
    styleDeclaration('grid-column', gridPlacement(props.gridColumnStart, props.gridColumnSpan)),
    styleDeclaration('grid-row', gridPlacement(props.gridRowStart, props.gridRowSpan)),
    styleDeclaration('flex-direction', cssValue(props.flexDirection)),
    styleDeclaration('flex-wrap', cssValue(props.flexWrap) || (props.layoutDisplay === 'flex' ? 'nowrap' : '')),
    styleDeclaration('justify-content', cssValue(props.justifyContent)),
    styleDeclaration('align-items', cssValue(props.alignItems)),
    styleDeclaration('align-self', cssValue(props.alignSelf)),
    styleDeclaration('position', props.sticky === true ? 'sticky' : ''),
    styleDeclaration('top', props.sticky === true ? cssValue(props.stickyTop) || '0px' : ''),
    styleDeclaration('padding-top', cssValue(paddingTop)),
    styleDeclaration('padding-right', cssValue(paddingRight)),
    styleDeclaration('padding-bottom', cssValue(paddingBottom)),
    styleDeclaration('padding-left', cssValue(paddingLeft)),
    styleDeclaration('border-radius', cssValue(props.borderRadius)),
    styleDeclaration('border-width', cssValue(props.borderWidth)),
    styleDeclaration('border-color', cssValue(props.borderColor)),
    styleDeclaration('border-style', props.borderWidth || props.borderColor ? 'solid' : ''),
    styleDeclaration('box-shadow', boxShadowValue(props.boxShadow, props)),
    styleDeclaration('font-size', cssValue(props.fontSize)),
    styleDeclaration('line-height', cssValue(props.lineHeight)),
    styleDeclaration('font-weight', cssValue(props.fontWeight)),
    styleDeclaration('font-family', cssFontFamilyValue(props.fontFamily)),
    styleDeclaration('letter-spacing', cssValue(props.letterSpacing)),
    styleDeclaration('text-transform', cssValue(props.textTransform)),
    styleDeclaration('text-align', cssValue(props.textAlign)),
    styleDeclaration('color', cssValue(props.textColor || props.color)),
    styleDeclaration('text-decoration', cssValue(props.textDecoration)),
    styleDeclaration('object-fit', cssValue(props.objectFit)),
    styleDeclaration('object-position', cssValue(props.objectPosition)),
    styleDeclaration('aspect-ratio', cssValue(props.aspectRatio)),
    styleDeclaration('overflow', cssValue(props.overflow))
  );

  styles.push(...responsiveCustomProperties(props));
  return styles.filter(Boolean).join(';');
}

function displayValue(props) {
  if (props.buttonDisplay) {
    return cssValue(props.buttonDisplay);
  }
  if (props.display) {
    return cssValue(props.display);
  }
  if (props.layoutDisplay) {
    return cssValue(props.layoutDisplay);
  }
  return '';
}

function responsiveCustomProperties(props) {
  const rules = [];
  for (const [prop, cssName] of [
    ['fontSizeTablet', '--monteby-font-size-tablet'],
    ['fontSizeMobile', '--monteby-font-size-mobile'],
    ['minHeightTablet', '--monteby-min-height-tablet'],
    ['minHeightMobile', '--monteby-min-height-mobile'],
    ['paddingTopTablet', '--monteby-padding-top-tablet'],
    ['paddingRightTablet', '--monteby-padding-right-tablet'],
    ['paddingBottomTablet', '--monteby-padding-bottom-tablet'],
    ['paddingLeftTablet', '--monteby-padding-left-tablet'],
    ['paddingTopMobile', '--monteby-padding-top-mobile'],
    ['paddingRightMobile', '--monteby-padding-right-mobile'],
    ['paddingBottomMobile', '--monteby-padding-bottom-mobile'],
    ['paddingLeftMobile', '--monteby-padding-left-mobile'],
    ['marginTopTablet', '--monteby-margin-top-tablet'],
    ['marginBottomTablet', '--monteby-margin-bottom-tablet'],
    ['marginLeftTablet', '--monteby-margin-left-tablet'],
    ['marginTopMobile', '--monteby-margin-top-mobile'],
    ['marginBottomMobile', '--monteby-margin-bottom-mobile'],
    ['marginLeftMobile', '--monteby-margin-left-mobile'],
    ['gapTablet', '--monteby-gap-tablet'],
    ['gapMobile', '--monteby-gap-mobile'],
    ['maxWidthTablet', '--monteby-max-width-tablet'],
    ['maxWidthMobile', '--monteby-max-width-mobile'],
    ['lineHeightTablet', '--monteby-line-height-tablet'],
    ['lineHeightMobile', '--monteby-line-height-mobile'],
    ['textAlignTablet', '--monteby-text-align-tablet'],
    ['textAlignMobile', '--monteby-text-align-mobile'],
    ['backgroundPositionXTablet', '--monteby-background-position-x-tablet'],
    ['backgroundPositionYTablet', '--monteby-background-position-y-tablet'],
    ['backgroundPositionXMobile', '--monteby-background-position-x-mobile'],
    ['backgroundPositionYMobile', '--monteby-background-position-y-mobile'],
    ['flexDirectionTablet', '--monteby-flex-direction-tablet'],
    ['flexDirectionMobile', '--monteby-flex-direction-mobile'],
    ['flexWrapTablet', '--monteby-flex-wrap-tablet'],
    ['flexWrapMobile', '--monteby-flex-wrap-mobile'],
    ['justifyContentTablet', '--monteby-justify-content-tablet'],
    ['justifyContentMobile', '--monteby-justify-content-mobile'],
    ['alignItemsTablet', '--monteby-align-items-tablet'],
    ['alignItemsMobile', '--monteby-align-items-mobile'],
  ]) {
    const value = cssValue(props[prop]);
    if (value) {
      rules.push(styleDeclaration(cssName, value));
    }
  }

  const gridTemplateColumns = gridTemplateColumnsFromProps(props);
  if (gridTemplateColumns.responsive) {
    rules.push(
      styleDeclaration('--monteby-grid-template-columns-tablet', gridTemplateColumns.tablet || 'none'),
      styleDeclaration('--monteby-grid-template-columns-mobile', gridTemplateColumns.mobile || 'none')
    );
  }

  for (const [value, cssName] of [
    [gridPlacement(props.gridColumnStartTablet, props.gridColumnSpanTablet), '--monteby-grid-column-tablet'],
    [gridPlacement(props.gridColumnStartMobile, props.gridColumnSpanMobile), '--monteby-grid-column-mobile'],
    [gridPlacement(props.gridRowStartTablet, props.gridRowSpanTablet), '--monteby-grid-row-tablet'],
    [gridPlacement(props.gridRowStartMobile, props.gridRowSpanMobile), '--monteby-grid-row-mobile'],
  ]) {
    if (value) {
      rules.push(styleDeclaration(cssName, value));
    }
  }
  return rules;
}

function gridTemplateColumnsFromProps(props) {
  const safeToken = (value) => {
    const token = String(value || '').trim();
    return token === 'two-proportional' || GRID_COLUMNS.has(token) ? token : '';
  };
  const safePercent = (value, fallback = '') => {
    if ((typeof value !== 'number' && typeof value !== 'string')
      || (typeof value === 'string' && value.trim() === '')) {
      return fallback;
    }
    const number = Number(value);
    return Number.isFinite(number)
      ? String(Math.round(Math.min(Math.max(number, 10), 90)))
      : fallback;
  };
  const resolve = (token, percent) => token === 'two-proportional'
    ? `minmax(0,${percent}fr) minmax(0,${100 - Number(percent)}fr)`
    : GRID_COLUMNS.get(token) || '';

  const baseToken = safeToken(props.gridTemplateColumns);
  const tabletToken = safeToken(props.gridTemplateColumnsTablet);
  const mobileToken = safeToken(props.gridTemplateColumnsMobile);
  const effectiveTabletToken = tabletToken || baseToken;
  const effectiveMobileToken = mobileToken || effectiveTabletToken;
  const basePercent = safePercent(props.gridFirstColumnPercent, '50');
  const tabletPercent = safePercent(props.gridFirstColumnPercentTablet, basePercent);
  const mobilePercent = safePercent(props.gridFirstColumnPercentMobile, tabletPercent);
  const responsive = Boolean(
    tabletToken
    || mobileToken
    || (safePercent(props.gridFirstColumnPercentTablet) && effectiveTabletToken === 'two-proportional')
    || (safePercent(props.gridFirstColumnPercentMobile) && effectiveMobileToken === 'two-proportional')
  );

  return {
    base: resolve(baseToken, basePercent),
    tablet: resolve(effectiveTabletToken, tabletPercent),
    mobile: resolve(effectiveMobileToken, mobilePercent),
    responsive,
  };
}

function styleDeclaration(name, value) {
  return value ? `${name}:${value}` : '';
}

function backgroundLayerStyles(props) {
  const layers = [];
  const overlay = backgroundOverlayValue(props.backgroundOverlay);
  const image = backgroundUrlValue(props.backgroundImage);

  if (overlay && image) {
    layers.push({
      image: overlay,
      size: 'auto',
      position: 'center',
      repeat: 'no-repeat',
    });
  }
  if (image) {
    layers.push({
      image,
      size: cssValue(props.backgroundSize),
      position: backgroundPositionValue(props),
      repeat: cssValue(props.backgroundRepeat),
    });
  }
  if (!image && props.backgroundType === 'gradient') {
    const accent = radialAccentValue(props);
    const gradient = gradientValue(props);
    if (accent) {
      layers.push({
        image: accent,
        size: 'auto',
        position: 'center',
        repeat: 'no-repeat',
      });
    }
    if (gradient) {
      layers.push({
        image: gradient,
        size: 'auto',
        position: 'center',
        repeat: 'no-repeat',
      });
    }
  }

  return {
    image: layers.map((layer) => layer.image).join(','),
    size: layeredBackgroundValue(layers, 'size'),
    position: layeredBackgroundValue(layers, 'position'),
    repeat: layeredBackgroundValue(layers, 'repeat'),
    layerCount: layers.length,
  };
}

function layeredBackgroundValue(layers, key) {
  if (layers.length === 0) {
    return '';
  }

  if (layers.length === 1) {
    return layers[0][key] || '';
  }

  const fallback = key === 'repeat' ? 'repeat' : key === 'position' ? 'center' : 'auto';
  return layers.map((layer) => layer[key] || fallback).join(',');
}

function backgroundPositionValue(props) {
  const explicit = cssValue(props.backgroundPosition);
  if (explicit) {
    return explicit;
  }

  const x = cssValue(props.backgroundPositionX);
  const y = cssValue(props.backgroundPositionY);
  return x || y ? `${x || '50%'} ${y || '50%'}` : '';
}

function backgroundUrlValue(value) {
  const url = safeUrlValue(value, BACKGROUND_MEDIA_URL_SCHEMES);
  if (!url || hasUnsafeCssSyntax(url) || /["']/.test(url)) {
    return '';
  }
  return `url("${url}")`;
}

function backgroundOverlayValue(value) {
  const color = cssColorValue(value);
  return color ? `linear-gradient(${color},${color})` : '';
}

function radialAccentValue(props) {
  if (props.backgroundAccentType !== 'radial') {
    return '';
  }

  const color1 = cssColorValue(props.backgroundAccentColor1);
  const color2 = cssColorValue(props.backgroundAccentColor2) || 'transparent';
  if (!color1) {
    return '';
  }

  const x = cssValue(props.backgroundAccentPositionX) || '50%';
  const y = cssValue(props.backgroundAccentPositionY) || '50%';
  const size = cssValue(props.backgroundAccentSize) || '50%';
  return `radial-gradient(circle at ${x} ${y},${color1} 0,${color2} ${size})`;
}

function gradientValue(props) {
  const color1 = cssColorValue(props.gradientColor1);
  const color2 = cssColorValue(props.gradientColor2);
  if (!color1 || !color2) {
    return '';
  }

  if (props.gradientType === 'radial') {
    return `radial-gradient(circle,${color1},${color2})`;
  }

  return `linear-gradient(${gradientAngleValue(props.gradientAngle)},${color1},${color2})`;
}

function gradientAngleValue(value) {
  const angle = typeof value === 'number' ? value : Number(String(value || '').trim());
  return Number.isFinite(angle) && angle >= 0 && angle <= 360 ? `${angle}deg` : '135deg';
}

function cssColorValue(value) {
  const css = cssValue(value);
  if (!css || /url\s*\(/i.test(css)) {
    return '';
  }
  return css;
}

function gridPlacement(start, span) {
  const normalizedStart = cssGridLineValue(start);
  const normalizedSpan = cssGridSpanValue(span);
  if (normalizedStart && normalizedSpan) {
    return `${normalizedStart} / span ${normalizedSpan}`;
  }
  if (normalizedStart) {
    return normalizedStart;
  }
  if (normalizedSpan) {
    return `span ${normalizedSpan}`;
  }
  return '';
}

function cssGridLineValue(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : '';
}

function cssGridSpanValue(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : '';
}

function boxShadowValue(value, props = {}) {
  const color = cssColorValue(props.boxShadowColor);
  if (color) {
    const rules = [
      [props.boxShadowOffsetX, '0px', -9999, Number.POSITIVE_INFINITY],
      [props.boxShadowOffsetY, '8px', -9999, Number.POSITIVE_INFINITY],
      [props.boxShadowBlur, '24px', 0, 2000],
      [props.boxShadowSpread, '0px', -9999, 9999],
    ];
    const lengths = rules.map(([rawValue, fallback, min, max]) => {
      const normalized = cssValue(rawValue) || fallback;
      const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)$/iu.exec(normalized === '0' ? '0px' : normalized);
      const number = match ? Number(match[1]) : NaN;
      return match && Number.isFinite(number) && number >= min && number <= max
        ? `${match[1]}${match[2]}`
        : '';
    });
    if (lengths.every(Boolean)) {
      return `${props.boxShadowInset === true ? 'inset ' : ''}${lengths.join(' ')} ${color}`;
    }
  }
  return SHADOWS.get(String(value || '')) || cssValue(value);
}

function cssNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : cssValue(value);
}

function cssFontFamilyValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const systemStack = SYSTEM_FONT_STACKS.get(value.trim());
  if (systemStack) {
    return systemStack;
  }

  const families = value
    .split(',')
    .map((family) => family.trim())
    .filter(Boolean);

  if (families.length === 0) {
    return '';
  }

  const normalized = [];
  for (const family of families) {
    const quote = family[0];
    const quoted = (quote === '"' || quote === "'") && family[family.length - 1] === quote;
    const name = (quoted ? family.slice(1, -1).trim() : family).replace(/_/g, ' ');
    if (!name || !/^[a-zA-Z0-9 _-]+$/.test(name)) {
      return '';
    }
    normalized.push(quoted || name.includes(' ') ? `"${name}"` : name);
  }

  if (normalized.length === 1 && !NON_GOOGLE_FONT_NAMES.has(normalized[0].replace(/"/g, '').toLowerCase())) {
    normalized.push('sans-serif');
  }

  return normalized.join(',');
}

function cssValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || hasUnsafeCssSyntax(trimmed)) {
    return '';
  }
  return trimmed;
}

function safeUrlValue(value, allowedSchemes) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    return '';
  }

  const scheme = trimmed.match(URL_SCHEME_PATTERN);
  if (scheme && !allowedSchemes.has(scheme[1].toLowerCase())) {
    return '';
  }

  return trimmed;
}

function safeTextValue(value, fallback = '') {
  if (typeof value !== 'string' || CONTROL_CHARACTER_PATTERN.test(value)) {
    return fallback;
  }
  return value.trim();
}

function safeMaterialIcon(value) {
  const icon = safeTextValue(value);
  return /^[a-z][a-z0-9_]{0,63}$/.test(icon) ? icon : '';
}

function safeIdentifier(value) {
  const identifier = safeTextValue(value);
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(identifier) ? identifier : '';
}

function safeFieldName(value, index) {
  return safeIdentifier(value) || `field_${index + 1}`;
}

function formOptions(value) {
  if (typeof value !== 'string') {
    return [];
  }
  return value.split(/\r?\n/).map((line) => {
    const [rawLabel, ...rawValue] = line.split('|');
    const label = safeTextValue(rawLabel);
    const valuePart = safeTextValue(rawValue.join('|'));
    if (!label || (valuePart && !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,127}$/.test(valuePart))) {
      return null;
    }
    return { label, value: valuePart || label };
  }).filter(Boolean);
}

function formBorderWidth(value) {
  return new Map([['border', '1px'], ['border-2', '2px'], ['border-4', '4px'], ['border-8', '8px']]).get(String(value || '').trim()) || cssValue(value);
}

function formBorderRadius(value) {
  return new Map([['rounded-sm', '0.125rem'], ['rounded', '0.25rem'], ['rounded-lg', '0.5rem'], ['rounded-xl', '0.75rem'], ['rounded-2xl', '1rem'], ['rounded-full', '9999px']]).get(String(value || '').trim()) || cssValue(value);
}

function formFontWeight(value) {
  const token = String(value || '').trim();
  const mapped = new Map([['font-thin', '100'], ['font-extralight', '200'], ['font-light', '300'], ['font-normal', '400'], ['font-medium', '500'], ['font-semibold', '600'], ['font-bold', '700'], ['font-extrabold', '800'], ['font-black', '900']]).get(token);
  return mapped || (/^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(token) ? token : '');
}

function formLetterSpacing(value) {
  return new Map([['tracking-tighter', '-0.05em'], ['tracking-tight', '-0.025em'], ['tracking-normal', '0'], ['tracking-wide', '0.025em'], ['tracking-wider', '0.05em'], ['tracking-widest', '0.1em']]).get(String(value || '').trim()) || '';
}

function formTextTransform(value) {
  return ['uppercase', 'lowercase', 'capitalize'].includes(String(value || '').trim()) ? String(value).trim() : 'none';
}

function hasUnsafeCssSyntax(value) {
  return CONTROL_CHARACTER_PATTERN.test(value)
    || /[;<>{}\\]/.test(value)
    || /\/\*|\*\//.test(value)
    || UNSAFE_CSS_PAYLOAD_PATTERN.test(value);
}

function textProp(props) {
  return String(props.text || props.content || props.children || '');
}

function safeHeadingTag(value) {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'].includes(value) ? value : 'h2';
}

function safeSectionTag(value) {
  return ['section', 'header', 'footer', 'main', 'aside', 'nav'].includes(value) ? value : 'section';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function baseCss() {
  return [
    '*,*::before,*::after{box-sizing:border-box}',
    'body{margin:0;background:#f7f7f4;color:#111;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    '.monteby-preview{width:100%;overflow:hidden}',
    '.monteby-preview p,.monteby-preview h1,.monteby-preview h2,.monteby-preview h3,.monteby-preview h4,.monteby-preview h5,.monteby-preview h6{margin-top:0;margin-bottom:0}',
    '@media (max-width:900px){.gotoweb-margin-left--responsive{margin-left:var(--gotoweb-margin-left-tablet,var(--gotoweb-margin-left-base))!important}}',
    '@media (max-width:767px){.gotoweb-margin-left--responsive{margin-left:var(--gotoweb-margin-left-mobile,var(--gotoweb-margin-left-tablet,var(--gotoweb-margin-left-base)))!important}}',
    '.monteby-preview a{cursor:pointer}',
    '.material-symbols-rounded{font-family:"Material Symbols Rounded";font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr}',
    'img{display:block}',
    '.monteby-preview-form-control:focus{outline:2px solid var(--monteby-preview-form-focus-color,#2563eb);outline-offset:2px}',
    '.gotoweb-tabs{min-width:0}.gotoweb-tabs__bar{min-width:0}.gotoweb-tabs__bar button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.gotoweb-tabs__bar button[aria-selected="true"]{color:var(--monteby-tabs-active-color,#fff)!important;background-color:var(--monteby-tabs-active-background,#18181b)!important;border-color:var(--monteby-tabs-active-border-color,transparent)!important;border-width:var(--monteby-tabs-active-border-width,0)!important}.gotoweb-tabs__bar button[aria-selected="true"] .gotoweb-tabs__tab-meta{color:var(--monteby-tabs-active-meta-color,currentColor)!important}.gotoweb-tabs__panel[hidden]{display:none!important}.gotoweb-tabs__panel,.gotoweb-tabs__content,.gotoweb-tabs__image{min-width:0}',
    '@media (max-width:1023px){.gotoweb-tabs[data-panel-stack-at="tablet"] .gotoweb-tabs__panel--with-image{grid-template-columns:minmax(0,1fr)!important}}',
    '@media (min-width:768px) and (max-width:1023px){.gotoweb-tabs[data-tabs-responsive].gotoweb-tabs--vertical{grid-template-columns:minmax(0,var(--gotoweb-tabs-tab-bar-width-tablet,var(--gotoweb-tabs-tab-bar-width-base,320px))) minmax(0,1fr)!important}.gotoweb-tabs[data-tabs-responsive]>.gotoweb-tabs__bar{width:var(--gotoweb-tabs-tab-bar-width-tablet,var(--gotoweb-tabs-tab-bar-width-base,100%))!important}.gotoweb-tabs[data-tabs-responsive]>.gotoweb-tabs__bar>button{width:var(--gotoweb-tabs-tab-width-tablet,var(--gotoweb-tabs-tab-width-base,auto))!important;min-height:var(--gotoweb-tabs-tab-min-height-tablet,var(--gotoweb-tabs-tab-min-height-base,44px))!important;font-size:var(--gotoweb-tabs-tab-font-size-tablet,var(--gotoweb-tabs-tab-font-size-base,inherit))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__panel{padding:var(--gotoweb-tabs-panel-padding-tablet,var(--gotoweb-tabs-panel-padding-base,20px))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__panel--with-image{gap:var(--gotoweb-tabs-panel-gap-tablet,var(--gotoweb-tabs-panel-gap-base,24px))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__content{padding-top:var(--gotoweb-tabs-panel-content-padding-top-tablet,var(--gotoweb-tabs-panel-content-padding-top-base,0))!important;padding-right:var(--gotoweb-tabs-panel-content-padding-x-tablet,var(--gotoweb-tabs-panel-content-padding-x-base,0))!important;padding-bottom:var(--gotoweb-tabs-panel-content-padding-bottom-tablet,var(--gotoweb-tabs-panel-content-padding-bottom-base,0))!important;padding-left:var(--gotoweb-tabs-panel-content-padding-x-tablet,var(--gotoweb-tabs-panel-content-padding-x-base,0))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__title{font-size:var(--gotoweb-tabs-panel-title-font-size-tablet,var(--gotoweb-tabs-panel-title-font-size-base,inherit))!important;line-height:var(--gotoweb-tabs-panel-title-line-height-tablet,var(--gotoweb-tabs-panel-title-line-height-base,normal))!important;margin-bottom:var(--gotoweb-tabs-panel-title-margin-bottom-tablet,var(--gotoweb-tabs-panel-title-margin-bottom-base,0))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__eyebrow{line-height:var(--gotoweb-tabs-panel-eyebrow-line-height-tablet,var(--gotoweb-tabs-panel-eyebrow-line-height-base,normal))!important;margin-bottom:var(--gotoweb-tabs-panel-eyebrow-margin-bottom-tablet,var(--gotoweb-tabs-panel-eyebrow-margin-bottom-base,0))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__image{height:var(--gotoweb-tabs-panel-image-height-tablet,var(--gotoweb-tabs-panel-image-height-base,auto))!important;object-position:var(--gotoweb-tabs-panel-image-object-position-x-tablet,var(--gotoweb-tabs-panel-image-object-position-x-base,50%)) var(--gotoweb-tabs-panel-image-object-position-y-tablet,var(--gotoweb-tabs-panel-image-object-position-y-base,50%))!important}}',
    '@media (max-width:767px){.gotoweb-tabs--vertical{grid-template-columns:minmax(0,1fr)!important}.gotoweb-tabs--mobile-scroll>.gotoweb-tabs__bar,.gotoweb-tabs[data-mobile-tab-layout="scroll"]>.gotoweb-tabs__bar{width:var(--gotoweb-tabs-tab-bar-width-mobile,var(--gotoweb-tabs-tab-bar-width-tablet,var(--gotoweb-tabs-tab-bar-width-base,100%)))!important;max-width:100%;flex-direction:row!important;flex-wrap:nowrap!important;align-items:stretch!important;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:thin}.gotoweb-tabs--mobile-scroll>.gotoweb-tabs__bar>button,.gotoweb-tabs[data-mobile-tab-layout="scroll"]>.gotoweb-tabs__bar>button{width:var(--gotoweb-tabs-tab-width-mobile,var(--gotoweb-tabs-tab-width-tablet,var(--gotoweb-tabs-tab-width-base,auto)))!important;flex:0 0 auto!important;scroll-snap-align:start}.gotoweb-tabs--mobile-wrap>.gotoweb-tabs__bar,.gotoweb-tabs[data-mobile-tab-layout="wrap"]>.gotoweb-tabs__bar{width:100%!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:stretch!important}.gotoweb-tabs--mobile-stack>.gotoweb-tabs__bar,.gotoweb-tabs[data-mobile-tab-layout="stack"]>.gotoweb-tabs__bar{width:100%!important;flex-direction:column!important;align-items:stretch!important}.gotoweb-tabs--mobile-stack>.gotoweb-tabs__bar>button,.gotoweb-tabs[data-mobile-tab-layout="stack"]>.gotoweb-tabs__bar>button{width:100%!important}.gotoweb-tabs[data-tabs-responsive]>.gotoweb-tabs__bar>button{min-height:var(--gotoweb-tabs-tab-min-height-mobile,var(--gotoweb-tabs-tab-min-height-tablet,var(--gotoweb-tabs-tab-min-height-base,44px)))!important;font-size:var(--gotoweb-tabs-tab-font-size-mobile,var(--gotoweb-tabs-tab-font-size-tablet,var(--gotoweb-tabs-tab-font-size-base,inherit)))!important}.gotoweb-tabs__panel--with-image{grid-template-columns:minmax(0,1fr)!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__panel{padding:var(--gotoweb-tabs-panel-padding-mobile,var(--gotoweb-tabs-panel-padding-tablet,var(--gotoweb-tabs-panel-padding-base,20px)))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__panel--with-image{gap:var(--gotoweb-tabs-panel-gap-mobile,var(--gotoweb-tabs-panel-gap-tablet,var(--gotoweb-tabs-panel-gap-base,24px)))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__content{max-width:100%!important;padding-top:var(--gotoweb-tabs-panel-content-padding-top-mobile,var(--gotoweb-tabs-panel-content-padding-top-tablet,var(--gotoweb-tabs-panel-content-padding-top-base,0)))!important;padding-right:var(--gotoweb-tabs-panel-content-padding-x-mobile,var(--gotoweb-tabs-panel-content-padding-x-tablet,var(--gotoweb-tabs-panel-content-padding-x-base,0)))!important;padding-bottom:var(--gotoweb-tabs-panel-content-padding-bottom-mobile,var(--gotoweb-tabs-panel-content-padding-bottom-tablet,var(--gotoweb-tabs-panel-content-padding-bottom-base,0)))!important;padding-left:var(--gotoweb-tabs-panel-content-padding-x-mobile,var(--gotoweb-tabs-panel-content-padding-x-tablet,var(--gotoweb-tabs-panel-content-padding-x-base,0)))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__title{font-size:var(--gotoweb-tabs-panel-title-font-size-mobile,var(--gotoweb-tabs-panel-title-font-size-tablet,var(--gotoweb-tabs-panel-title-font-size-base,inherit)))!important;line-height:var(--gotoweb-tabs-panel-title-line-height-mobile,var(--gotoweb-tabs-panel-title-line-height-tablet,var(--gotoweb-tabs-panel-title-line-height-base,normal)))!important;margin-bottom:var(--gotoweb-tabs-panel-title-margin-bottom-mobile,var(--gotoweb-tabs-panel-title-margin-bottom-tablet,var(--gotoweb-tabs-panel-title-margin-bottom-base,0)))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__eyebrow{line-height:var(--gotoweb-tabs-panel-eyebrow-line-height-mobile,var(--gotoweb-tabs-panel-eyebrow-line-height-tablet,var(--gotoweb-tabs-panel-eyebrow-line-height-base,normal)))!important;margin-bottom:var(--gotoweb-tabs-panel-eyebrow-margin-bottom-mobile,var(--gotoweb-tabs-panel-eyebrow-margin-bottom-tablet,var(--gotoweb-tabs-panel-eyebrow-margin-bottom-base,0)))!important}.gotoweb-tabs[data-tabs-responsive] .gotoweb-tabs__image{width:100%!important;height:var(--gotoweb-tabs-panel-image-height-mobile,var(--gotoweb-tabs-panel-image-height-tablet,var(--gotoweb-tabs-panel-image-height-base,auto)))!important;object-position:var(--gotoweb-tabs-panel-image-object-position-x-mobile,var(--gotoweb-tabs-panel-image-object-position-x-tablet,var(--gotoweb-tabs-panel-image-object-position-x-base,50%))) var(--gotoweb-tabs-panel-image-object-position-y-mobile,var(--gotoweb-tabs-panel-image-object-position-y-tablet,var(--gotoweb-tabs-panel-image-object-position-y-base,50%)))!important}}',
    '@media (max-width:900px){.monteby-preview-navbar__inner{padding-top:var(--monteby-navbar-inner-padding-y-tablet,var(--monteby-navbar-inner-padding-y-base))!important;padding-bottom:var(--monteby-navbar-inner-padding-y-tablet,var(--monteby-navbar-inner-padding-y-base))!important}}',
    '@media (max-width:767px){.monteby-preview-navbar__inner{padding-top:var(--monteby-navbar-inner-padding-y-mobile,var(--monteby-navbar-inner-padding-y-tablet,var(--monteby-navbar-inner-padding-y-base)))!important;padding-bottom:var(--monteby-navbar-inner-padding-y-mobile,var(--monteby-navbar-inner-padding-y-tablet,var(--monteby-navbar-inner-padding-y-base)))!important}}',
    '@media (max-width:1023px){.monteby-preview-navbar--hide-links-wide .monteby-preview-navbar__menu{display:none!important}.monteby-preview-navbar--hide-links-wide .monteby-preview-navbar__inner{flex-wrap:nowrap!important}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__desktop{display:none!important}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__toggle{display:inline-flex!important;margin-left:auto}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__drawer{width:100%;flex:1 0 100%;flex-direction:column;align-items:stretch;justify-content:flex-start}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__drawer:not([hidden]){display:flex}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__menu{width:100%;flex-direction:column;align-items:stretch}.monteby-preview-navbar--drawer-wide .monteby-preview-navbar__actions{width:100%}}',
    '@media (max-width:900px){.monteby-preview-navbar--hide-links-tablet .monteby-preview-navbar__menu{display:none!important}.monteby-preview-navbar--hide-links-tablet .monteby-preview-navbar__inner{flex-wrap:nowrap!important}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__desktop{display:none!important}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__toggle{display:inline-flex!important;margin-left:auto}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__drawer{width:100%;flex:1 0 100%;flex-direction:column;align-items:stretch;justify-content:flex-start}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__drawer:not([hidden]){display:flex}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__menu{width:100%;flex-direction:column;align-items:stretch}.monteby-preview-navbar--drawer-tablet .monteby-preview-navbar__actions{width:100%}}',
    '@media (max-width:767px){.monteby-preview-navbar--hide-links-mobile .monteby-preview-navbar__menu{display:none!important}.monteby-preview-navbar--hide-links-mobile .monteby-preview-navbar__inner{flex-wrap:nowrap!important}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__desktop{display:none!important}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__toggle{display:inline-flex!important;margin-left:auto}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__drawer{width:100%;flex:1 0 100%;flex-direction:column;align-items:stretch;justify-content:flex-start}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__drawer:not([hidden]){display:flex}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__menu{width:100%;flex-direction:column;align-items:stretch}.monteby-preview-navbar--drawer-mobile .monteby-preview-navbar__actions{width:100%}.monteby-preview-form--two-columns{grid-template-columns:minmax(0,1fr)!important}.monteby-preview-form--two-columns>*{grid-column:auto!important}}',
    '@media (min-width: 901px){.monteby-show-tablet-down-only{display:none!important}}',
    '@media (min-width: 768px){.monteby-show-mobile-only{display:none!important}}',
    '@media (max-width: 900px){.monteby-stack-tablet{flex-direction:column!important;grid-template-columns:minmax(0,1fr)!important}.monteby-stack-tablet>*{width:100%!important;max-width:100%!important;flex-basis:auto!important}.monteby-hide-tablet-down{display:none!important}}',
    '@media (max-width: 767px){.monteby-stack-mobile{flex-direction:column!important;grid-template-columns:minmax(0,1fr)!important}.monteby-stack-mobile>*{width:100%!important;max-width:100%!important;flex-basis:auto!important}.monteby-hide-mobile{display:none!important}}',
    '@media (max-width: 900px){.monteby-sticky-reset-tablet{position:static!important;top:auto!important}}',
    '@media (max-width: 767px){.monteby-sticky-reset-mobile{position:static!important;top:auto!important}}',
    '@media (max-width: 900px){.gotoweb-grid-template-columns--responsive{grid-template-columns:var(--gotoweb-grid-template-columns-tablet,var(--gotoweb-grid-template-columns-base))!important}}',
    '@media (max-width: 767px){.gotoweb-grid-template-columns--responsive{grid-template-columns:var(--gotoweb-grid-template-columns-mobile,var(--gotoweb-grid-template-columns-tablet,var(--gotoweb-grid-template-columns-base)))!important}}',
    '@media (max-width: 900px){[style*="--monteby-font-size-tablet"]{font-size:var(--monteby-font-size-tablet)!important}[style*="--monteby-min-height-tablet"]{min-height:var(--monteby-min-height-tablet)!important}[style*="--monteby-padding-top-tablet"]{padding-top:var(--monteby-padding-top-tablet)!important}[style*="--monteby-padding-right-tablet"]{padding-right:var(--monteby-padding-right-tablet)!important}[style*="--monteby-padding-bottom-tablet"]{padding-bottom:var(--monteby-padding-bottom-tablet)!important}[style*="--monteby-padding-left-tablet"]{padding-left:var(--monteby-padding-left-tablet)!important}[style*="--monteby-margin-top-tablet"]{margin-top:var(--monteby-margin-top-tablet)!important}[style*="--monteby-margin-bottom-tablet"]{margin-bottom:var(--monteby-margin-bottom-tablet)!important}[style*="--monteby-gap-tablet"]{gap:var(--monteby-gap-tablet)!important}[style*="--monteby-max-width-tablet"]{max-width:var(--monteby-max-width-tablet)!important}[style*="--monteby-line-height-tablet"]{line-height:var(--monteby-line-height-tablet)!important}[style*="--monteby-text-align-tablet"]{text-align:var(--monteby-text-align-tablet)!important}[style*="--monteby-background-position-x-tablet"]{background-position-x:var(--monteby-background-position-x-tablet)!important}[style*="--monteby-background-position-y-tablet"]{background-position-y:var(--monteby-background-position-y-tablet)!important}[style*="--monteby-flex-direction-tablet"]{flex-direction:var(--monteby-flex-direction-tablet)!important}[style*="--monteby-flex-wrap-tablet"]{flex-wrap:var(--monteby-flex-wrap-tablet)!important}[style*="--monteby-justify-content-tablet"]{justify-content:var(--monteby-justify-content-tablet)!important}[style*="--monteby-align-items-tablet"]{align-items:var(--monteby-align-items-tablet)!important}[style*="--monteby-grid-template-columns-tablet"]{grid-template-columns:var(--monteby-grid-template-columns-tablet)!important}[style*="--monteby-grid-column-tablet"]{grid-column:var(--monteby-grid-column-tablet)!important}[style*="--monteby-grid-row-tablet"]{grid-row:var(--monteby-grid-row-tablet)!important}}',
    '@media (max-width: 767px){[style*="--monteby-font-size-mobile"]{font-size:var(--monteby-font-size-mobile)!important}[style*="--monteby-min-height-mobile"]{min-height:var(--monteby-min-height-mobile)!important}[style*="--monteby-padding-top-mobile"]{padding-top:var(--monteby-padding-top-mobile)!important}[style*="--monteby-padding-right-mobile"]{padding-right:var(--monteby-padding-right-mobile)!important}[style*="--monteby-padding-bottom-mobile"]{padding-bottom:var(--monteby-padding-bottom-mobile)!important}[style*="--monteby-padding-left-mobile"]{padding-left:var(--monteby-padding-left-mobile)!important}[style*="--monteby-margin-top-mobile"]{margin-top:var(--monteby-margin-top-mobile)!important}[style*="--monteby-margin-bottom-mobile"]{margin-bottom:var(--monteby-margin-bottom-mobile)!important}[style*="--monteby-gap-mobile"]{gap:var(--monteby-gap-mobile)!important}[style*="--monteby-max-width-mobile"]{max-width:var(--monteby-max-width-mobile)!important}[style*="--monteby-line-height-mobile"]{line-height:var(--monteby-line-height-mobile)!important}[style*="--monteby-text-align-mobile"]{text-align:var(--monteby-text-align-mobile)!important}[style*="--monteby-background-position-x-mobile"]{background-position-x:var(--monteby-background-position-x-mobile)!important}[style*="--monteby-background-position-y-mobile"]{background-position-y:var(--monteby-background-position-y-mobile)!important}[style*="--monteby-flex-direction-mobile"]{flex-direction:var(--monteby-flex-direction-mobile)!important}[style*="--monteby-flex-wrap-mobile"]{flex-wrap:var(--monteby-flex-wrap-mobile)!important}[style*="--monteby-justify-content-mobile"]{justify-content:var(--monteby-justify-content-mobile)!important}[style*="--monteby-align-items-mobile"]{align-items:var(--monteby-align-items-mobile)!important}[style*="--monteby-grid-template-columns-mobile"]{grid-template-columns:var(--monteby-grid-template-columns-mobile)!important}[style*="--monteby-grid-column-mobile"]{grid-column:var(--monteby-grid-column-mobile)!important}[style*="--monteby-grid-row-mobile"]{grid-row:var(--monteby-grid-row-mobile)!important}}',
    '@media (max-width: 900px){[style*="--monteby-margin-left-tablet"]{margin-left:var(--monteby-margin-left-tablet)!important}}',
    '@media (max-width: 767px){[style*="--monteby-margin-left-mobile"]{margin-left:var(--monteby-margin-left-mobile)!important}}',
  ].join('');
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const nodeMap = extractNodeMap(readJson(options.layout));
    const rendered = renderDocument(nodeMap, options.title);
    writeFile(options.out, rendered.html);
    if (options.fragmentOut) {
      writeFile(options.fragmentOut, rendered.fragment);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  googleFontToken,
};
