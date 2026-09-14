'use strict';

function createHistoricalBenchmarkRecipes(dependencies) {
  const {
    addButton,
    addHeading,
    addText,
    arrayOfStrings,
    backgroundProps,
    brandName,
    createCanvasNode,
    createLeafNode,
    cssLengthValue,
    defaultReplacementProfile,
    eyebrowText,
    findComponent,
    firstCta,
    firstAllowedProp,
    firstEmailText,
    firstHeading,
    h3Texts,
    mediaVariant,
    normalizeAuthoredText,
    primaryAction,
    proofCopy,
    referenceRectLength,
    requiredMediaRoles,
    requiredRoleMinimum,
    scalePxLength,
    secondHeading,
    secondaryAction,
    serviceCopy,
    slugify,
    statItems,
  } = dependencies;

const REPLACEMENT_PROFILES = [
  {
    name: 'luxury-car-care',
    match: ['luxury-car-care', 'careglo', 'car-detailing', 'detailing', 'car care'],
    brand: 'Aureline',
    heroEyebrow: 'A finish engineered to last',
    heroHeading: 'Crafted Care for a Lasting First Impression.',
    navCta: 'Reserve a Visit',
    primaryCta: 'Reserve Your Detail',
    secondaryCta: 'Explore Treatments',
    lead: 'Premium detailing, protective finishes, and appointment-ready care for high-value vehicles.',
    serviceCopy: [
      'Exterior and paint-safe detailing built around premium finish quality.',
      'Interior reset work with careful materials, equipment, and hand-finished surfaces.',
      'Protection packages that keep the vehicle looking sharp between visits.',
    ],
    proof: {
      eyebrow: 'SIGNATURE SLOT',
      title: 'Reserve a detail bay in under three minutes.',
      body: 'Choose a treatment, reserve a time, and arrive knowing every finish detail is covered.',
      cta: 'Book detailing now',
    },
    style: {
      bg: '#0b0d12',
      panel: '#151820',
      ink: '#fff7ea',
      muted: '#a7adb9',
      accent: '#f5b66f',
      accent2: '#c88845',
      badgeBackground: '#171b23',
      navBackground: '#12151b',
      cardBackground: '#11141a',
      cardInk: '#fff7ea',
      cardMuted: '#a7adb9',
      buttonBg: '#f5b66f',
      buttonFg: '#18110a',
    },
    geometry: {
      maxWidth: '1220px',
      radius: '28px',
      heroMinHeight: '660px',
      visualMinHeight: '560px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '220px',
    },
    hero: 'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=1600',
    secondary: 'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
    serviceCard: [
      'https://images.pexels.com/photos/17029940/pexels-photo-17029940/free-photo-of-back-view-of-a-woman-cleaning-a-car.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/5233261/pexels-photo-5233261.jpeg?auto=compress&cs=tinysrgb&w=900',
      'https://images.pexels.com/photos/14615262/pexels-photo-14615262.jpeg?auto=compress&cs=tinysrgb&w=900',
    ],
  },
  {
    name: 'maid-service-agency',
    match: ['maid-service-agency', 'maidy', 'cleaning', 'home care', 'maid service'],
    brand: 'Tidyra',
    email: 'hello@tidyra.example',
    lead: 'Home cleaning, routine upkeep, and simple booking for spaces that need to feel calm again.',
    serviceCopy: [
      'Room-by-room cleaning for recurring home care and tidy weekly routines.',
      'Equipment-led deep cleaning for kitchens, bathrooms, and high-touch areas.',
      'Move-in and office refresh services with clear scope and fast scheduling.',
    ],
    proof: {
      eyebrow: 'QUICK BOOKING',
      title: 'Schedule a refresh before the week gets busy.',
      body: 'Choose the rooms, timing, and level of care that make the week feel lighter.',
      cta: 'Book cleaning',
    },
    style: {
      bg: '#f7f7f4',
      panel: '#ffffff',
      ink: '#060708',
      muted: '#7f817d',
      accent: '#315f4f',
      accent2: '#ffdd67',
      badgeBackground: '#f0eee8',
      navBackground: '#ffffff',
      cardBackground: '#ffffff',
      cardInk: '#060708',
      cardMuted: '#7f817d',
      buttonBg: '#203740',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1240px',
      radius: '26px',
      heroMinHeight: '720px',
      visualMinHeight: '560px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '210px',
    },
    hero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=82',
    secondary: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82',
    equipment: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=760&q=82&ix=monteby-equipment',
    serviceCard: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    name: 'optomatta-optical-retail',
    match: ['optomatta-optical-retail', 'optomatta', 'optical retail', 'eyewear', 'optometrist'],
    brand: 'Opticline',
    heroEyebrow: 'VISION & FRAME STUDIO',
    heroHeading: 'Clear vision, thoughtfully fitted',
    primaryCta: 'Plan an Eye Exam',
    secondaryCta: 'Explore Eyewear',
    lead: 'Modern eyewear, eye exams, and appointment support presented with bright retail clarity.',
    serviceCopy: [
      'Vision exams and optical guidance for clearer daily routines.',
      'Frame fitting support with practical guidance on style, comfort, and appointment timing.',
      'Lens care and follow-up services designed for long-term comfort.',
    ],
    proof: {
      eyebrow: 'VISION READY',
      title: 'Match the right frame and exam path faster.',
      body: 'Compare frames, plan an exam, and leave with a clearer path to everyday comfort.',
      cta: 'Book eye exam',
    },
    style: {
      bg: '#ffffff',
      panel: '#f4f6f9',
      ink: '#090d13',
      muted: '#5f6670',
      accent: '#0788d8',
      accent2: '#0a6fa7',
      badgeBackground: '#eef7ff',
      navBackground: '#ffffff',
      cardBackground: '#f4f6f9',
      cardInk: '#090d13',
      cardMuted: '#5f6670',
      buttonBg: '#0788d8',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1220px',
      radius: '24px',
      heroMinHeight: '680px',
      visualMinHeight: '540px',
      secondaryMinHeight: '200px',
      serviceMediaMinHeight: '200px',
    },
    hero: 'https://images.pexels.com/photos/6749748/pexels-photo-6749748.jpeg?auto=compress&cs=tinysrgb&w=1800',
    secondary: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1000&q=82',
    serviceCard: [
      'https://images.unsplash.com/photo-1517948430535-1e2469d314fe?auto=format&fit=crop&w=900&q=82',
      'https://images.unsplash.com/photo-1486250944723-86bca2b15b06?auto=format&fit=crop&w=900&q=82',
      'https://images.unsplash.com/photo-1743038560986-3b346b7c3b22?auto=format&fit=crop&w=900&q=82',
    ],
  },
  {
    name: 'lumen-eye-care-editorial',
    match: ['lumen-eye-care-editorial', 'lumen', 'eye care', 'doctor', 'clinic'],
    brand: 'CLEARWELL',
    lead: 'Editorial eye care, specialist guidance, and calm appointment pathways for everyday vision health.',
    serviceCopy: [
      'Vision testing shaped around clear communication and comfortable care rooms.',
      'Specialist consultations with a calmer clinical pace and proof-led guidance.',
      'Treatment planning that turns eye-care details into easy next steps.',
    ],
    proof: {
      eyebrow: 'CARE NOTE',
      title: 'Qualified eye care, explained clearly',
      body: 'Every examination combines professional attention, calm guidance, and practical next steps.',
      cta: 'Start visit',
    },
    style: {
      bg: '#eefbe3',
      panel: '#ffffff',
      ink: '#061a27',
      muted: '#526271',
      accent: '#0f7768',
      accent2: '#2fd678',
      badgeBackground: '#f8ffdc',
      navBackground: '#eefbe3',
      cardBackground: '#ffffff',
      cardInk: '#061a27',
      cardMuted: '#526271',
      buttonBg: '#0f7768',
      buttonFg: '#ffffff',
    },
    geometry: {
      maxWidth: '1280px',
      radius: '30px',
      heroMinHeight: '780px',
      visualMinHeight: '640px',
      secondaryMinHeight: '220px',
      serviceMediaMinHeight: '220px',
    },
    hero: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1200&q=82',
    secondary: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=82',
    serviceCard: [
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=700&q=80',
    ],
  },
];

const OPTOMATTA_CANVAS_WIDTH = '1440px';
const CAREGLO_CANVAS_WIDTH = '1440px';
const CAREGLO_AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
];
const LUMEN_CANVAS_WIDTH = '1440px';

function addNavSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  const caregloFallback = careglo && context.brief.authoringRequirements?.requireRealReference !== true;
  const caregloRealReference = careglo && !caregloFallback;
  const caregloNavBackground = caregloRealReference ? '#222731' : style.navBackground;
  const caregloAccent = caregloRealReference ? '#ffd0a8' : style.accent;
  const lumen = isLumenProfile(context);
  const optomatta = isOptomattaProfile(context);

  if (maidy) {
    addTopbarSection(context, sectionName, containerName);
  }

  const nav = createCanvasNode(context, sectionName, 'ROOT', {
    tag: maidy || careglo || lumen || optomatta ? 'header' : 'section',
    paddingTop: maidy || careglo || optomatta ? '0px' : lumen ? '18px' : '18px',
    paddingBottom: maidy || careglo || optomatta ? '0px' : lumen ? '10px' : '18px',
    innerMaxWidth: optomatta ? '1440px' : geometry.innerMaxWidth,
    innerPaddingX: optomatta ? '10px' : caregloRealReference ? '24px' : '20px',
    ...backgroundProps(context, sectionName, careglo ? caregloNavBackground : optomatta ? style.navBackground : style.bg),
    ...(lumen
      ? {
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
      }
      : {}),
  });
  const wrap = createCanvasNode(context, containerName, nav.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
    width: '100%',
    minHeight: caregloRealReference ? '87px' : undefined,
    minHeightTablet: caregloRealReference ? '87px' : undefined,
    minHeightMobile: caregloRealReference ? '87px' : undefined,
    ...(lumen ? {} : backgroundProps(context, containerName, careglo ? caregloNavBackground : style.navBackground)),
    borderRadius: maidy || careglo || lumen || optomatta ? '0px' : geometry.navRadius,
    paddingTop: maidy ? '26px' : caregloRealReference ? '16px' : careglo ? '18px' : optomatta ? '20px' : lumen ? '20px' : '14px',
    paddingTopTablet: optomatta ? '22px' : undefined,
    paddingTopMobile: optomatta ? '27px' : undefined,
    paddingRight: careglo || lumen || optomatta ? '0px' : '18px',
    paddingBottom: maidy ? '26px' : caregloRealReference ? '17px' : careglo ? '18px' : optomatta ? '20px' : lumen ? '18px' : '14px',
    paddingBottomTablet: optomatta ? '23px' : undefined,
    paddingBottomMobile: optomatta ? '27px' : undefined,
    paddingLeft: careglo || lumen || optomatta ? '0px' : '18px',
    paddingLeftTablet: maidy ? '10px' : undefined,
    paddingLeftMobile: maidy ? '0px' : undefined,
    paddingRightTablet: maidy ? '10px' : undefined,
    paddingRightMobile: maidy ? '0px' : undefined,
  });

  if (maidy) {
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
    });
    createCanvasNode(context, containerName, brand.id, {
      width: '44px',
      minHeight: '44px',
      flexShrink: 0,
      borderRadius: '12px',
      ...backgroundProps(context, containerName, maidyPanelColor(context)),
      backgroundAccentType: 'radial',
      backgroundAccentColor1: maidyHighlightColor(context),
      backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
      backgroundAccentPositionX: '72%',
      backgroundAccentPositionY: '28%',
      backgroundAccentSize: '18px',
    });
    addText(context, brand.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '22px',
      fontWeight: '900',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else if (careglo || optomatta) {
    const geometricCaregloMark = careglo && !caregloFallback;
    const displayBrand = brandName(context.brief, context.replacementProfile);
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: optomatta ? '10px' : geometricCaregloMark ? '8px' : '12px',
      width: caregloFallback ? '190px' : careglo ? '150px' : undefined,
      flexShrink: careglo ? 0 : undefined,
    });
    const mark = createCanvasNode(context, containerName, brand.id, {
      width: optomatta ? '42px' : '30px',
      minHeight: optomatta ? '28px' : geometricCaregloMark ? '24px' : '30px',
      flexShrink: 0,
      borderRadius: geometricCaregloMark ? '0px' : '999px',
      layoutDisplay: geometricCaregloMark ? 'flex' : undefined,
      flexDirection: geometricCaregloMark ? 'column' : undefined,
      justifyContent: geometricCaregloMark ? 'center' : undefined,
      alignItems: geometricCaregloMark ? 'center' : undefined,
      ...backgroundProps(context, containerName, geometricCaregloMark ? 'transparent' : style.accent),
    });
    if (!optomatta) {
      addText(context, mark.id, geometricCaregloMark ? displayBrand.slice(0, 1).toUpperCase() : 'C', {
        fontSize: geometricCaregloMark ? '24px' : '12px',
        lineHeight: '1',
        fontWeight: '900',
        textAlign: 'center',
        textColor: geometricCaregloMark ? caregloAccent : style.buttonFg,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addText(context, brand.id, optomatta ? displayBrand.toUpperCase() : caregloFallback ? 'Luxury Car Care' : displayBrand, {
      fontSize: optomatta ? '32px' : caregloFallback ? '16px' : '20px',
      fontSizeMobile: optomatta ? '24px' : undefined,
      fontWeight: optomatta ? '900' : '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else if (lumen) {
    const brand = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
    });
    createCanvasNode(context, containerName, brand.id, {
      width: '50px',
      minHeight: '50px',
      flexShrink: 0,
      borderRadius: '999px',
      ...backgroundProps(context, containerName, style.accent2),
    });
    addText(context, brand.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '42px',
      fontWeight: '400',
      lineHeight: '1',
      letterSpacing: '0px',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else {
    addText(context, wrap.id, brandName(context.brief, context.replacementProfile), {
      fontSize: '20px',
      fontWeight: '800',
      textColor: style.ink,
    });
  }
  const navLinks = maidy
    ? ['Home', 'About', 'Services', 'Plans', 'Contact']
    : careglo
      ? caregloFallback ? ['Services', 'Results', 'Process', 'Contact'] : ['Home', 'Studio', 'Treatments', 'Care guide', 'Results', 'Contact']
      : optomatta
        ? ['Home', 'About', 'Services', 'Shop', 'Contact']
        : lumen
          ? ['HOME', 'ABOUT', 'CARE +', 'JOURNAL +', 'CONTACT']
      : ['Services', 'Proof', 'Plans'];
  const navLinksWrap = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: caregloRealReference ? 'flex-start' : 'center',
    alignItems: 'center',
    gap: maidy ? '38px' : caregloFallback ? '28px' : careglo ? '0px' : optomatta ? '42px' : lumen ? '34px' : '18px',
    paddingLeft: caregloRealReference ? '188px' : undefined,
    flexGrow: maidy || careglo || lumen ? 1 : undefined,
    flexShrink: careglo ? 0 : undefined,
    responsiveDisplay: 'hide-tablet-down',
  });
  for (const link of navLinks) {
    addText(context, navLinksWrap.id, link, {
      display: careglo && !caregloFallback ? 'inline-flex' : undefined,
      fontSize: maidy ? '15px' : caregloFallback ? '12px' : careglo || optomatta ? '16px' : lumen ? '13px' : '14px',
      fontWeight: careglo && !caregloFallback ? '400' : careglo ? '650' : optomatta ? '500' : maidy ? '800' : '700',
      fontFamily: caregloRealReference ? 'Poppins' : undefined,
      letterSpacing: lumen ? '0.06em' : undefined,
      textColor: careglo || lumen || maidy || optomatta ? style.ink : style.muted,
      paddingY: careglo && !caregloFallback ? '16px' : undefined,
      paddingX: careglo && !caregloFallback ? '18px' : undefined,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  if (maidy) {
    const action = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
    });
    const contactAction = createCanvasNode(context, containerName, action.id, {
      responsiveDisplay: 'hide-mobile',
      flexShrink: 0,
    });
    addButton(context, contactAction.id, 'Contact', '#', {
      paddingTop: '16px',
      paddingRight: '28px',
      paddingBottom: '16px',
      paddingLeft: '28px',
      borderRadius: '0px',
      fontWeight: '800',
      backgroundColor: maidyHighlightColor(context),
      textColor: style.ink,
    });
    const phoneAction = createCanvasNode(context, containerName, action.id, {
      responsiveDisplay: 'show-mobile-only',
    });
    addButton(context, phoneAction.id, '☎', '#', {
      paddingTop: '9px',
      paddingRight: '10px',
      paddingBottom: '9px',
      paddingLeft: '10px',
      borderRadius: '0px',
      fontSize: '14px',
      fontWeight: '800',
      backgroundColor: maidyHighlightColor(context),
      textColor: style.ink,
    });
    const menuAction = createCanvasNode(context, containerName, action.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '5px',
      responsiveDisplay: 'show-tablet-down-only',
      width: '30px',
      minHeight: '34px',
      flexShrink: 0,
    });
    for (let index = 0; index < 3; index += 1) {
      createCanvasNode(context, containerName, menuAction.id, {
        width: '22px',
        minHeight: '2px',
        ...backgroundProps(context, containerName, maidyPanelColor(context)),
      });
    }
    return;
  }

  const responsiveDisplayOptions = context.contractIndex.get(containerName)?.propOptions?.get('responsiveDisplay');
  const canShowTabletDownOnly = responsiveDisplayOptions?.has('show-tablet-down-only') === true;
  let actionParentId;
  let caregloActionGroup = null;
  if (caregloRealReference && canShowTabletDownOnly) {
    caregloActionGroup = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
    });
    actionParentId = createCanvasNode(context, containerName, caregloActionGroup.id, {
      responsiveDisplay: 'hide-mobile',
      flexShrink: 0,
    }).id;
  } else {
    actionParentId = optomatta || careglo || lumen
      ? createCanvasNode(context, containerName, wrap.id, {
        responsiveDisplay: careglo ? 'hide-mobile' : optomatta ? 'hide-tablet-down' : undefined,
        flexShrink: careglo || lumen ? 0 : undefined,
      }).id
      : wrap.id;
  }
  addButton(context, actionParentId, caregloFallback ? 'Contact' : careglo ? context.replacementProfile.navCta || 'Reserve a Visit' : optomatta ? '+1 (415) 555-0186' : lumen ? 'Appointment Now' : firstCta(context.brief), '#', optomatta ? {
    paddingTop: '26px',
    paddingRight: '34px',
    paddingBottom: '26px',
    paddingLeft: '34px',
    borderRadius: '0px',
    fontWeight: '700',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  } : caregloRealReference ? {
    paddingTop: '19px',
    paddingRight: '21px',
    paddingBottom: '19px',
    paddingLeft: '21px',
    borderRadius: '16px',
    fontWeight: '400',
    fontFamily: 'Poppins',
    backgroundColor: caregloAccent,
    textColor: '#15171c',
  } : {});

  if (caregloActionGroup) {
    const menuButton = createCanvasNode(context, containerName, caregloActionGroup.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      responsiveDisplay: 'show-tablet-down-only',
      width: '44px',
      minHeight: '44px',
      flexShrink: 0,
      borderRadius: '14px',
      ...backgroundProps(context, containerName, '#151820'),
    });
    createCanvasNode(context, containerName, menuButton.id, {
      width: '14px',
      minHeight: '14px',
      borderRadius: '0px',
      borderWidth: '2px',
      borderColor: '#b1b4c8',
    });
  }
}

function addTopbarSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const topbar = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'header',
    paddingTop: '14px',
    paddingBottom: '14px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    responsiveDisplay: 'hide-mobile',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const wrap = createCanvasNode(context, containerName, topbar.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
  });

  const contact = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '30px',
  });
  addText(context, contact.id, '☎ +1 (415) 555-0148', {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '600',
    textColor: style.buttonFg,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, contact.id, `✉ ${context.replacementProfile.email || firstEmailText(context.brief, 'hello@example.test')}`, {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '600',
    textColor: style.buttonFg,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const social = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
    responsiveDisplay: 'hide-mobile',
  });
  for (const label of ['f', 'x', '▶', '◎', 'in']) {
    addText(context, social.id, label, {
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.buttonFg,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addMaidyHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidyCompositeSource = maidyHeroCompositeSource();
  const usesMaidyComposite = maidyCompositeSource !== '';
  const maidyCutoutSource = usesMaidyComposite ? '' : maidyHeroCutoutSource();
  const usesMaidyCutout = maidyCutoutSource !== '';
  const configuredEquipmentSource = String(process.env.MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL || '').trim();
  const maidyEquipmentSource = /^https?:\/\//i.test(configuredEquipmentSource) && isTransparentCutoutSource(configuredEquipmentSource)
    ? configuredEquipmentSource
    : '';
  const usesMaidyEquipmentCutout = maidyEquipmentSource !== '';
  const usesGeneratedFallback = !usesMaidyCutout && !usesMaidyComposite;
  const cutoutHeight = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.desktop?.canonicalHeroMedia || geometry.referenceGeometry?.desktop?.heroMedia, 'height') || '847px'
    : '';
  const cutoutHeightTablet = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.tablet?.canonicalHeroMedia || geometry.referenceGeometry?.tablet?.heroMedia, 'height') || geometry.visualMinHeightTablet
    : '';
  const cutoutHeightMobile = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.mobile?.canonicalHeroMedia || geometry.referenceGeometry?.mobile?.heroMedia, 'height') || geometry.visualMinHeightMobile
    : '';
  const cutoutWidthTablet = usesMaidyCutout
    ? referenceRectLength(geometry.referenceGeometry?.tablet?.canonicalHeroMedia || geometry.referenceGeometry?.tablet?.heroMedia, 'width')
    : '';
  const cutoutTabletOffset = usesMaidyCutout && isMaidyRealReferenceBrief(context.brief) ? '115px' : '0px';
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: '1440px',
    innerPaddingX: '0px',
    minHeight: cutoutHeight || geometry.heroMinHeight,
    minHeightTablet: cutoutHeightTablet || geometry.heroMinHeightTablet,
    minHeightMobile: cutoutHeightMobile || geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, style.bg),
    backgroundImage: usesMaidyComposite ? maidyCompositeSource : undefined,
    backgroundSize: usesMaidyComposite ? 'cover' : undefined,
    backgroundPosition: usesMaidyComposite ? 'top' : undefined,
    backgroundRepeat: usesMaidyComposite ? 'no-repeat' : undefined,
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: usesGeneratedFallback ? 'flex-start' : 'stretch',
    gap: '0px',
    responsiveStack: usesGeneratedFallback ? 'tablet' : 'mobile',
    minHeight: cutoutHeight || geometry.heroMinHeight,
    minHeightTablet: cutoutHeightTablet || geometry.heroMinHeightTablet,
    minHeightMobile: cutoutHeightMobile || geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '0px',
    flexBasis: usesGeneratedFallback ? '55%' : '50%',
    flexShrink: usesGeneratedFallback ? undefined : 0,
    paddingTop: usesGeneratedFallback ? '60px' : usesMaidyCutout ? '100px' : '32px',
    paddingTopTablet: usesGeneratedFallback ? '52px' : usesMaidyCutout ? '59px' : '42px',
    paddingTopMobile: usesMaidyCutout ? '50px' : '52px',
    paddingBottom: '0px',
  });
  const copyContent = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: usesGeneratedFallback ? '24px' : '12px',
    gapTablet: usesMaidyCutout ? '20px' : undefined,
    gapMobile: usesGeneratedFallback ? '28px' : '10px',
    width: '100%',
    maxWidth: usesGeneratedFallback ? '656px' : usesMaidyCutout ? '720px' : '560px',
    maxWidthTablet: usesMaidyCutout ? '100%' : undefined,
    maxWidthMobile: '100%',
    paddingLeft: usesGeneratedFallback ? '110px' : '120px',
    paddingLeftTablet: usesMaidyCutout ? '30px' : undefined,
    paddingLeftMobile: '20px',
    paddingRight: '0px',
    paddingRightTablet: usesMaidyCutout ? '0px' : undefined,
    paddingRightMobile: '20px',
  });

  addText(context, copyContent.id, maidyEyebrowText(context.brief, context.replacementProfile), {
    fontSize: '17px',
    fontSizeMobile: '14px',
    lineHeightTablet: usesMaidyCutout ? '1.7' : undefined,
    fontWeight: '800',
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    textColor: '#b9bbb7',
    marginTop: '0px',
    marginBottom: '0px',
  });

  const headingStack = createCanvasNode(context, containerName, copyContent.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '0px',
    paddingTop: usesGeneratedFallback ? '12px' : usesMaidyCutout ? '4px' : undefined,
    paddingTopTablet: usesMaidyCutout ? '0px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '2px' : usesMaidyCutout ? '13px' : undefined,
  });
  let headingLines = maidyHeroHeadingLines(context.brief);
  const sourceHeading = normalizeAuthoredText(firstHeading(context.brief));
  if (usesGeneratedFallback && /avoid the mess/i.test(sourceHeading) && /crisp and calm/i.test(sourceHeading)) {
    headingLines = {
      body: ['Avoid the mess,', 'keep every room'],
      accent: 'crisp and calm.',
    };
  }
  for (const line of headingLines.body) {
    addHeading(context, headingStack.id, line, 'h1', {
      fontSize: usesGeneratedFallback ? '68px' : '62px',
      fontSizeTablet: usesMaidyCutout ? '48px' : '54px',
      fontSizeMobile: usesMaidyCutout ? '47px' : '45px',
      lineHeight: usesGeneratedFallback ? '1.28' : usesMaidyCutout ? '82px' : '1.08',
      lineHeightTablet: usesMaidyCutout ? '65px' : usesGeneratedFallback ? '1.2' : undefined,
      lineHeightMobile: usesMaidyCutout ? '1.3' : usesGeneratedFallback ? '1.32' : undefined,
      fontWeight: usesGeneratedFallback ? '900' : '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addHeading(context, headingStack.id, headingLines.accent, 'h1', {
    fontSize: usesGeneratedFallback ? '68px' : '62px',
    fontSizeTablet: usesMaidyCutout ? '48px' : '54px',
    fontSizeMobile: usesMaidyCutout ? '47px' : '45px',
    lineHeight: usesGeneratedFallback ? '1.28' : usesMaidyCutout ? '82px' : '1.08',
    lineHeightTablet: usesMaidyCutout ? '65px' : usesGeneratedFallback ? '1.2' : undefined,
    lineHeightMobile: usesMaidyCutout ? '1.3' : usesGeneratedFallback ? '1.32' : undefined,
    fontWeight: usesGeneratedFallback ? '900' : '600',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });

  const leadParent = usesMaidyCutout
    ? createCanvasNode(context, containerName, copyContent.id, {
      width: '100%',
      maxWidth: '400px',
      maxWidthTablet: '317px',
      maxWidthMobile: '100%',
      paddingTop: '8px',
      paddingTopTablet: '0px',
      paddingTopMobile: '11px',
    }).id
    : copyContent.id;
  addText(context, leadParent, context.replacementProfile.lead, {
    fontSize: usesMaidyCutout ? '16px' : '18px',
    fontSizeTablet: usesMaidyCutout ? '16px' : undefined,
    fontSizeMobile: '16px',
    lineHeight: usesMaidyCutout ? '1.7' : '1.72',
    lineHeightTablet: usesMaidyCutout ? '1.7' : undefined,
    lineHeightMobile: usesMaidyCutout ? '1.6' : undefined,
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const lowerStage = usesMaidyCutout
    ? createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'one',
      width: '100%',
    })
    : null;
  const bottomRow = createCanvasNode(context, containerName, lowerStage ? lowerStage.id : copyContent.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '30px',
    width: '100%',
    maxWidthMobile: '100%',
    responsiveStack: usesGeneratedFallback ? 'tablet' : undefined,
    gridColumnStart: usesMaidyCutout ? 1 : undefined,
    gridRowStart: usesMaidyCutout ? 1 : undefined,
    paddingTop: usesMaidyCutout ? '62px' : undefined,
    paddingTopTablet: usesMaidyCutout ? '35px' : undefined,
    paddingTopMobile: usesMaidyCutout ? '35px' : undefined,
    paddingLeft: usesMaidyCutout ? '120px' : undefined,
    paddingLeftTablet: usesMaidyCutout ? '30px' : undefined,
    paddingLeftMobile: usesMaidyCutout ? '20px' : undefined,
  });
  const actions = createCanvasNode(context, containerName, bottomRow.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '30px',
    paddingTop: usesGeneratedFallback ? '13px' : undefined,
    paddingTopTablet: usesGeneratedFallback ? '0px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '0px' : undefined,
  });
  addButton(context, actions.id, 'Get started →', '#', {
    paddingTop: '14px',
    paddingRight: '25px',
    paddingBottom: '14px',
    paddingLeft: '25px',
    borderRadius: '0px',
    fontWeight: '800',
    backgroundColor: maidyPanelColor(context),
    textColor: '#ffffff',
  });
  const secondaryActionWrap = createCanvasNode(context, containerName, actions.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
  });
  addButton(context, secondaryActionWrap.id, '▶', '#', {
    paddingTop: usesMaidyCutout ? '12px' : '17px',
    paddingRight: usesMaidyCutout ? '15px' : '19px',
    paddingBottom: usesMaidyCutout ? '12px' : '17px',
    paddingLeft: usesMaidyCutout ? '15px' : '19px',
    borderRadius: '999px',
    backgroundColor: maidyHighlightColor(context),
    textColor: maidyPanelColor(context),
  });
  addText(context, secondaryActionWrap.id, 'How we work', {
    fontSize: '16px',
    fontWeight: '800',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  const equipmentSlot = createCanvasNode(context, containerName, lowerStage ? lowerStage.id : copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: usesGeneratedFallback ? '260px' : '320px',
    maxWidthTablet: usesMaidyCutout ? '180px' : undefined,
    maxWidthMobile: usesMaidyCutout ? '294px' : undefined,
    responsiveStack: usesGeneratedFallback ? 'tablet' : undefined,
    gridColumnStart: usesMaidyCutout ? 1 : undefined,
    gridRowStart: usesMaidyCutout ? 1 : undefined,
    paddingTop: usesMaidyCutout ? '57px' : undefined,
    paddingTopTablet: usesGeneratedFallback ? '40px' : usesMaidyCutout ? '80px' : undefined,
    paddingTopMobile: usesGeneratedFallback ? '0px' : usesMaidyCutout ? '30px' : undefined,
  });
  addMediaSurface(context, equipmentSlot.id, 'secondary', mediaVariant(maidyEquipmentSource || context.replacementProfile.equipment || context.replacementProfile.secondary, 'maidy-hero-equipment'), {
    width: '100%',
    minHeight: usesGeneratedFallback ? '170px' : '258px',
    minHeightTablet: usesGeneratedFallback ? '270px' : '144px',
    minHeightMobile: usesGeneratedFallback ? '220px' : usesMaidyCutout ? '237px' : '258px',
    borderRadius: '0px',
    backgroundPosition: 'center',
    backgroundPositionX: usesMaidyEquipmentCutout ? '-80px' : undefined,
    backgroundPositionXTablet: usesMaidyEquipmentCutout ? '-30px' : undefined,
    backgroundPositionXMobile: usesMaidyEquipmentCutout ? '-50px' : undefined,
    backgroundPositionY: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundPositionYTablet: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundPositionYMobile: usesMaidyEquipmentCutout ? '50%' : undefined,
    backgroundSize: usesMaidyEquipmentCutout ? 'contain' : 'cover',
    backgroundRepeat: usesMaidyEquipmentCutout ? 'no-repeat' : undefined,
  });

  const visualParent = usesGeneratedFallback
    ? createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      flexBasis: '520px',
      width: '520px',
      minHeight: '670px',
      minHeightTablet: '270px',
      minHeightMobile: geometry.visualMinHeightMobile,
      paddingTop: '60px',
      paddingTopTablet: '0px',
      paddingTopMobile: '0px',
      responsiveDisplay: 'hide-tablet-down',
    })
    : null;

  const visual = createCanvasNode(context, containerName, visualParent ? visualParent.id : wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: usesMaidyCutout ? 'flex-start' : 'flex-end',
    alignItems: 'flex-start',
    flexBasis: usesMaidyCutout || usesMaidyComposite ? '600px' : usesGeneratedFallback ? undefined : '50%',
    flexShrink: usesMaidyCutout || usesMaidyComposite ? 0 : undefined,
    width: usesMaidyCutout || usesMaidyComposite ? '600px' : usesGeneratedFallback ? '100%' : '720px',
    maxWidth: usesMaidyCutout || usesMaidyComposite ? '100%' : undefined,
    minHeight: usesGeneratedFallback ? '610px' : cutoutHeight || '847px',
    minHeightTablet: usesMaidyComposite ? '0px' : usesGeneratedFallback ? '270px' : cutoutHeightTablet || geometry.visualMinHeightTablet,
    minHeightMobile: usesMaidyComposite ? '0px' : cutoutHeightMobile || geometry.visualMinHeightMobile,
    paddingTop: '0px',
    paddingTopTablet: usesMaidyCutout ? cutoutTabletOffset : undefined,
    paddingTopMobile: usesMaidyCutout ? '40px' : undefined,
    paddingRight: usesMaidyCutout ? '0px' : usesGeneratedFallback ? '0px' : '120px',
    paddingBottom: usesMaidyCutout ? '0px' : usesGeneratedFallback ? '48px' : '80px',
    paddingLeft: '0px',
    borderRadius: '0px',
    responsiveDisplay: usesMaidyComposite ? 'hide-tablet-down' : usesGeneratedFallback ? 'hide-mobile' : undefined,
    ...(usesMaidyComposite ? {} : backgroundProps(context, containerName, maidyPanelColor(context))),
    backgroundImage: usesMaidyCutout || usesMaidyComposite ? undefined : context.replacementProfile.hero,
    backgroundSize: usesMaidyCutout || usesMaidyComposite ? undefined : 'cover',
    backgroundPosition: usesMaidyCutout || usesMaidyComposite ? undefined : 'top',
    backgroundRepeat: usesMaidyCutout || usesMaidyComposite ? undefined : 'no-repeat',
    backgroundOverlay: usesMaidyCutout || usesMaidyComposite ? undefined : 'rgba(49, 95, 79, 0.16)',
    backgroundAccentType: 'radial',
    backgroundAccentColor1: maidyHighlightColor(context),
    backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
    backgroundAccentPositionX: '27%',
    backgroundAccentPositionY: '42%',
    backgroundAccentSize: '330px',
  });

  const quoteParent = usesMaidyCutout
    ? createCanvasNode(context, containerName, visual.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      width: '100%',
      maxWidthTablet: cutoutWidthTablet || undefined,
      maxWidthMobile: '100%',
      minHeight: cutoutHeight || '847px',
      minHeightTablet: cutoutHeightTablet || geometry.visualMinHeightTablet,
      minHeightMobile: cutoutHeightMobile || geometry.visualMinHeightMobile,
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '80px',
      paddingBottomTablet: '0px',
      paddingBottomMobile: '0px',
      paddingLeft: '0px',
      backgroundImage: maidyCutoutSource,
      backgroundSize: 'contain',
      backgroundPosition: 'top',
      backgroundRepeat: 'no-repeat',
      backgroundAccentType: 'radial',
      backgroundAccentColor1: maidyHighlightColor(context),
      backgroundAccentColor2: 'rgba(255, 221, 103, 0)',
      backgroundAccentPositionX: '42%',
      backgroundAccentPositionY: '44%',
      backgroundAccentSize: '360px',
    }).id
    : visual.id;

  const proof = proofCopy(context.replacementProfile);
  const quote = createCanvasNode(context, containerName, quoteParent, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '12px',
    width: '288px',
    minHeight: '184px',
    paddingTop: '26px',
    paddingRight: '28px',
    paddingBottom: '26px',
    paddingLeft: '28px',
    borderRadius: '0px',
    ...backgroundProps(context, containerName, style.cardBackground),
    boxShadow: 'soft',
  });
  addHeading(context, quote.id, '99', 'div', {
    fontSize: '44px',
    lineHeight: '1',
    fontWeight: '300',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, quote.id, proof.title, {
    fontSize: '16px',
    lineHeight: '1.35',
    fontWeight: '800',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, quote.id, 'Fresh rooms, steady routines, and a team that arrives prepared.', {
    fontSize: '13px',
    lineHeight: '1.6',
    fontWeight: '700',
    textColor: maidyPanelColor(context),
    marginTop: '0px',
    marginBottom: '0px',
  });
  context.heroProofCards += 1;
}

function addCaregloHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const realReferenceMode = context.brief.authoringRequirements?.requireRealReference === true;
  const compactFallbackMobile = realReferenceMode === false;
  const accentColor = realReferenceMode ? '#ffd0a8' : style.accent;
  const mutedColor = realReferenceMode ? '#b1b4c8' : style.muted;
  const inkColor = realReferenceMode ? '#f7f7f8' : style.ink;
  const navPanelColor = realReferenceMode ? '#222731' : style.navBackground;
  const heroHeadingText = realReferenceMode
    ? context.replacementProfile.heroHeading || 'Crafted Care for a Lasting First Impression.'
    : firstHeading(context.brief);
  const fallbackCtas = Array.isArray(context.brief.text?.ctas) ? context.brief.text.ctas : [];
  const primaryHeroCta = realReferenceMode
    ? context.replacementProfile.primaryCta || 'Reserve Your Detail'
    : fallbackCtas.find((cta) => /book/i.test(String(cta || ''))) || 'Book Detailing Now';
  const secondaryHeroCta = realReferenceMode
    ? context.replacementProfile.secondaryCta || 'Explore Treatments'
    : fallbackCtas.find((cta) => /view|service/i.test(String(cta || ''))) || 'View services';
  const heroEyebrow = realReferenceMode
    ? context.replacementProfile.heroEyebrow || 'A finish engineered to last'
    : 'A finish made to endure';
  const visualMinHeight = compactFallbackMobile
    ? scalePxLength(geometry.visualMinHeight, 1.208, '701px')
    : referenceRectLength(geometry.referenceGeometry?.desktop?.heroMedia, 'height')
      || scalePxLength(geometry.visualMinHeight, 1.54, '814px');
  const visualMinHeightTablet = compactFallbackMobile
    ? geometry.visualMinHeightTablet
    : referenceRectLength(geometry.referenceGeometry?.tablet?.heroMedia, 'height') || geometry.visualMinHeightTablet;
  const visualMinHeightMobile = compactFallbackMobile
    ? geometry.visualMinHeightMobile
    : referenceRectLength(geometry.referenceGeometry?.mobile?.heroMedia, 'height') || geometry.visualMinHeightMobile;
  const heroMinHeight = compactFallbackMobile
    ? geometry.heroMinHeight
    : referenceRectLength(geometry.referenceGeometry?.desktop?.heroMedia, 'height')
      || scalePxLength(geometry.heroMinHeight, 1.26, '814px');
  const referenceSecondaryHeight = Number(geometry.referenceGeometry?.desktop?.secondaryMedia?.rect?.height || 0);
  const secondaryMinHeight = compactFallbackMobile
    ? scalePxLength(geometry.secondaryMinHeight, 1.16, '269px')
    : Number.isFinite(referenceSecondaryHeight) && referenceSecondaryHeight > 0
      ? `${Math.max(200, Math.round(referenceSecondaryHeight))}px`
      : scalePxLength(geometry.secondaryMinHeight, 0.86, '200px');
  const secondaryWidth = compactFallbackMobile
    ? '216px'
    : referenceRectLength(geometry.referenceGeometry?.desktop?.secondaryMedia, 'width') || '216px';
  const secondaryWidthTablet = compactFallbackMobile
    ? undefined
    : referenceRectLength(geometry.referenceGeometry?.tablet?.secondaryMedia, 'width') || secondaryWidth;
  const secondaryMinHeightMobile = compactFallbackMobile
    ? secondaryMinHeight
    : referenceRectLength(geometry.referenceGeometry?.mobile?.secondaryMedia, 'height') || secondaryMinHeight;
  const referenceHeadingFontSize = cssLengthValue(geometry.referenceGeometry?.desktop?.heroHeading?.fontSize, '66px');
  const referenceHeadingFontSizeTablet = cssLengthValue(geometry.referenceGeometry?.tablet?.heroHeading?.fontSize, '56px');
  const referenceHeadingFontSizeMobile = cssLengthValue(geometry.referenceGeometry?.mobile?.heroHeading?.fontSize, '64px');

  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: compactFallbackMobile ? '70px' : '96px',
    paddingTopMobile: realReferenceMode ? '78px' : undefined,
    paddingBottom: '44px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: realReferenceMode ? '24px' : '20px',
    minHeight: geometry.heroMinHeight,
    minHeightTablet: geometry.heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: compactFallbackMobile ? '24px' : '48px',
    gapTablet: realReferenceMode ? '48px' : undefined,
    gapMobile: realReferenceMode ? '48px' : undefined,
    responsiveStack: 'tablet',
    minHeight: heroMinHeight,
    minHeightTablet: scalePxLength(heroMinHeight, 0.78, geometry.heroMinHeightTablet),
    minHeightMobile: '0px',
  });

  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: compactFallbackMobile ? '28px' : '40px',
    gapMobile: compactFallbackMobile ? '22px' : undefined,
    width: realReferenceMode ? '100%' : undefined,
    flexBasis: compactFallbackMobile ? '585px' : realReferenceMode ? '548px' : '40%',
    flexShrink: realReferenceMode ? 0 : undefined,
    maxWidth: compactFallbackMobile ? '585px' : realReferenceMode ? '548px' : undefined,
    maxWidthTablet: realReferenceMode ? '100%' : undefined,
    maxWidthMobile: realReferenceMode ? '100%' : undefined,
    minHeight: visualMinHeight,
    minHeightTablet: '0px',
    minHeightMobile: '0px',
    paddingTop: realReferenceMode ? '0px' : '4px',
    paddingBottom: '0px',
    paddingLeft: compactFallbackMobile ? '32px' : undefined,
    paddingLeftMobile: compactFallbackMobile ? '0px' : undefined,
  });
  const copyTop = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: realReferenceMode ? '25px' : '28px',
    gapMobile: compactFallbackMobile ? '18px' : undefined,
  });
  const eyebrowParentId = realReferenceMode
    ? createCanvasNode(context, containerName, copyTop.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
    }).id
    : copyTop.id;
  addText(context, eyebrowParentId, heroEyebrow, {
    fontSize: '20px',
    fontSizeMobile: realReferenceMode ? '20px' : '16px',
    lineHeight: '1.25',
    fontWeight: realReferenceMode ? '400' : '500',
    textAlignTablet: compactFallbackMobile ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile ? 'left' : 'center',
    textColor: accentColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copyTop.id, heroHeadingText, 'h1', {
    fontSize: compactFallbackMobile ? '66px' : referenceHeadingFontSize,
    fontSizeTablet: compactFallbackMobile ? '44px' : referenceHeadingFontSizeTablet,
    fontSizeMobile: compactFallbackMobile ? '42px' : referenceHeadingFontSizeMobile,
    lineHeight: realReferenceMode ? '1.10' : '1.08',
    lineHeightTablet: realReferenceMode ? '1.10' : undefined,
    lineHeightMobile: compactFallbackMobile ? '1.08' : '1.10',
    fontWeight: compactFallbackMobile ? '900' : '800',
    fontFamily: compactFallbackMobile ? undefined : 'Plus_Jakarta_Sans',
    textAlignTablet: compactFallbackMobile ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile ? 'left' : 'center',
    textColor: compactFallbackMobile ? style.ink : '#ffffff',
    marginTop: '0px',
    marginBottom: compactFallbackMobile ? '8px' : '22px',
  });

  const leadRow = createCanvasNode(context, containerName, copyTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: compactFallbackMobile ? '16px' : '71px',
    gapTablet: realReferenceMode ? '96px' : undefined,
    gapMobile: realReferenceMode ? '76px' : undefined,
    responsiveStack: compactFallbackMobile ? undefined : 'mobile',
    paddingTop: realReferenceMode ? '25px' : undefined,
    paddingTopTablet: realReferenceMode ? '25px' : undefined,
    paddingTopMobile: realReferenceMode ? '20px' : undefined,
    paddingLeft: realReferenceMode ? '7px' : undefined,
    paddingLeftTablet: realReferenceMode ? '44px' : undefined,
    paddingRight: realReferenceMode ? '52px' : undefined,
    paddingRightTablet: realReferenceMode ? '62px' : undefined,
    paddingLeftMobile: realReferenceMode ? '0px' : undefined,
    paddingRightMobile: realReferenceMode ? '0px' : undefined,
  });
  const leadMarkerWrap = createCanvasNode(context, containerName, leadRow.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '34px',
    maxWidthTablet: '34px',
    maxWidthMobile: realReferenceMode ? '100%' : '34px',
    minHeight: '41px',
    paddingTop: '7px',
    flexShrink: 0,
  });
  createCanvasNode(context, containerName, leadMarkerWrap.id, {
    width: '34px',
    minHeight: '34px',
    flexShrink: 0,
    borderRadius: '0px',
    borderWidth: '4px',
    borderColor: accentColor,
  });
  addText(context, leadRow.id, 'Premium interior and exterior treatments that make every ride feel first-class, every single day.', {
    fontSize: realReferenceMode ? '20px' : '22px',
    fontSizeTablet: realReferenceMode ? '20px' : '19px',
    fontSizeMobile: realReferenceMode ? '20px' : '17px',
    lineHeight: realReferenceMode ? '1.5' : '1.45',
    lineHeightTablet: realReferenceMode ? '1.5' : undefined,
    lineHeightMobile: realReferenceMode ? '1.5' : undefined,
    fontWeight: '400',
    textAlignTablet: compactFallbackMobile || realReferenceMode ? 'left' : 'center',
    textAlignMobile: compactFallbackMobile || realReferenceMode ? 'left' : 'center',
    textColor: mutedColor,
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const actions = createCanvasNode(context, containerName, copyTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: compactFallbackMobile ? '14px' : '24px',
    responsiveStack: compactFallbackMobile ? undefined : 'mobile',
    width: realReferenceMode ? '100%' : undefined,
    paddingTop: realReferenceMode ? '39px' : undefined,
    paddingTopTablet: realReferenceMode ? '38px' : undefined,
    paddingTopMobile: realReferenceMode ? '39px' : undefined,
    paddingLeftTablet: realReferenceMode ? '206px' : undefined,
    paddingLeftMobile: realReferenceMode ? '0px' : undefined,
  });
  const primaryActionParent = realReferenceMode
    ? createCanvasNode(context, containerName, actions.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
    }).id
    : actions.id;
  addButton(context, primaryActionParent, primaryHeroCta, '#', {
    paddingTop: realReferenceMode ? '19px' : '17px',
    paddingRight: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
    paddingBottom: realReferenceMode ? '19px' : '17px',
    paddingLeft: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
    borderRadius: realReferenceMode ? '14px' : '18px',
    fontWeight: realReferenceMode ? '400' : '500',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    backgroundColor: realReferenceMode ? accentColor : style.buttonBg,
    textColor: realReferenceMode ? '#15171c' : style.buttonFg,
  });
  if (secondaryHeroCta) {
    const secondaryActionParent = realReferenceMode
      ? createCanvasNode(context, containerName, actions.id, {
        layoutDisplay: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
      }).id
      : actions.id;
    addButton(context, secondaryActionParent, secondaryHeroCta, '#', {
      paddingTop: realReferenceMode ? '19px' : '17px',
      paddingRight: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
      paddingBottom: realReferenceMode ? '19px' : '17px',
      paddingLeft: compactFallbackMobile ? '16px' : realReferenceMode ? '18px' : '25px',
      borderRadius: realReferenceMode ? '14px' : '16px',
      fontWeight: realReferenceMode ? '400' : '500',
      fontFamily: realReferenceMode ? 'Poppins' : undefined,
      backgroundColor: realReferenceMode ? navPanelColor : style.navBackground,
      textColor: mutedColor,
    });
  }

  const heroStats = statItems(context.brief);
  const ratingCopy = heroStats[0] || { value: '4.9/5', label: 'rated finish score' };
  const ownerCopy = heroStats[1] || { value: '1,200+', label: 'car owners' };

  if (compactFallbackMobile) {
    const statsRow = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: '14px',
      responsiveStack: 'mobile',
      responsiveDisplay: 'hide-tablet-down',
      width: '100%',
    });
    for (const item of heroStats.slice(0, 3)) {
      const card = createCanvasNode(context, containerName, statsRow.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        gap: '5px',
        flexBasis: '0px',
        flexGrow: 1,
        paddingTop: '18px',
        paddingRight: '16px',
        paddingBottom: '18px',
        paddingLeft: '16px',
        borderRadius: '18px',
        ...backgroundProps(context, containerName, style.cardBackground),
      });
      addHeading(context, card.id, item.value, 'div', {
        fontSize: '24px',
        lineHeight: '1',
        fontWeight: '800',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addText(context, card.id, item.label, {
        fontSize: '13px',
        lineHeight: '1.25',
        fontWeight: '600',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }

    addMediaSurface(context, wrap.id, 'hero', mediaVariant(context.replacementProfile.hero, 'careglo-fallback-hero-main'), {
      flexBasis: '467px',
      flexShrink: 0,
      width: '467px',
      minHeight: visualMinHeight,
      minHeightTablet: geometry.visualMinHeightTablet,
      minHeightMobile: geometry.visualMinHeightMobile,
      borderRadius: scalePxLength(geometry.radius, 0.75, '24px'),
      backgroundPosition: 'center',
      backgroundOverlay: 'rgba(0, 0, 0, 0.05)',
    });

    const sideRail = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      flexShrink: 0,
      width: '224px',
      minHeight: visualMinHeight,
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    addMediaSurface(context, sideRail.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-side-proof'), {
      width: '224px',
      minHeight: secondaryMinHeight,
      minHeightTablet: secondaryMinHeight,
      minHeightMobile: '180px',
      borderRadius: '18px',
      backgroundPosition: 'center',
    });
    const bookingCard = createCanvasNode(context, containerName, sideRail.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      flexGrow: 1,
      minHeight: '246px',
      paddingTop: '22px',
      paddingRight: '18px',
      paddingBottom: '18px',
      paddingLeft: '18px',
      borderRadius: '18px',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addText(context, bookingCard.id, 'SIGNATURE SLOT', {
      fontSize: '12px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, bookingCard.id, 'Reserve a detail bay with expert handover.', 'h3', {
      fontSize: '21px',
      lineHeight: '1.18',
      fontWeight: '700',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addButton(context, bookingCard.id, primaryHeroCta, '#', {
      paddingTop: '14px',
      paddingRight: '16px',
      paddingBottom: '14px',
      paddingLeft: '16px',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: '700',
      backgroundColor: style.buttonBg,
      textColor: style.buttonFg,
    });
    context.heroProofCards += 3;
    return;
  }

  const lowerProof = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '24px',
    responsiveStack: 'mobile',
    paddingTopTablet: realReferenceMode ? '25px' : undefined,
    paddingTopMobile: realReferenceMode ? '34px' : undefined,
    width: '100%',
  });
  addMediaSurface(context, lowerProof.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-hero-proof'), {
    width: realReferenceMode ? '100%' : '216px',
    maxWidth: realReferenceMode ? secondaryWidth : undefined,
    maxWidthTablet: secondaryWidthTablet,
    maxWidthMobile: realReferenceMode ? '100%' : undefined,
    minHeight: secondaryMinHeight,
    minHeightTablet: secondaryMinHeight,
    minHeightMobile: secondaryMinHeightMobile,
    borderRadius: '16px',
    backgroundPosition: 'center',
  });
  const ratingWrap = createCanvasNode(context, containerName, lowerProof.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: realReferenceMode ? 'flex-end' : 'center',
    gap: realReferenceMode ? '26px' : '18px',
    gapMobile: realReferenceMode ? '40px' : undefined,
    flexBasis: '0px',
    flexGrow: 1,
    minWidth: '220px',
  });
  const avatarStack = createCanvasNode(context, containerName, ratingWrap.id, {
    layoutDisplay: realReferenceMode ? 'grid' : 'flex',
    flexDirection: realReferenceMode ? undefined : 'row',
    alignItems: realReferenceMode ? undefined : 'center',
    gridTemplateColumns: realReferenceMode ? 'three' : undefined,
    gap: realReferenceMode ? undefined : '0px',
    width: realReferenceMode ? '150px' : undefined,
    minHeight: realReferenceMode ? '70px' : undefined,
  });
  for (const source of CAREGLO_AVATAR_IMAGES) {
    createCanvasNode(context, containerName, avatarStack.id, {
      width: realReferenceMode ? '70px' : '50px',
      maxWidth: realReferenceMode ? '50px' : undefined,
      maxWidthTablet: realReferenceMode ? '50px' : undefined,
      maxWidthMobile: realReferenceMode ? '70px' : undefined,
      minHeight: '50px',
      minHeightTablet: realReferenceMode ? '50px' : undefined,
      minHeightMobile: realReferenceMode ? '70px' : undefined,
      borderRadius: '999px',
      borderWidth: '2px',
      borderColor: style.bg,
      ...backgroundProps(context, containerName, style.panel),
      backgroundImage: source,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    });
  }
  if (realReferenceMode) {
    const ratingText = createCanvasNode(context, containerName, ratingWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '0px',
      width: '140px',
      flexShrink: 0,
    });
    addText(context, ratingText.id, 'Rated 4.8/5', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      fontFamily: 'Poppins',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, ratingText.id, '900+ returning drivers', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      fontFamily: 'Poppins',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
  } else {
    const ratingText = createCanvasNode(context, containerName, ratingWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '2px',
    });
    addHeading(context, ratingText.id, ratingCopy.value, 'div', {
      fontSize: '18px',
      lineHeight: '1.1',
      fontWeight: '500',
      textColor: accentColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, ratingText.id, `${ratingCopy.label}\n${ownerCopy.value} ${ownerCopy.label}`, {
      fontSize: '15px',
      lineHeight: '1.32',
      fontWeight: '500',
      textColor: inkColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const visual = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    flexBasis: realReferenceMode ? '0px' : '60%',
    flexGrow: realReferenceMode ? 1 : undefined,
    minWidth: realReferenceMode ? '0px' : undefined,
    minHeight: visualMinHeight,
    minHeightTablet: visualMinHeightTablet,
    minHeightMobile: visualMinHeightMobile,
    paddingTop: '0px',
    paddingRight: '18px',
    paddingBottom: '18px',
    paddingLeft: '18px',
    borderRadius: realReferenceMode ? '16px' : geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
    backgroundImage: mediaVariant(context.replacementProfile.hero, 'careglo-hero-main'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(0, 0, 0, 0.08)',
  });

  const overlay = createCanvasNode(context, containerName, visual.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: realReferenceMode ? '24px' : '18px',
    paddingTop: '22px',
    paddingRight: realReferenceMode ? '0px' : '18px',
    paddingBottom: realReferenceMode ? '0px' : '18px',
    paddingLeft: realReferenceMode ? '0px' : '18px',
    borderRadius: realReferenceMode ? '18px' : geometry.radius,
    responsiveDisplay: realReferenceMode ? 'hide-mobile' : undefined,
    ...backgroundProps(context, containerName, realReferenceMode ? 'rgba(23, 25, 31, 0.97)' : 'rgba(18, 21, 27, 0.95)'),
    boxShadow: 'shadow-xl',
  });
  const overlayTop = createCanvasNode(context, containerName, overlay.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '28px',
    responsiveStack: 'mobile',
    paddingRight: realReferenceMode ? '18px' : undefined,
    paddingLeft: realReferenceMode ? '22px' : undefined,
  });
  const iconCircle = createCanvasNode(context, containerName, overlayTop.id, {
    width: '66px',
    minHeight: '66px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderColor: accentColor,
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  });
  createCanvasNode(context, containerName, iconCircle.id, {
    width: '20px',
    minHeight: '20px',
    borderRadius: '0px',
    borderWidth: '4px',
    borderColor: accentColor,
  });
  const overlayTitle = createCanvasNode(context, containerName, overlayTop.id, {
    width: '100%',
    maxWidth: '166px',
  });
  addHeading(context, overlayTitle.id, heroEyebrow, 'h3', {
    fontSize: '20px',
    fontSizeMobile: '20px',
    lineHeight: '1.5',
    fontWeight: '400',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    textAlign: 'right',
    textColor: inkColor,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const overlayBottom = createCanvasNode(context, containerName, overlay.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: realReferenceMode ? 'space-between' : undefined,
    gap: realReferenceMode ? '0px' : '28px',
    responsiveStack: 'mobile',
    paddingTop: realReferenceMode ? '15px' : '18px',
    paddingRight: realReferenceMode ? '16px' : '18px',
    paddingBottom: realReferenceMode ? '15px' : '18px',
    paddingLeft: realReferenceMode ? '14px' : '18px',
    borderRadius: scalePxLength(geometry.radius, 0.78, '22px'),
    ...backgroundProps(context, containerName, '#242932'),
  });
  const certification = createCanvasNode(context, containerName, overlayBottom.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    width: realReferenceMode ? '183px' : undefined,
    flexBasis: realReferenceMode ? undefined : '52%',
    flexShrink: realReferenceMode ? 0 : undefined,
    minHeight: '150px',
  });
  addText(context, certification.id, 'Professional & certified experts', {
    fontSize: realReferenceMode ? '20px' : '24px',
    fontSizeMobile: '20px',
    lineHeight: realReferenceMode ? '1.5' : '1.25',
    fontWeight: realReferenceMode ? '400' : '500',
    fontFamily: realReferenceMode ? 'Poppins' : undefined,
    textColor: inkColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addMediaSurface(context, overlayBottom.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'careglo-overlay-proof'), {
    width: realReferenceMode ? '350px' : undefined,
    flexBasis: realReferenceMode ? undefined : '48%',
    flexShrink: realReferenceMode ? 0 : undefined,
    minHeight: '150px',
    minHeightTablet: '150px',
    minHeightMobile: '180px',
    borderRadius: '14px',
    backgroundPosition: 'center',
  });
  context.heroProofCards += 3;
}

function addHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  if (isLumenProfile(context)) {
    addLumenHeroSection(context, sectionName, containerName);
    return;
  }
  if (maidy) {
    addMaidyHeroSection(context, sectionName, containerName);
    return;
  }
  if (careglo) {
    addCaregloHeroSection(context, sectionName, containerName);
    return;
  }
  if (isOptomattaProfile(context)) {
    addOptomattaHeroSection(context, sectionName, containerName);
    return;
  }

  const heroProps = {
    paddingTop: '72px',
    paddingBottom: '84px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  };
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    ...heroProps,
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '48px',
    responsiveStack: 'tablet',
    minHeight: geometry.heroMinHeight,
    minHeightTablet: geometry.heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '20px',
    flexBasis: '46%',
  });

  addText(context, copy.id, eyebrowText(context.brief), {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: '800',
    textColor: style.accent,
    backgroundColor: style.badgeBackground,
    paddingY: '8px',
    paddingX: '12px',
    borderRadius: '999px',
  });
  addHeading(context, copy.id, 'Thoughtful service, made easy to choose.', 'h1', {
    fontSize: '64px',
    fontSizeTablet: '52px',
    fontSizeMobile: '42px',
    lineHeight: '0.98',
    fontWeight: '900',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, context.replacementProfile.lead, {
    fontSize: '20px',
    fontSizeMobile: '16px',
    lineHeight: '1.55',
    textColor: style.muted,
  });
  addButton(context, copy.id, primaryAction(context.brief), '#');

  const media = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '20px',
    flexBasis: '54%',
  });
  addMediaSurface(context, media.id, 'hero', context.replacementProfile.hero, {
    width: '100%',
    minHeight: geometry.visualMinHeight,
    minHeightTablet: geometry.visualMinHeightTablet,
    minHeightMobile: geometry.visualMinHeightMobile,
    borderRadius: geometry.radius,
  });

  addHeroProofDeck(context, media.id);
}

function addOptomattaHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const realReferenceSourceUrl = typeof context.brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? context.brief.authoringRequirements.realReferenceSourceUrl
    : '';
  const realReferenceMode = context.brief.authoringRequirements?.requireRealReference === true
    || /optomatta/i.test(realReferenceSourceUrl);
  const heroCompositeSource = realReferenceMode ? optomattaHeroCompositeSource() : '';
  const usesHeroComposite = heroCompositeSource !== '';
  const usesSplitHero = realReferenceMode && !usesHeroComposite;
  const heroMinHeight = realReferenceMode ? '704px' : scalePxLength(geometry.heroMinHeight, 0.73, geometry.heroMinHeightMobile);
  const heroMinHeightTablet = realReferenceMode ? geometry.heroMinHeightTablet : scalePxLength(geometry.heroMinHeightTablet, 0.6, '344px');
  const primaryCta = realReferenceMode
    ? context.replacementProfile.primaryCta || 'Plan an Eye Exam'
    : primaryAction(context.brief);
  const secondaryCta = realReferenceMode
    ? context.replacementProfile.secondaryCta || 'Explore Eyewear'
    : secondaryAction(context.brief, 'Ask optometrist');
  const eyebrow = context.replacementProfile.heroEyebrow || (realReferenceMode ? 'VISION & FRAME STUDIO' : 'OPTICAL CARE STUDIO');
  const lead = context.replacementProfile.lead;
  const heading = realReferenceMode
    ? context.replacementProfile.heroHeading || 'Clear vision, thoughtfully fitted'
    : firstHeading(context.brief);
  const copyMaxWidth = usesHeroComposite ? '566px' : realReferenceMode ? '50%' : '700px';
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: usesHeroComposite ? '1240px' : realReferenceMode ? OPTOMATTA_CANVAS_WIDTH : geometry.innerMaxWidth,
    innerPaddingX: usesHeroComposite ? '20px' : realReferenceMode ? '0px' : '20px',
    minHeight: heroMinHeight,
    minHeightTablet: heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
    ...backgroundProps(context, sectionName, '#ffffff'),
    ...(usesSplitHero ? {} : {
      backgroundImage: heroCompositeSource || context.replacementProfile.hero,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: usesSplitHero ? 'stretch' : 'flex-start',
    gap: '0px',
    responsiveStack: usesSplitHero ? 'mobile' : 'tablet',
    minHeight: heroMinHeight,
    minHeightTablet: heroMinHeightTablet,
    minHeightMobile: geometry.heroMinHeightMobile,
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: '22px',
    flexBasis: usesSplitHero || usesHeroComposite ? copyMaxWidth : undefined,
    width: '100%',
    maxWidth: copyMaxWidth,
    maxWidthMobile: usesSplitHero ? '100%' : undefined,
    minWidth: '0px',
    paddingTop: realReferenceMode ? '132px' : '172px',
    paddingTopTablet: '42px',
    paddingTopMobile: '42px',
    paddingRight: usesSplitHero ? '34px' : '0px',
    paddingRightMobile: usesSplitHero ? '20px' : undefined,
    paddingBottom: '70px',
    paddingBottomTablet: '0px',
    paddingBottomMobile: '0px',
    paddingLeft: usesSplitHero ? '120px' : '0px',
    paddingLeftMobile: usesSplitHero ? '20px' : undefined,
    ...(usesHeroComposite ? {} : usesSplitHero ? {
      ...backgroundProps(context, containerName, '#ffffff'),
      backgroundImage: context.replacementProfile.secondary,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundOverlay: 'rgba(255, 255, 255, 0.78)',
    } : backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.78)')),
  });
  addText(context, copy.id, eyebrow, {
    fontSize: '13px',
    lineHeight: '1.2',
    letterSpacing: '0.34em',
    fontWeight: '800',
    textTransform: 'uppercase',
    textColor: '#e96778',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copy.id, heading, 'h1', {
    fontSize: '75px',
    fontSizeTablet: '52px',
    fontSizeMobile: realReferenceMode ? '42px' : '46px',
    lineHeight: '0.96',
    fontWeight: '900',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, lead, {
    fontSize: '20px',
    fontSizeTablet: '20px',
    fontSizeMobile: '16px',
    lineHeight: '1.42',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '14px',
  });
  const actions = createCanvasNode(context, containerName, copy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '12px',
    responsiveStack: 'mobile',
    width: '100%',
  });
  addButton(context, actions.id, primaryCta.toUpperCase(), '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  addButton(context, actions.id, secondaryCta.toUpperCase(), '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: '#ffffff',
    textColor: style.ink,
  });

  if (usesSplitHero) {
    addMediaSurface(context, wrap.id, 'hero', context.replacementProfile.hero, {
      flexBasis: '50%',
      width: '100%',
      minWidth: '0px',
      minHeight: heroMinHeight,
      minHeightTablet: geometry.heroMinHeightTablet,
      minHeightMobile: geometry.visualMinHeightMobile,
      borderRadius: '0px',
      backgroundPosition: 'center center',
    });
  }

  if (requiredRoleMinimum(context.brief, 'secondary') > 0) {
    const media = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      flexGrow: 1,
      minHeight: geometry.heroMinHeight,
      minHeightTablet: '0px',
      minHeightMobile: '0px',
      paddingTop: '0px',
      paddingRight: '64px',
      paddingBottom: '56px',
      paddingLeft: '0px',
      responsiveDisplay: 'hide-tablet-down',
    });
    addMediaSurface(context, media.id, 'secondary', context.replacementProfile.secondary, {
      width: '310px',
      minHeight: '220px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
  }

  context.heroProofCards += 1;
}

function addOptomattaProofStripSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const strip = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '54px',
    paddingBottom: '54px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const grid = createCanvasNode(context, containerName, strip.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '48px',
    responsiveStack: 'tablet',
  });
  const labels = h3Texts(context.brief);
  const stats = statItems(context.brief);
  const proofItems = (stats.length >= 3 ? stats : [
    { value: '28', label: 'doctors' },
    { value: '24h', label: 'service' },
    { value: '4.9', label: 'rating' },
  ]).slice(0, 3).map((item, index) => ({
    title: item.value || labels[index] || '',
    body: item.label || serviceCopy(context.replacementProfile, index),
  }));
  for (const item of proofItems) {
    const card = createCanvasNode(context, containerName, grid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '28px',
      paddingTop: '0px',
      paddingRight: '42px',
      paddingBottom: '0px',
      paddingLeft: '42px',
    });
    const valueRow = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '34px',
    });
    const iconBox = createCanvasNode(context, containerName, valueRow.id, {
      layoutDisplay: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '40px',
      minHeight: '40px',
      borderWidth: '3px',
      borderColor: style.accent,
    });
    addText(context, iconBox.id, '✓', {
      fontSize: '24px',
      lineHeight: '1',
      fontWeight: '800',
      textAlign: 'center',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, valueRow.id, item.title || item.value, {
      fontSize: '24px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: '#474747',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, item.body || item.label, {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: '#7a7a7a',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addOptomattaIntroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const section = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '82px',
    paddingBottom: '88px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, section.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '64px',
    responsiveStack: 'tablet',
  });
  const media = createCanvasNode(context, containerName, wrap.id, {
    flexBasis: '52%',
    minWidth: '0px',
  });
  addMediaSurface(context, media.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'optomatta-intro-clinic'), {
    width: '100%',
    minHeight: geometry.visualMinHeight,
    minHeightTablet: geometry.visualMinHeightTablet,
    minHeightMobile: geometry.visualMinHeightMobile,
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const copy = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '22px',
    flexBasis: '48%',
    minWidth: '0px',
  });
  addText(context, copy.id, 'Who We Are', {
    display: 'inline-block',
    fontSize: '15px',
    lineHeight: '1.2',
    fontWeight: '700',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, copy.id, secondHeading(context.brief), 'h2', {
    fontSize: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.16',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copy.id, 'A precise optical-care studio pairing exams, eyewear fitting, lens support, and everyday guidance in one clear customer path.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.62',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, copy.id, 'Discover more', '#', {
    paddingTop: '16px',
    paddingRight: '30px',
    paddingBottom: '16px',
    paddingLeft: '30px',
    borderRadius: '0px',
    fontSize: '14px',
    fontWeight: '800',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
}

function addOptomattaHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;

  const frameSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '96px',
    paddingBottom: '96px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const frameWrap = createCanvasNode(context, containerName, frameSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '32px',
    responsiveStack: 'tablet',
  });
  const frameCopy = createCanvasNode(context, containerName, frameWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '28px',
    flexBasis: '38%',
    minWidth: '0px',
  });
  addText(context, frameCopy.id, 'Frame Selection', {
    fontSize: '15px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, frameCopy.id, 'Everyday eyewear shaped around personal fit, lasting comfort, and effortless style.', 'h2', {
    fontSize: '48px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, frameCopy.id, 'Our opticians explain lens choices, frame fit, and the next appointment step in clear, practical language.', {
    fontSize: '17px',
    fontSizeMobile: '16px',
    lineHeight: '1.62',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, frameCopy.id, 'Browse frames', '#', {
    borderRadius: '0px',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  const frameMediaGrid = createCanvasNode(context, containerName, frameWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '22px',
    flexBasis: '62%',
    minWidth: '0px',
    responsiveStack: 'mobile',
  });
  addMediaSurface(context, frameMediaGrid.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[0], 'optomatta-frame-wall'), {
    minHeight: '520px',
    minHeightTablet: '420px',
    minHeightMobile: '300px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const stackedMedia = createCanvasNode(context, containerName, frameMediaGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '22px',
  });
  addMediaSurface(context, stackedMedia.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[1], 'optomatta-fitting-detail'), {
    minHeight: '249px',
    minHeightTablet: '200px',
    minHeightMobile: '220px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  addMediaSurface(context, stackedMedia.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[2], 'optomatta-lens-care'), {
    minHeight: '249px',
    minHeightTablet: '200px',
    minHeightMobile: '220px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '94px',
    paddingBottom: '94px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const processIntro = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '32px',
    responsiveStack: 'tablet',
  });
  addHeading(context, processIntro.id, 'A simple path from eye exam to fitted frames.', 'h2', {
    fontSize: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processIntro.id, 'Each step is explained with calm guidance, clinical expertise, and confidence about what comes next.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
    paddingTop: '46px',
  });
  const processItems = [
    ['01', 'Book an eye exam', 'Choose a convenient time and tell us what you would like help seeing more clearly.'],
    ['02', 'Choose your frame', 'Compare styles, comfort, lens options, and fit with an experienced optician.'],
    ['03', 'Collect and adjust', 'Pick up your eyewear with a precise adjustment and practical lens-care advice.'],
  ];
  for (const [number, title, body] of processItems) {
    const card = createCanvasNode(context, containerName, processGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      paddingTop: '34px',
      paddingRight: '30px',
      paddingBottom: '34px',
      paddingLeft: '30px',
      minHeight: '420px',
      ...backgroundProps(context, containerName, style.bg),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[(Number(number) - 1) % context.replacementProfile.serviceCard.length], `optomatta-process-${number}`), {
      width: '100%',
      minHeight: '168px',
      minHeightTablet: '154px',
      minHeightMobile: '180px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    addText(context, card.id, number, {
      fontSize: '42px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '26px',
      fontSizeMobile: '22px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '16px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const appointmentSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '104px',
    paddingBottom: '67px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const appointmentWrap = createCanvasNode(context, containerName, appointmentSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '0px',
    responsiveStack: 'tablet',
    ...backgroundProps(context, containerName, style.accent),
  });
  const appointmentMedia = createCanvasNode(context, containerName, appointmentWrap.id, {
    flexBasis: '50%',
    minWidth: '0px',
  });
  addMediaSurface(context, appointmentMedia.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'optomatta-appointment-exam'), {
    minHeight: '560px',
    minHeightTablet: '420px',
    minHeightMobile: '300px',
    borderRadius: '0px',
    backgroundPosition: 'center',
  });
  const appointmentCopy = createCanvasNode(context, containerName, appointmentWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    flexBasis: '50%',
    minWidth: '0px',
    paddingTop: '68px',
    paddingRight: '68px',
    paddingBottom: '68px',
    paddingLeft: '68px',
  });
  addText(context, appointmentCopy.id, 'Appointment Ready', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: 'rgba(255, 255, 255, 0.76)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, appointmentCopy.id, 'Move from frame browsing to expert guidance with ease.', 'h2', {
    fontSize: '46px',
    fontSizeMobile: '32px',
    lineHeight: '1.1',
    fontWeight: '800',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, appointmentCopy.id, 'Speak with an optometrist, confirm a convenient appointment, and get practical answers before your visit.', {
    fontSize: '17px',
    lineHeight: '1.62',
    textColor: 'rgba(255, 255, 255, 0.82)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, appointmentCopy.id, 'Ask optometrist', '#', {
    borderRadius: '0px',
    backgroundColor: '#ffffff',
    textColor: style.ink,
  });

  const reviewsSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '98px',
    paddingBottom: '110px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const reviewsGrid = createCanvasNode(context, containerName, reviewsSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
  });
  const reviews = [
    ['4.8', 'Average patient rating', 'Patients value patient explanations, comfortable fittings, and thoughtful follow-up.'],
    ['24h', 'Fast appointment follow-up', 'Questions receive a prompt answer so every visit begins with clear expectations.'],
    ['300+', 'Frames fitted monthly', 'Experienced opticians balance personal style, lens needs, and all-day comfort.'],
  ];
  for (const [index, [value, title, body]] of reviews.entries()) {
    const card = createCanvasNode(context, containerName, reviewsGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '28px',
      minHeight: '460px',
      paddingTop: '34px',
      paddingRight: '32px',
      paddingBottom: '34px',
      paddingLeft: '32px',
      ...backgroundProps(context, containerName, style.bg),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], `optomatta-trust-${index + 1}`), {
      width: '100%',
      minHeight: '176px',
      minHeightTablet: '160px',
      minHeightMobile: '190px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    addText(context, card.id, value, {
      fontSize: '54px',
      lineHeight: '1',
      fontWeight: '900',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '26px',
      lineHeight: '1.16',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '16px',
      lineHeight: '1.56',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const finalSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '120px',
    paddingBottom: '130px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.ink),
    backgroundImage: mediaVariant(context.replacementProfile.hero, 'optomatta-final-cta'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(9, 13, 19, 0.78)',
  });
  const finalWrap = createCanvasNode(context, containerName, finalSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '30px',
    textAlign: 'center',
  });
  addText(context, finalWrap.id, 'YOUR NEXT PAIR', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, finalWrap.id, 'Ready for eyewear that feels right all day?', 'h2', {
    fontSize: '52px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '800',
    textAlign: 'center',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, finalWrap.id, '+1 (415) 555-0186', {
    fontSize: '24px',
    lineHeight: '1.2',
    fontWeight: '800',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, finalWrap.id, 'Book eye exam', '#', {
    borderRadius: '0px',
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
}

function addLumenHeroSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const heroStats = [
    { value: '10K+', label: 'Visits supported' },
    { value: '15+', label: 'Years of practice' },
  ];
  const doctorSource = `${context.replacementProfile.hero}${context.replacementProfile.hero.includes('?') ? '&' : '?'}ix=monteby-lumen-doctor`;
  const doctorCutoutSource = lumenDoctorCutoutSource() || doctorSource;
  const usesCutoutDoctor = isTransparentCutoutSource(doctorCutoutSource);
  const hero = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '84px',
    paddingTopTablet: '34px',
    paddingTopMobile: '24px',
    paddingBottom: '0px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '952px',
    minHeightTablet: '1014px',
    minHeightMobile: '1305px',
    ...backgroundProps(context, sectionName, style.bg),
    ...(usesCutoutDoctor
      ? {
        backgroundType: 'gradient',
        gradientType: 'linear',
        gradientAngle: 105,
        gradientColor1: '#e8fbef',
        gradientColor2: '#fbffdf',
        backgroundAccentType: 'radial',
        backgroundAccentColor1: 'rgba(47, 214, 120, 0.22)',
        backgroundAccentColor2: 'rgba(248, 255, 220, 0)',
        backgroundAccentPositionX: '46%',
        backgroundAccentPositionY: '40%',
        backgroundAccentSize: '72%',
      }
      : {
        backgroundImage: context.replacementProfile.hero,
        backgroundSize: 'contain',
        backgroundPosition: 'left bottom',
        backgroundRepeat: 'no-repeat',
        backgroundOverlay: 'rgba(238, 251, 227, 0.82)',
      }),
  });
  const wrap = createCanvasNode(context, containerName, hero.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const intro = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '110px',
    gapTablet: '40px',
    gapMobile: '20px',
    responsiveStack: 'tablet',
    gridColumnStart: 1,
    gridRowStart: 1,
  });
  const eyebrowColumn = createCanvasNode(context, containerName, intro.id, {
    flexBasis: '139px',
    flexShrink: 0,
    paddingTop: '40px',
    paddingTopTablet: '0px',
    paddingTopMobile: '0px',
  });
  addText(context, eyebrowColumn.id, 'EYE CARE CENTER', {
    fontSize: '14px',
    fontSizeTablet: '14px',
    fontSizeMobile: '14px',
    lineHeight: '1.25',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.1em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const headlineColumn = createCanvasNode(context, containerName, intro.id, {
    flexBasis: '836px',
    flexShrink: 0,
    width: '836px',
  });
  const headingStack = createCanvasNode(context, containerName, headlineColumn.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0px',
    width: '100%',
  });
  const firstLine = createCanvasNode(context, containerName, headingStack.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    justifyContentMobile: 'center',
    width: '100%',
  });
  addHeading(context, firstLine.id, 'Clear Sight.', 'h1', {
    fontSize: '120px',
    fontSizeTablet: '80px',
    fontSizeMobile: '60px',
    lineHeight: '1.1',
    lineHeightTablet: '1',
    lineHeightMobile: '1.2',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textAlign: 'left',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const secondLine = createCanvasNode(context, containerName, headingStack.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    justifyContentMobile: 'center',
    width: '100%',
    paddingLeft: '200px',
    paddingLeftTablet: '310px',
    paddingLeftMobile: '0px',
  });
  addHeading(context, secondLine.id, 'Bright Days.', 'h1', {
    fontSize: '120px',
    fontSizeTablet: '80px',
    fontSizeMobile: '60px',
    lineHeight: '1.1',
    lineHeightTablet: '1',
    lineHeightMobile: '1.2',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textAlign: 'left',
    textAlignMobile: 'center',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const details = createCanvasNode(context, containerName, headlineColumn.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
    width: '755px',
    maxWidthTablet: '100%',
    maxWidthMobile: '100%',
    paddingTop: '20px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '325px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, details.id, 'Clearwell pairs attentive examinations with practical guidance, so every visit ends with an understandable next step.', {
    fontSize: '16px',
    fontSizeMobile: '15px',
    lineHeight: '1.5',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const actions = createCanvasNode(context, containerName, details.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  });
  addButton(context, actions.id, 'Book Now', '#', {
    backgroundColor: style.accent2,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });
  addButton(context, actions.id, 'Explore Services', '#', {
    backgroundColor: style.ink,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });

  const stage = createCanvasNode(context, containerName, wrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '0px',
    responsiveStack: 'tablet',
    gridColumnStart: 1,
    gridRowStart: 1,
    paddingTop: '338px',
    paddingTopTablet: '370px',
    paddingTopMobile: '490px',
  });
  const mediaColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    flexBasis: '552px',
    flexShrink: 0,
    width: '552px',
    minHeight: '530px',
    minHeightTablet: '100px',
    minHeightMobile: '100px',
  });
  if (usesCutoutDoctor) {
    const doctorOffset = createCanvasNode(context, containerName, mediaColumn.id, {
      gridColumnStart: 1,
      gridRowStart: 1,
      width: '552px',
      paddingLeft: '110px',
      responsiveDisplay: 'hide-tablet-down',
    });
    createCanvasNode(context, containerName, doctorOffset.id, {
      width: '440px',
      minHeight: '530px',
      backgroundImage: doctorCutoutSource,
      backgroundSize: 'contain',
      backgroundPosition: 'right',
      backgroundRepeat: 'no-repeat',
    });
  } else {
    const doctorOffset = createCanvasNode(context, containerName, mediaColumn.id, {
      gridColumnStart: 1,
      gridRowStart: 1,
      width: '552px',
      paddingLeft: '110px',
      responsiveDisplay: 'hide-tablet-down',
    });
    addMediaSurface(context, doctorOffset.id, 'hero', doctorCutoutSource, {
      width: '440px',
      minHeight: '530px',
      borderRadius: '0px',
      backgroundPosition: 'top',
    });
  }
  const desktopStats = createCanvasNode(context, containerName, mediaColumn.id, {
    gridColumnStart: 1,
    gridRowStart: 1,
    width: '330px',
    paddingTop: '290px',
    responsiveDisplay: 'hide-tablet-down',
  });
  addLumenStatsRow(context, desktopStats.id, heroStats);
  const responsiveStats = createCanvasNode(context, containerName, mediaColumn.id, {
    gridColumnStart: 1,
    gridRowStart: 1,
    width: '330px',
    paddingLeftMobile: '33px',
    responsiveDisplay: 'show-tablet-down-only',
  });
  addLumenStatsRow(context, responsiveStats.id, heroStats);

  const middleColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexBasis: '344px',
    flexShrink: 0,
    width: '344px',
    paddingTop: '163px',
    paddingTopTablet: '84px',
    paddingTopMobile: '84px',
  });
  addMediaSurface(context, middleColumn.id, 'secondary', mediaVariant(context.replacementProfile.secondary, 'lumen-hero-mini'), {
    width: '100%',
    maxWidth: '235px',
    maxWidthTablet: '235px',
    maxWidthMobile: '100%',
    minHeight: '156px',
    minHeightTablet: '150px',
    minHeightMobile: '232px',
    borderRadius: '10px',
    backgroundPosition: 'center',
  });

  const proofColumn = createCanvasNode(context, containerName, stage.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexBasis: '338px',
    flexShrink: 0,
    width: '338px',
    paddingTop: '247px',
    paddingTopTablet: '0px',
    paddingTopMobile: '0px',
    paddingBottom: '0px',
  });
  addHeroProofCard(context, proofColumn.id);
}

function addLumenStatsRow(context, parentId, heroStats) {
  const style = context.styleProfile;
  const containerName = findComponent(context.contractIndex, ['Container'])?.name || 'Container';
  const statsRow = createCanvasNode(context, containerName, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '72px',
    gapTablet: '72px',
    gapMobile: '60px',
    width: '330px',
  });
  for (const item of heroStats) {
    const stat = createCanvasNode(context, containerName, statsRow.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
    addHeading(context, stat.id, item.value, 'h2', {
      fontSize: '60px',
      fontSizeTablet: '50px',
      fontSizeMobile: '50px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, item.label, {
      fontSize: '12px',
      fontSizeMobile: '11px',
      lineHeight: '1.35',
      fontFamily: 'Manrope',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
}

function addLumenHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;

  const careSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '70px',
    paddingTopTablet: '70px',
    paddingTopMobile: '70px',
    paddingBottom: '70px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '690px',
    minHeightTablet: '1210px',
    minHeightMobile: '1233px',
    ...backgroundProps(context, sectionName, '#f7fff0'),
  });
  const careWrap = createCanvasNode(context, containerName, careSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '56px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const careMedia = createCanvasNode(context, containerName, careWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '16px',
    flexBasis: '47%',
    minWidth: '0px',
  });
  addMediaSurface(context, careMedia.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[0], 'lumen-intro-wide'), {
    width: '100%',
    minHeight: '220px',
    minHeightTablet: '240px',
    minHeightMobile: '220px',
    gridColumnSpan: 2,
    gridColumnSpanMobile: 1,
    borderRadius: geometry.mediaRadius,
    backgroundPosition: 'center',
  });
  for (const [index, source] of [context.replacementProfile.secondary, context.replacementProfile.serviceCard[1]].entries()) {
    addMediaSurface(context, careMedia.id, 'service-card', mediaVariant(source, `lumen-intro-detail-${index + 1}`), {
      width: '100%',
      minHeight: '180px',
      minHeightTablet: '220px',
      minHeightMobile: '220px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
  }
  const careCopy = createCanvasNode(context, containerName, careWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '24px',
    flexBasis: '53%',
    minWidth: '0px',
  });
  addText(context, careCopy.id, 'CARE IN CONTEXT', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, careCopy.id, 'A clearer plan starts with a calm first conversation.', 'h2', {
    fontSize: '54px',
    fontSizeTablet: '48px',
    fontSizeMobile: '38px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, careCopy.id, 'Thoughtful diagnostics, plain-language guidance, and a steady pace make each decision easier to understand.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.66',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, careCopy.id, 'Plan a first visit', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });

  const serviceSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '954px',
    minHeightTablet: '1447px',
    minHeightMobile: '1925px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const serviceIntro = createCanvasNode(context, containerName, serviceSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addHeading(context, serviceIntro.id, 'Everyday care for changing eyes and busy lives.', 'h2', {
    fontSize: '50px',
    fontSizeMobile: '36px',
    lineHeight: '1.08',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, serviceIntro.id, 'From routine checks to focused treatment, each service keeps the purpose and the next step in view.', {
    fontSize: '17px',
    lineHeight: '1.58',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const serviceGrid = createCanvasNode(context, containerName, serviceSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '28px',
    paddingTop: '52px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  for (const [index, label] of ['Vision reviews', 'Comfort therapy', 'Lens guidance'].entries()) {
    const card = createCanvasNode(context, containerName, serviceGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '24px',
      paddingTop: '28px',
      paddingRight: '28px',
      paddingBottom: '32px',
      paddingLeft: '28px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
      boxShadow: 'soft',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], `lumen-service-${index + 1}`), {
      width: '100%',
      minHeight: '280px',
      minHeightTablet: '300px',
      minHeightMobile: '300px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
    addHeading(context, card.id, label, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '24px',
      lineHeight: '1.15',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, serviceCopy(context.replacementProfile, index), {
      fontSize: '16px',
      lineHeight: '1.58',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '60px',
    paddingTopTablet: '80px',
    paddingTopMobile: '50px',
    paddingBottom: '60px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '50px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '592px',
    minHeightTablet: '1222px',
    minHeightMobile: '972px',
    ...backgroundProps(context, sectionName, '#e8f7dd'),
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '54px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const processCopy = createCanvasNode(context, containerName, processGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '22px',
  });
  addText(context, processCopy.id, 'WHEN SIGHT CHANGES', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, processCopy.id, 'Prompt support when clarity cannot wait.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processCopy.id, 'A focused consultation helps identify sudden discomfort, visual changes, and the safest next action without adding confusion.', {
    fontSize: '17px',
    fontSizeMobile: '15px',
    lineHeight: '1.62',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, processCopy.id, 'Request prompt care', '#', {
    backgroundColor: style.accent2,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });
  addMediaSurface(context, processGrid.id, 'reference-media', mediaVariant(lumenDoctorCutoutSource() || context.replacementProfile.hero, 'lumen-prompt-care'), {
    width: '100%',
    minHeight: '472px',
    minHeightTablet: '520px',
    minHeightMobile: '380px',
    borderRadius: geometry.radius,
    backgroundSize: 'contain',
    backgroundPosition: 'bottom',
  });

  const technologySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '100px',
    paddingTopTablet: '100px',
    paddingTopMobile: '80px',
    paddingBottom: '100px',
    paddingBottomTablet: '100px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '826px',
    minHeightTablet: '1440px',
    minHeightMobile: '1391px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const technologyGrid = createCanvasNode(context, containerName, technologySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '54px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const technologyCopy = createCanvasNode(context, containerName, technologyGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    gridColumnStart: 2,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    paddingTop: '36px',
    paddingRight: '36px',
    paddingBottom: '36px',
    paddingLeft: '36px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, containerName, style.cardBackground),
  });
  addText(context, technologyCopy.id, 'OUR APPROACH', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, technologyCopy.id, 'Clinical focus, human conversations.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, technologyCopy.id, 'Careful imaging supports the clinical work, while patient explanations keep every finding connected to daily life.', {
    fontSize: '17px',
    lineHeight: '1.65',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const technologyStats = createCanvasNode(context, containerName, technologyCopy.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    gap: '42px',
  });
  for (const [value, label] of [['48K+', 'care moments'], ['24K+', 'follow-ups']]) {
    const stat = createCanvasNode(context, containerName, technologyStats.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });
    addHeading(context, stat.id, value, 'h3', {
      fontSize: '42px',
      fontSizeMobile: '34px',
      lineHeight: '1',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, label, {
      fontSize: '12px',
      lineHeight: '1.35',
      fontFamily: 'Manrope',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  const technologyMedia = createCanvasNode(context, containerName, technologyGrid.id, {
    minWidth: '0px',
    gridColumnStart: 1,
    gridRowStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
  });
  addMediaSurface(context, technologyMedia.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'lumen-approach'), {
    width: '100%',
    minHeight: '626px',
    minHeightTablet: '520px',
    minHeightMobile: '420px',
    borderRadius: geometry.radius,
    backgroundPosition: 'center',
  });

  const trustSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '1019px',
    minHeightTablet: '1564px',
    minHeightMobile: '2710px',
    ...backgroundProps(context, sectionName, '#e8f7dd'),
  });
  const trustWrap = createCanvasNode(context, containerName, trustSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '44px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const trustIntro = createCanvasNode(context, containerName, trustWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
  });
  addHeading(context, trustIntro.id, 'Experienced eyes on every detail.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, trustIntro.id, 'A compact team of clinicians brings focused experience to preventive care, optics, comfort, and long-term follow-up.', {
    fontSize: '17px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const trustGrid = createCanvasNode(context, containerName, trustWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '26px',
  });
  const trustItems = [
    ['Mara Venn', 'Preventive care', context.replacementProfile.serviceCard[0]],
    ['Jon Bell', 'Clinical optics', context.replacementProfile.serviceCard[1]],
    ['Inez Park', 'Comfort therapy', context.replacementProfile.serviceCard[2]],
    ['Owen Reed', 'Family vision', lumenDoctorCutoutSource() || context.replacementProfile.hero],
  ];
  for (const [index, item] of trustItems.entries()) {
    const [name, focus, source] = item;
    const card = createCanvasNode(context, containerName, trustGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '22px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-specialist-${index + 1}`), {
      width: '100%',
      minHeight: '330px',
      minHeightTablet: '330px',
      minHeightMobile: '360px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'top',
    });
    addHeading(context, card.id, name, 'h3', {
      fontSize: '22px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, focus, {
      fontSize: '14px',
      lineHeight: '1.45',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '92px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '1143px',
    minHeightTablet: '1436px',
    minHeightMobile: '2280px',
    ...backgroundProps(context, sectionName, style.ink),
  });
  const whyWrap = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '42px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, whyWrap.id, 'WHY CLEARWELL', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent2,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyWrap.id, 'Better tools. Better explanations. Better follow-through.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const whyGrid = createCanvasNode(context, containerName, whyWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
  });
  const whyItems = [
    ['Focused imaging', 'Sharper diagnostics give each conversation a useful starting point.', context.replacementProfile.serviceCard[0]],
    ['Plain-language notes', 'Clear summaries connect clinical findings to work, travel, and home routines.', ''],
    ['Comfort-led testing', 'A measured pace creates room for questions and more confident answers.', context.replacementProfile.serviceCard[1]],
    ['Care continuity', 'Follow-up remains connected to the same plan instead of becoming a separate task.', ''],
    ['Useful adjustments', 'Small changes to lenses, habits, and timing can make everyday vision feel easier.', context.replacementProfile.serviceCard[2]],
    ['Thoughtful access', 'Scheduling and support stay straightforward when a new concern appears.', ''],
  ];
  for (const [index, item] of whyItems.entries()) {
    const [title, body, source] = item;
    const card = createCanvasNode(context, containerName, whyGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      minHeight: source ? '330px' : '250px',
      paddingTop: '22px',
      paddingRight: '22px',
      paddingBottom: '24px',
      paddingLeft: '22px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, source ? '#102d38' : '#0b2330'),
    });
    if (source) {
      addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-why-${index + 1}`), {
        width: '100%',
        minHeight: '210px',
        minHeightTablet: '220px',
        minHeightMobile: '240px',
        borderRadius: geometry.mediaRadius,
        backgroundPosition: 'center',
      });
    } else {
      addText(context, card.id, `0${index + 1}`, {
        fontSize: '34px',
        lineHeight: '1',
        fontWeight: '600',
        fontFamily: 'Outfit',
        textColor: style.accent2,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addHeading(context, card.id, title, 'h3', {
      fontSize: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: '#ffffff',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: '#b6cbd2',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const testimonialSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '100px',
    paddingTopTablet: '100px',
    paddingTopMobile: '80px',
    paddingBottom: '100px',
    paddingBottomTablet: '100px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '899px',
    minHeightTablet: '1434px',
    minHeightMobile: '1323px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '56px',
    responsiveStack: 'tablet',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const testimonialCopy = createCanvasNode(context, containerName, testimonialGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
  });
  addText(context, testimonialCopy.id, 'PATIENT PERSPECTIVE', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialCopy.id, 'Care that feels considered from the first question.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialCopy.id, '“The team explained each finding in a way that felt calm and useful. I left knowing what mattered now and what could wait.”', {
    fontSize: '21px',
    fontSizeMobile: '18px',
    lineHeight: '1.55',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialCopy.id, 'Elena Morris · patient since 2022', {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '700',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addMediaSurface(context, testimonialGrid.id, 'reference-media', mediaVariant(context.replacementProfile.secondary, 'lumen-patient-story'), {
    width: '100%',
    minHeight: '659px',
    minHeightTablet: '520px',
    minHeightMobile: '420px',
    borderRadius: geometry.radius,
    backgroundPosition: 'center',
  });

  const certificationSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '90px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '710px',
    minHeightTablet: '982px',
    minHeightMobile: '1576px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const certificationWrap = createCanvasNode(context, containerName, certificationSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '38px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, certificationWrap.id, 'PRACTICE STANDARDS', {
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.16em',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, certificationWrap.id, 'Independent standards, consistently applied.', 'h2', {
    fontSize: '44px',
    fontSizeTablet: '40px',
    fontSizeMobile: '32px',
    lineHeight: '1.15',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textAlign: 'center',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const certificationGrid = createCanvasNode(context, containerName, certificationWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    width: '100%',
  });
  for (const [index, item] of [
    ['Clinical review', 'Annual practice review keeps care standards current and accountable.'],
    ['Equipment checks', 'Routine calibration supports consistent imaging and dependable findings.'],
    ['Care protocols', 'Documented procedures give each visit a steady clinical foundation.'],
    ['Patient confidence', 'Clear consent and plain explanations remain part of every decision.'],
  ].entries()) {
    const [title, body] = item;
    const card = createCanvasNode(context, containerName, certificationGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '210px',
      paddingTop: '26px',
      paddingRight: '24px',
      paddingBottom: '26px',
      paddingLeft: '24px',
      borderRadius: geometry.cardRadius,
      borderWidth: '1px',
      borderColor: '#d9e9d1',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addText(context, card.id, `0${index + 1}`, {
      fontSize: '28px',
      lineHeight: '1',
      fontWeight: '600',
      fontFamily: 'Outfit',
      textColor: style.accent2,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '20px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const finalSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '70px',
    paddingTopMobile: '60px',
    paddingBottom: '80px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '60px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '594px',
    minHeightTablet: '504px',
    minHeightMobile: '498px',
    ...backgroundProps(context, sectionName, style.ink),
    backgroundImage: mediaVariant(context.replacementProfile.serviceCard[1], 'lumen-booking-band'),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundOverlay: 'rgba(6, 26, 39, 0.78)',
  });
  const finalWrap = createCanvasNode(context, containerName, finalSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '26px',
    textAlign: 'center',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  addText(context, finalWrap.id, 'PLAN YOUR VISIT', {
    fontSize: '14px',
    lineHeight: '1.2',
    fontWeight: '700',
    fontFamily: 'Manrope',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, finalWrap.id, 'Make space for clearer sight.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textAlign: 'center',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, finalWrap.id, 'Choose a visit time', '#', {
    backgroundColor: style.accent,
    textColor: style.buttonFg,
    fontFamily: 'Manrope',
  });

  const articleSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '90px',
    paddingTopTablet: '90px',
    paddingTopMobile: '90px',
    paddingBottom: '90px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '90px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '977px',
    minHeightTablet: '1812px',
    minHeightMobile: '1904px',
    ...backgroundProps(context, sectionName, '#f8ffef'),
  });
  const articleWrap = createCanvasNode(context, containerName, articleSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '46px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const articleIntro = createCanvasNode(context, containerName, articleWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '42px',
    responsiveStack: 'tablet',
  });
  addHeading(context, articleIntro.id, 'Useful guidance for everyday vision.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '44px',
    fontSizeMobile: '34px',
    lineHeight: '1.12',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, articleIntro.id, 'Short reads on comfort, eyewear, screen habits, and the signs worth discussing at a future visit.', {
    fontSize: '16px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const articleGrid = createCanvasNode(context, containerName, articleWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '26px',
    responsiveStack: 'tablet',
  });
  const articles = [
    ['Screen comfort that lasts beyond the workday', 'Small distance, lighting, and break changes can reduce unnecessary visual strain.', context.replacementProfile.serviceCard[0]],
    ['Choosing lenses around the way you move', 'Daily routines offer better clues than trends when comparing lens options.', context.replacementProfile.serviceCard[1]],
    ['When a vision change deserves a closer look', 'A simple symptom record can make an upcoming conversation more useful.', context.replacementProfile.serviceCard[2]],
  ];
  for (const [index, article] of articles.entries()) {
    const [title, body, source] = article;
    const card = createCanvasNode(context, containerName, articleGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '24px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(source, `lumen-article-${index + 1}`), {
      width: '100%',
      minHeight: '300px',
      minHeightTablet: '340px',
      minHeightMobile: '320px',
      borderRadius: geometry.mediaRadius,
      backgroundPosition: 'center',
    });
    addText(context, card.id, 'FIELD NOTE', {
      fontSize: '12px',
      lineHeight: '1.2',
      fontWeight: '700',
      fontFamily: 'Manrope',
      letterSpacing: '0.14em',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '24px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '14px',
      lineHeight: '1.55',
      fontFamily: 'Manrope',
      textColor: style.cardMuted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    paddingTop: '90px',
    paddingTopTablet: '80px',
    paddingTopMobile: '80px',
    paddingBottom: '90px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    minHeight: '681px',
    minHeightTablet: '873px',
    minHeightMobile: '1563px',
    ...backgroundProps(context, sectionName, style.ink),
  });
  const footerWrap = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '64px',
    paddingRight: '60px',
    paddingRightTablet: '30px',
    paddingRightMobile: '0px',
    paddingLeft: '60px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '0px',
  });
  const footerTop = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gap: '64px',
    responsiveStack: 'tablet',
  });
  const footerBrand = createCanvasNode(context, containerName, footerTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addHeading(context, footerBrand.id, 'CLEARWELL', 'h2', {
    fontSize: '34px',
    lineHeight: '1',
    fontWeight: '600',
    fontFamily: 'Outfit',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBrand.id, 'Calm eye care, useful explanations, and practical support for clearer days.', {
    fontSize: '15px',
    lineHeight: '1.6',
    fontFamily: 'Manrope',
    textColor: '#b6cbd2',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const footerSignup = createCanvasNode(context, containerName, footerTop.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '16px',
  });
  addHeading(context, footerSignup.id, 'Occasional notes for healthier visual routines.', 'h3', {
    fontSize: '26px',
    fontSizeMobile: '23px',
    lineHeight: '1.2',
    fontWeight: '600',
    fontFamily: 'Manrope',
    textColor: '#ffffff',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerSignup.id, 'Monthly ideas on comfort, lenses, appointments, and everyday eye habits.', {
    fontSize: '14px',
    lineHeight: '1.55',
    fontFamily: 'Manrope',
    textColor: '#b6cbd2',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, footerSignup.id, 'Join the note list', '#', {
    backgroundColor: style.accent2,
    textColor: style.ink,
    fontFamily: 'Manrope',
  });
  const footerLinks = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'three',
    gridTemplateColumnsMobile: 'one',
    gap: '36px',
  });
  for (const [title, links] of [
    ['Visit', ['Appointments', 'First visits', 'Prompt care']],
    ['Care', ['Vision reviews', 'Comfort therapy', 'Lens guidance']],
    ['Connect', ['Journal', 'Questions', 'Accessibility']],
  ]) {
    const column = createCanvasNode(context, containerName, footerLinks.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.2',
      fontWeight: '600',
      fontFamily: 'Manrope',
      textColor: '#ffffff',
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const link of links) {
      addText(context, column.id, link, {
        fontSize: '14px',
        lineHeight: '1.5',
        fontFamily: 'Manrope',
        textColor: '#b6cbd2',
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }
  const footerBottom = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '24px',
    responsiveStack: 'mobile',
  });
  addText(context, footerBottom.id, 'Clearwell Eye Care', {
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'Manrope',
    textColor: '#829aa4',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBottom.id, 'Care information for everyday use.', {
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'Manrope',
    textColor: '#829aa4',
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addCaregloHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const serviceImages = context.replacementProfile.serviceCard;
  const iconComponent = findComponent(context.contractIndex, ['IconBlock']);

  const resultSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '104px',
    paddingTopTablet: '82px',
    paddingTopMobile: '72px',
    paddingBottom: '0px',
    paddingBottomTablet: '82px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const resultPanel = createCanvasNode(context, containerName, resultSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '44px',
    gapTablet: '36px',
    gapMobile: '28px',
    paddingTop: '54px',
    paddingTopTablet: '42px',
    paddingTopMobile: '28px',
    paddingRight: '54px',
    paddingRightTablet: '42px',
    paddingRightMobile: '24px',
    paddingBottom: '54px',
    paddingBottomTablet: '42px',
    paddingBottomMobile: '28px',
    paddingLeft: '54px',
    paddingLeftTablet: '42px',
    paddingLeftMobile: '24px',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  const resultIntro = createCanvasNode(context, containerName, resultPanel.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '940px',
  });
  addText(context, resultIntro.id, '/Signature result', {
    fontSize: '17px',
    lineHeight: '1.35',
    fontWeight: '400',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, resultIntro.id, 'A finish that changes how every drive feels.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'left',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultIntro.id, 'Paint, trim, glass, and cabin surfaces leave the studio with a deliberate finish and a clear after-care plan.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.58',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'left',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const resultGrid = createCanvasNode(context, containerName, resultPanel.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'one',
    gridTemplateColumnsMobile: 'one',
    gap: '28px',
    gapTablet: '24px',
    gapMobile: '20px',
  });
  addMediaSurface(context, resultGrid.id, 'reference-media', mediaVariant(context.replacementProfile.hero, 'careglo-result-wide'), {
    gridColumnSpan: 4,
    gridColumnSpanTablet: 1,
    gridColumnSpanMobile: 1,
    width: '100%',
    minHeight: '350px',
    minHeightTablet: '360px',
    minHeightMobile: '300px',
    borderRadius: '20px',
    backgroundPosition: 'center',
  });
  const resultProof = createCanvasNode(context, containerName, resultGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '14px',
    gridColumnSpan: 2,
    gridColumnSpanTablet: 1,
    gridColumnSpanMobile: 1,
    minHeight: '350px',
    minHeightTablet: '220px',
    minHeightMobile: '637px',
    paddingTop: '24px',
    paddingRight: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    borderRadius: '20px',
    ...backgroundProps(context, containerName, style.cardBackground),
  });
  addHeading(context, resultProof.id, '12+ years', 'div', {
    fontSize: '42px',
    fontSizeMobile: '42px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultProof.id, 'of careful correction, protection, and finish-led handover experience.', {
    fontSize: '15px',
    lineHeight: '1.4',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, resultProof.id, '95%', 'div', {
    fontSize: '42px',
    fontSizeMobile: '42px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, resultProof.id, 'returning clients who reserve their next treatment before collection.', {
    fontSize: '15px',
    lineHeight: '1.4',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, resultProof.id, 'Reserve Your Detail', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '186px',
    paddingTopTablet: '129px',
    paddingTopMobile: '74px',
    paddingBottom: '38px',
    paddingBottomTablet: '37px',
    paddingBottomMobile: '74px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const whyIntro = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '48px',
    gapTablet: '30px',
    gapMobile: '20px',
    paddingBottom: '58px',
    paddingBottomTablet: '46px',
    paddingBottomMobile: '38px',
  });
  const whyHeading = createCanvasNode(context, containerName, whyIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });
  addText(context, whyHeading.id, '/Why choose us', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyHeading.id, 'Care built for drivers who notice every detail.', 'h2', {
    fontSize: '48px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, whyIntro.id, 'From material-safe interior work to measured paint correction, every treatment follows a clear plan and ends with practical guidance for the road ahead.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.65',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const whyGrid = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    gapMobile: '20px',
  });
  const reasons = [
    'Measured finish care',
    'Precision-led work',
    'Premium-grade products',
    'Specialist attention',
    'Trusted process',
    'Tailored experience',
  ];
  const reasonIcons = ['verified', 'tune', 'workspace_premium', 'person_check', 'handshake', 'auto_awesome'];
  for (const [index, reason] of reasons.entries()) {
    const card = createCanvasNode(context, containerName, whyGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: index === 0 ? 'space-between' : 'flex-end',
      gap: '18px',
      minHeight: '440px',
      minHeightTablet: '410px',
      minHeightMobile: '457px',
      paddingTop: '24px',
      paddingRight: '24px',
      paddingBottom: '24px',
      paddingLeft: '24px',
      borderRadius: '20px',
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    const iconFrame = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '52px',
      minWidth: '52px',
      minHeight: '52px',
      borderWidth: '1px',
      borderColor: style.accent,
      borderRadius: '999px',
    });
    if (iconComponent) {
      createLeafNode(context, iconComponent.name, iconFrame.id, {
        icon: reasonIcons[index],
        iconDisplay: 'inline-flex',
        size: 24,
        color: style.accent,
      });
    } else {
      addText(context, iconFrame.id, 'O', {
        fontSize: '18px',
        lineHeight: '1',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addHeading(context, card.id, reason, 'h3', {
      fontSize: '24px',
      lineHeight: '1.18',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    if (index === 0) {
      addMediaSurface(context, card.id, 'reference-media', mediaVariant(serviceImages[0], 'careglo-reason-1'), {
        width: '100%',
        minHeight: '200px',
        minHeightTablet: '200px',
        minHeightMobile: '200px',
        borderRadius: '14px',
        backgroundPosition: 'center',
      });
    }
  }

  const workSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '106px',
    paddingTopTablet: '85px',
    paddingTopMobile: '72px',
    paddingBottom: '32px',
    paddingBottomTablet: '9px',
    paddingBottomMobile: '30px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const workIntro = createCanvasNode(context, containerName, workSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '48px',
    gapMobile: '18px',
    paddingBottom: '48px',
    paddingBottomTablet: '9px',
  });
  const workHeading = createCanvasNode(context, containerName, workIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });
  addText(context, workHeading.id, '/Our work', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, workHeading.id, 'Finishes that read clearly from every angle.', 'h2', {
    fontSize: '46px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, workIntro.id, 'A recent selection of cabin, paint, trim, and protection work shaped around daily use and long-term care.', {
    fontSize: '17px',
    lineHeight: '1.6',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const workGrid = createCanvasNode(context, containerName, workSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'six',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
  });
  const workMedia = [
    context.replacementProfile.hero,
    serviceImages[0],
    serviceImages[1],
    serviceImages[2],
  ];
  for (const [index, source] of workMedia.entries()) {
    addMediaSurface(context, workGrid.id, 'reference-media', mediaVariant(source, `careglo-work-${index + 1}`), {
      gridColumnSpan: index === 0 ? 3 : 1,
      gridColumnSpanTablet: index === 0 ? 3 : 1,
      gridColumnSpanMobile: 1,
      width: '100%',
      minHeight: '550px',
      minHeightTablet: '500px',
      minHeightMobile: index === 0 ? '250px' : '70px',
      borderRadius: '18px',
      backgroundPosition: 'center',
    });
  }

  const packagesSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '80px',
    paddingTopTablet: '159px',
    paddingTopMobile: '116px',
    paddingBottom: '80px',
    paddingBottomTablet: '53px',
    paddingBottomMobile: '124px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const packagesIntro = createCanvasNode(context, containerName, packagesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '42px',
    gapTablet: '28px',
    gapMobile: '18px',
  });
  addText(context, packagesIntro.id, '/Pricing plans', {
    fontSize: '17px',
    lineHeight: '1.35',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, packagesIntro.id, 'Luxury care, tailored to you.', 'h2', {
    fontSize: '34px',
    fontSizeTablet: '32px',
    fontSizeMobile: '32px',
    lineHeight: '1.12',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, packagesIntro.id, 'Every package combines a careful inspection, precise treatment steps, and a straightforward reservation.', {
    fontSize: '17px',
    lineHeight: '1.58',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const packagesGrid = createCanvasNode(context, containerName, packagesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    paddingTop: '80px',
    paddingTopTablet: '54px',
    paddingTopMobile: '54px',
  });
  const packages = [
    ['Essential wash', '$149', 'Foam, wheels, glass, interior wipe-down, and a finish check.', ['Interior hand wash and vacuum', 'Exterior wash and glass care', 'Finish and tyre review']],
    ['Signature detail', '$329', 'Interior extraction, paint-safe correction, trim dressing, and protection.', ['Full interior deep cleaning', 'Exterior polish and protective coating', 'Guided after-care handover']],
    ['Ceramic prep', '$690', 'Decontamination, polish stage, ceramic prep, and guided after-care.', ['Complete decontamination', 'Measured correction stage', 'Ceramic surface preparation']],
  ];
  for (const [index, packageItem] of packages.entries()) {
    const [title, price, body, features] = packageItem;
    const card = createCanvasNode(context, containerName, packagesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '18px',
      gapTablet: '18px',
      gapMobile: '24px',
      gridColumnSpanTablet: index === 2 ? 2 : 1,
      gridColumnSpanMobile: 1,
      minHeight: '610px',
      minHeightTablet: '592px',
      minHeightMobile: '680px',
      paddingTop: '22px',
      paddingRight: '22px',
      paddingBottom: '28px',
      paddingLeft: '22px',
      borderRadius: geometry.radius,
      ...backgroundProps(context, containerName, style.panel),
    });
    const packageContent = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
    });
    addHeading(context, packageContent.id, title, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '24px',
      lineHeight: '1.14',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, packageContent.id, price, 'div', {
      fontSize: '46px',
      fontSizeMobile: '36px',
      lineHeight: '1',
      fontWeight: '700',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, packageContent.id, body, {
      fontSize: '16px',
      lineHeight: '1.56',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const feature of features) {
      addText(context, packageContent.id, `+ ${feature}`, {
        fontSize: '15px',
        lineHeight: '1.45',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addButton(context, card.id, 'Reserve package', '#', {
      backgroundColor: index === 1 ? style.buttonBg : style.cardBackground,
      textColor: index === 1 ? style.buttonFg : style.ink,
    });
  }

  const testimonialSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '64px',
    paddingTopTablet: '118px',
    paddingTopMobile: '68px',
    paddingBottom: '64px',
    paddingBottomTablet: '118px',
    paddingBottomMobile: '188px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const testimonialIntro = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '30px',
    gapMobile: '18px',
  });
  addText(context, testimonialIntro.id, '/Testimonials', {
    fontSize: '18px',
    lineHeight: '1.35',
    fontWeight: '400',
    textColor: style.accent,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialIntro.id, 'What our clients notice.', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '32px',
    lineHeight: '1.12',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialIntro.id, 'Measured care, clear communication, and a finish that still reads well after the drive home.', {
    fontSize: '16px',
    lineHeight: '1.58',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '30px',
    gapTablet: '24px',
    gapMobile: '20px',
    paddingTop: '46px',
  });
  const testimonialFeature = createCanvasNode(context, containerName, testimonialGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexDirectionTablet: 'row',
    flexDirectionMobile: 'column',
    gridColumnStart: 2,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 2,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    gap: '18px',
    minHeight: '422px',
    minHeightTablet: '400px',
    minHeightMobile: '632px',
    paddingTop: '16px',
    paddingRight: '16px',
    paddingBottom: '16px',
    paddingLeft: '16px',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  addMediaSurface(context, testimonialFeature.id, 'reference-media', mediaVariant(serviceImages[0], 'careglo-testimonial-1'), {
    width: '100%',
    flexBasis: '50%',
    flexGrow: 1,
    minHeight: '390px',
    minHeightTablet: '360px',
    minHeightMobile: '280px',
    borderRadius: '20px',
    backgroundPosition: 'center',
  });
  const testimonialFeatureCopy = createCanvasNode(context, containerName, testimonialFeature.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '18px',
    flexBasis: '50%',
    flexGrow: 1,
    paddingTop: '18px',
    paddingRight: '18px',
    paddingBottom: '18px',
    paddingLeft: '18px',
  });
  addMediaSurface(context, testimonialFeatureCopy.id, 'reference-media', mediaVariant(serviceImages[1], 'careglo-testimonial-4'), {
    width: '100%',
    minHeight: '120px',
    minHeightTablet: '120px',
    minHeightMobile: '120px',
    borderRadius: '16px',
    backgroundPosition: 'center',
  });
  addHeading(context, testimonialFeatureCopy.id, 'The handover made the difference.', 'h3', {
    fontSize: '26px',
    fontSizeMobile: '24px',
    lineHeight: '1.16',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, testimonialFeatureCopy.id, 'The team explained the work, the after-care, and what to watch over the next few weeks.', {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialSides = [
    [context.replacementProfile.secondary, 'careglo-testimonial-2', 'The cabin felt considered.', 'Every material kept its natural finish.', 1, 1, 2, '300px'],
    [serviceImages[2], 'careglo-testimonial-3', 'The result stayed clear.', 'Paint, trim, and glass remained balanced.', 4, 2, 3, '291px'],
  ];
  for (const [source, mediaKey, title, body, desktopColumn, tabletColumn, mobileRow, mobileHeight] of testimonialSides) {
    const testimonialSide = createCanvasNode(context, containerName, testimonialGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: '12px',
      gridColumnStart: desktopColumn,
      gridColumnStartTablet: tabletColumn,
      gridColumnStartMobile: 1,
      gridColumnSpan: 1,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      gridRowStart: 1,
      gridRowStartTablet: 2,
      gridRowStartMobile: mobileRow,
      minHeight: '422px',
      minHeightTablet: '300px',
      minHeightMobile: mobileHeight,
      paddingTop: '24px',
      paddingRight: '24px',
      paddingBottom: '24px',
      paddingLeft: '24px',
      borderRadius: geometry.radius,
      backgroundImage: mediaVariant(source, mediaKey),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundOverlay: 'rgba(4, 7, 12, 0.48)',
    });
    addHeading(context, testimonialSide.id, title, 'h3', {
      fontSize: '24px',
      lineHeight: '1.18',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, testimonialSide.id, body, {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const partnerSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '88px',
    paddingTopTablet: '72px',
    paddingTopMobile: '80px',
    paddingBottom: '88px',
    paddingBottomTablet: '72px',
    paddingBottomMobile: '80px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const partnerPanel = createCanvasNode(context, containerName, partnerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '348px',
    minHeightTablet: '440px',
    minHeightMobile: '585px',
    paddingTop: '58px',
    paddingTopTablet: '50px',
    paddingTopMobile: '48px',
    paddingRight: '58px',
    paddingRightTablet: '50px',
    paddingRightMobile: '28px',
    paddingBottom: '58px',
    paddingBottomTablet: '50px',
    paddingBottomMobile: '48px',
    paddingLeft: '58px',
    paddingLeftTablet: '50px',
    paddingLeftMobile: '28px',
    borderWidth: '1px',
    borderColor: 'rgba(255, 247, 234, 0.12)',
    borderRadius: geometry.radius,
    ...backgroundProps(context, containerName, style.panel),
  });
  const partnerIntro = createCanvasNode(context, containerName, partnerPanel.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '920px',
    paddingBottom: '48px',
    paddingBottomTablet: '48px',
    paddingBottomMobile: '48px',
  });
  addHeading(context, partnerIntro.id, 'Trusted partners in finish care', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '28px',
    lineHeight: '1.15',
    fontWeight: '600',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'center',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, partnerIntro.id, 'Products, tools, and specialist support selected around repeatable quality and durable results.', {
    fontSize: '18px',
    fontSizeMobile: '16px',
    lineHeight: '1.6',
    textAlign: 'center',
    textAlignTablet: 'center',
    textAlignMobile: 'center',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const partnerWrap = createCanvasNode(context, containerName, partnerPanel.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'six',
    gridTemplateColumnsTablet: 'three',
    gridTemplateColumnsMobile: 'two',
    alignItems: 'center',
    gap: '34px',
    gapTablet: '26px',
    gapMobile: '22px',
  });
  for (const label of ['VANTAGE', 'CERAVUE', 'FORME', 'MOTIVE', 'LUSTER']) {
    addText(context, partnerWrap.id, label, {
      fontSize: '24px',
      fontSizeTablet: '20px',
      fontSizeMobile: '17px',
      lineHeight: '1',
      fontWeight: '700',
      letterSpacing: '0.12em',
      textAlign: 'center',
      textAlignTablet: 'center',
      textAlignMobile: 'center',
      textColor: 'rgba(255, 247, 234, 0.38)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    minHeight: '694px',
    minHeightTablet: '839px',
    minHeightMobile: '1580px',
    paddingTop: '92px',
    paddingTopTablet: '112px',
    paddingTopMobile: '68px',
    paddingBottom: '44px',
    paddingBottomTablet: '40px',
    paddingBottomMobile: '36px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.panel),
  });
  const footerGrid = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '52px',
    gapTablet: '42px',
    gapMobile: '36px',
  });
  const footerBrand = createCanvasNode(context, containerName, footerGrid.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addHeading(context, footerBrand.id, 'Aureline', 'h2', {
    fontSize: '32px',
    lineHeight: '1',
    fontWeight: '700',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBrand.id, 'Finish-led vehicle care with clear booking, careful handover, and practical after-care.', {
    fontSize: '16px',
    lineHeight: '1.65',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, footerBrand.id, 'Reserve a Visit', '#', {
    backgroundColor: style.buttonBg,
    textColor: style.buttonFg,
  });
  const footerColumns = [
    ['Explore', ['Treatments', 'Results', 'Care guide']],
    ['Studio', ['Our process', 'Appointments', 'After-care']],
    ['Contact', ['+1 415 555 0148', 'hello@aureline.studio', 'Mon-Sat, 8:00-18:00']],
  ];
  for (const [title, items] of footerColumns) {
    const column = createCanvasNode(context, containerName, footerGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.25',
      fontWeight: '600',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '4px',
    });
    for (const item of items) {
      addText(context, column.id, item, {
        fontSize: '15px',
        lineHeight: '1.5',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }
  const footerBottom = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexDirectionMobile: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignItemsMobile: 'flex-start',
    gap: '20px',
    paddingTop: '68px',
    paddingTopTablet: '56px',
    paddingTopMobile: '48px',
  });
  addText(context, footerBottom.id, 'Aureline vehicle care', {
    fontSize: '13px',
    lineHeight: '1.45',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerBottom.id, 'Privacy  |  Terms  |  Accessibility', {
    fontSize: '13px',
    lineHeight: '1.45',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addMaidyHomepageDepthSections(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const serviceImages = context.replacementProfile.serviceCard;
  const panelColor = maidyPanelColor(context);
  const highlightColor = maidyHighlightColor(context);
  const paleColor = '#f3f4f1';
  const white = '#ffffff';
  const cleanerSource = maidyHeroCutoutSource() || context.replacementProfile.hero;
  const configuredEquipmentSource = String(process.env.MONTEBY_MAIDY_EQUIPMENT_CUTOUT_URL || '').trim();
  const equipmentSource = /^https?:\/\//i.test(configuredEquipmentSource) && isTransparentCutoutSource(configuredEquipmentSource)
    ? configuredEquipmentSource
    : context.replacementProfile.equipment || context.replacementProfile.secondary;
  const teamImages = [
    context.replacementProfile.hero,
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=82',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=720&q=82',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=720&q=82',
  ];

  const aboutSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '904px',
    minHeightTablet: '967px',
    paddingTop: '100px',
    paddingTopTablet: '82px',
    paddingTopMobile: '64px',
    paddingBottom: '100px',
    paddingBottomTablet: '82px',
    paddingBottomMobile: '64px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const aboutWrap = createCanvasNode(context, containerName, aboutSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '56px',
    gapTablet: '34px',
    gapMobile: '40px',
    alignItems: 'stretch',
    responsiveStack: 'mobile',
  });
  const aboutMediaFrame = createCanvasNode(context, containerName, aboutWrap.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'one',
    gridTemplateColumnsTablet: 'one',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    minHeight: '704px',
    minHeightTablet: '760px',
    minHeightMobile: '430px',
    ...backgroundProps(context, containerName, highlightColor),
  });
  addMediaSurface(context, aboutMediaFrame.id, 'reference-media', mediaVariant(cleanerSource, 'maidy-about-cleaner'), {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '100%',
    minHeight: '704px',
    minHeightTablet: '760px',
    minHeightMobile: '430px',
    borderRadius: '0px',
    backgroundSize: isTransparentCutoutSource(cleanerSource) ? 'contain' : 'cover',
    backgroundPosition: isTransparentCutoutSource(cleanerSource) ? 'bottom' : 'center',
    backgroundRepeat: 'no-repeat',
  });
  const aboutProofPosition = createCanvasNode(context, containerName, aboutMediaFrame.id, {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '240px',
    maxWidthMobile: '210px',
    paddingTop: '520px',
    paddingTopTablet: '570px',
    paddingTopMobile: '292px',
    paddingLeft: '26px',
    paddingLeftTablet: '24px',
    paddingLeftMobile: '18px',
  });
  const aboutProof = createCanvasNode(context, containerName, aboutProofPosition.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '20px',
    paddingRight: '20px',
    paddingBottom: '20px',
    paddingLeft: '20px',
    ...backgroundProps(context, containerName, white),
    boxShadow: 'shadow-md',
  });
  addText(context, aboutProof.id, 'CAREFUL HANDOVER', {
    fontSize: '11px',
    lineHeight: '1.3',
    fontWeight: '800',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, aboutProof.id, 'Every visit closes with a room-by-room check.', {
    fontSize: '14px',
    lineHeight: '1.45',
    fontWeight: '600',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const aboutCopy = createCanvasNode(context, containerName, aboutWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    paddingTop: '56px',
    paddingTopTablet: '34px',
    paddingTopMobile: '0px',
    paddingRight: '20px',
    paddingRightTablet: '0px',
    paddingRightMobile: '0px',
    paddingBottom: '56px',
    paddingBottomTablet: '34px',
    paddingBottomMobile: '0px',
    paddingLeft: '20px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, aboutCopy.id, 'ABOUT TIDYRA', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, aboutCopy.id, 'A clear routine for a home that feels lighter.', 'h2', {
    fontSize: '52px',
    fontSizeTablet: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, aboutCopy.id, 'Friendly crews arrive prepared, follow the priorities you set, and leave every room ready for the rest of your week.', {
    fontSize: '17px',
    lineHeight: '1.68',
    fontWeight: '400',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const aboutStats = createCanvasNode(context, containerName, aboutCopy.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '16px',
    gapTablet: '14px',
    gapMobile: '12px',
    width: '100%',
    responsiveStack: 'mobile',
  });
  for (const [value, label] of [['12+', 'Care teams'], ['4.9', 'Average visit rating']]) {
    const stat = createCanvasNode(context, containerName, aboutStats.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '18px',
      paddingLeft: '18px',
      borderWidth: '1px',
      borderColor: '#e1e3df',
      ...backgroundProps(context, containerName, white),
    });
    addHeading(context, stat.id, value, 'div', {
      fontSize: '36px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, stat.id, label, {
      fontSize: '14px',
      lineHeight: '1.4',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addButton(context, aboutCopy.id, 'Meet our approach', '#', {
    paddingTop: '15px',
    paddingRight: '28px',
    paddingBottom: '15px',
    paddingLeft: '28px',
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });

  const servicesSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '970px',
    minHeightTablet: '1228px',
    paddingTop: '108px',
    paddingTopTablet: '92px',
    paddingTopMobile: '70px',
    paddingBottom: '112px',
    paddingBottomTablet: '96px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const servicesIntro = createCanvasNode(context, containerName, servicesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '52px',
    gapTablet: '30px',
    gapMobile: '20px',
    alignItems: 'flex-end',
    responsiveStack: 'mobile',
  });
  const servicesTitle = createCanvasNode(context, containerName, servicesIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });
  addText(context, servicesTitle.id, 'SERVICES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, servicesTitle.id, 'Focused care for the spaces you use every day.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const servicesLead = createCanvasNode(context, containerName, servicesIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, servicesLead.id, 'Choose one visit or build a steady routine around the rooms, surfaces, and timing that matter most.', {
    fontSize: '17px',
    lineHeight: '1.64',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, servicesLead.id, 'View all services', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const servicesGrid = createCanvasNode(context, containerName, servicesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    paddingTop: '62px',
    paddingTopTablet: '54px',
    paddingTopMobile: '42px',
    responsiveStack: 'mobile',
  });
  const services = [
    ['01', 'Home refresh', 'Recurring room care for kitchens, baths, living areas, and weekly reset zones.'],
    ['02', 'Workplace upkeep', 'Quiet, scheduled cleaning for desks, shared spaces, entries, and meeting rooms.'],
    ['03', 'Deep reset', 'Detailed attention for high-touch surfaces, overlooked corners, and seasonal care.'],
    ['04', 'Move support', 'A clear cleaning scope for arrivals, departures, handovers, and fresh starts.'],
  ];
  for (const [number, title, body] of services) {
    const card = createCanvasNode(context, containerName, servicesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '24px',
      minHeight: '320px',
      minHeightTablet: '330px',
      minHeightMobile: '280px',
      paddingTop: '30px',
      paddingRight: '26px',
      paddingBottom: '30px',
      paddingLeft: '26px',
      borderWidth: '1px',
      borderColor: '#e7e9e5',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    addText(context, card.id, number, {
      display: 'inline-block',
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      backgroundColor: highlightColor,
      paddingY: '10px',
      paddingX: '11px',
      borderRadius: '999px',
      marginTop: '0px',
      marginBottom: '0px',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    addHeading(context, cardCopy.id, title, 'h3', {
      fontSize: '25px',
      fontSizeMobile: '23px',
      lineHeight: '1.18',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, body, {
      fontSize: '15px',
      lineHeight: '1.58',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const processSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '608px',
    minHeightTablet: '789px',
    paddingTop: '88px',
    paddingTopTablet: '76px',
    paddingTopMobile: '64px',
    paddingBottom: '92px',
    paddingBottomTablet: '78px',
    paddingBottomMobile: '68px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, panelColor),
  });
  const processIntro = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '30px',
    gapMobile: '18px',
    responsiveStack: 'mobile',
  });
  const processTitle = createCanvasNode(context, containerName, processIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, processTitle.id, 'OUR PROCESS', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: 'rgba(255, 255, 255, 0.62)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, processTitle.id, 'Four clear steps from booking to handover.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '39px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, processIntro.id, 'From booking through the final check, every visit follows a calm routine with clear expectations.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: 'rgba(255, 255, 255, 0.72)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const processGrid = createCanvasNode(context, containerName, processSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '20px',
    gapMobile: '14px',
    responsiveStack: 'mobile',
    paddingTop: '48px',
    paddingTopTablet: '42px',
    paddingTopMobile: '36px',
  });
  for (const [number, title, body] of [
    ['01', 'Share priorities', 'Tell us which rooms need attention and what a good result looks like.'],
    ['02', 'Choose a time', 'Pick a practical visit window and confirm the scope before arrival.'],
    ['03', 'Welcome the crew', 'A prepared team follows the agreed route with the right equipment.'],
    ['04', 'Review the rooms', 'Walk through the finished spaces and close the visit with confidence.'],
  ]) {
    const card = createCanvasNode(context, containerName, processGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '250px',
      minHeightTablet: '240px',
      minHeightMobile: '220px',
      paddingTop: '26px',
      paddingRight: '24px',
      paddingBottom: '26px',
      paddingLeft: '24px',
      borderWidth: '1px',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      ...backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.06)'),
    });
    addText(context, card.id, number, {
      display: 'inline-block',
      fontSize: '14px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      backgroundColor: highlightColor,
      paddingY: '12px',
      paddingX: '12px',
      borderRadius: '999px',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, card.id, title, 'h3', {
      fontSize: '23px',
      fontSizeMobile: '22px',
      lineHeight: '1.18',
      fontWeight: '800',
      textColor: white,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, body, {
      fontSize: '15px',
      lineHeight: '1.56',
      textColor: 'rgba(255, 255, 255, 0.68)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const equipmentSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '806px',
    minHeightTablet: '1298px',
    paddingTop: '88px',
    paddingTopTablet: '84px',
    paddingTopMobile: '66px',
    paddingBottom: '92px',
    paddingBottomTablet: '88px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, panelColor),
  });
  const equipmentIntro = createCanvasNode(context, containerName, equipmentSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '30px',
    gapMobile: '18px',
    responsiveStack: 'mobile',
  });
  const equipmentTitle = createCanvasNode(context, containerName, equipmentIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, equipmentTitle.id, 'OUR EQUIPMENT', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: 'rgba(255, 255, 255, 0.62)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, equipmentTitle.id, 'Prepared tools for floors, fabrics, edges, and air.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '39px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const equipmentLead = createCanvasNode(context, containerName, equipmentIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, equipmentLead.id, 'Each visit is matched with practical equipment so the crew can work carefully without slowing the day down.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: 'rgba(255, 255, 255, 0.72)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, equipmentLead.id, 'See the toolkit', '#', {
    borderRadius: '0px',
    backgroundColor: highlightColor,
    textColor: panelColor,
  });
  const equipmentGrid = createCanvasNode(context, containerName, equipmentSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '22px',
    gapMobile: '16px',
    paddingTop: '48px',
    paddingTopTablet: '46px',
    paddingTopMobile: '38px',
    responsiveStack: 'mobile',
  });
  const equipmentItems = [
    [equipmentSource, 'Compact floor unit', 'Agile care for daily floor routes and tighter rooms.'],
    [context.replacementProfile.secondary, 'Surface care kit', 'Prepared attachments for edges, textiles, and detail work.'],
    [serviceImages[1] || serviceImages[0], 'Quiet room system', 'Lower-noise tools for homes, studios, and workplaces.'],
    [serviceImages[2] || serviceImages[0], 'Deep reset set', 'Focused equipment for periodic and move-ready cleaning.'],
  ];
  for (const [index, item] of equipmentItems.entries()) {
    const [source, title, body] = item;
    const card = createCanvasNode(context, containerName, equipmentGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '370px',
      minHeightTablet: '420px',
      minHeightMobile: '350px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '24px',
      paddingLeft: '18px',
      ...backgroundProps(context, containerName, 'rgba(255, 255, 255, 0.06)'),
    });
    addMediaSurface(context, card.id, 'service-card', mediaVariant(source, `maidy-equipment-${index + 1}`), {
      width: '100%',
      minHeight: '230px',
      minHeightTablet: '280px',
      minHeightMobile: '240px',
      borderRadius: '0px',
      backgroundSize: isTransparentCutoutSource(source) ? 'contain' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
    addHeading(context, cardCopy.id, title, 'h3', {
      fontSize: '21px',
      fontSizeMobile: '21px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: white,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, body, {
      fontSize: '14px',
      lineHeight: '1.5',
      textColor: 'rgba(255, 255, 255, 0.66)',
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const whySection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '1012px',
    minHeightTablet: '1121px',
    paddingTop: '110px',
    paddingTopTablet: '90px',
    paddingTopMobile: '70px',
    paddingBottom: '112px',
    paddingBottomTablet: '92px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const whyWrap = createCanvasNode(context, containerName, whySection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '60px',
    gapTablet: '34px',
    gapMobile: '42px',
    alignItems: 'stretch',
    responsiveStack: 'mobile',
  });
  addMediaSurface(context, whyWrap.id, 'reference-media', mediaVariant(context.replacementProfile.hero, 'maidy-why-cleaner'), {
    width: '100%',
    minHeight: '760px',
    minHeightTablet: '860px',
    minHeightMobile: '440px',
    borderRadius: '0px',
    backgroundPosition: 'top',
  });
  const whyCopy = createCanvasNode(context, containerName, whyWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '22px',
    paddingTop: '42px',
    paddingTopTablet: '30px',
    paddingTopMobile: '0px',
    paddingRight: '12px',
    paddingRightTablet: '0px',
    paddingRightMobile: '0px',
    paddingBottom: '42px',
    paddingBottomTablet: '30px',
    paddingBottomMobile: '0px',
    paddingLeft: '12px',
    paddingLeftTablet: '0px',
    paddingLeftMobile: '0px',
  });
  addText(context, whyCopy.id, 'WHY TIDYRA', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, whyCopy.id, 'Reliable care built around your rooms and routines.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, whyCopy.id, 'Clear arrival windows, prepared crews, and visible checks make each visit easier to plan and easier to trust.', {
    fontSize: '17px',
    lineHeight: '1.64',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const benefitsGrid = createCanvasNode(context, containerName, whyCopy.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '14px',
    gapTablet: '12px',
    gapMobile: '10px',
    width: '100%',
    responsiveStack: 'mobile',
  });
  for (const [number, title, body] of [
    ['01', 'Prepared crews', 'The right supplies and a room plan arrive with the team.'],
    ['02', 'Clear timing', 'Arrival windows and visit scope stay easy to understand.'],
    ['03', 'Careful details', 'High-touch surfaces and finishing checks are never rushed.'],
    ['04', 'Practical follow-up', 'Questions after the visit have a simple response path.'],
  ]) {
    const benefit = createCanvasNode(context, containerName, benefitsGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '9px',
      minHeight: '170px',
      paddingTop: '20px',
      paddingRight: '18px',
      paddingBottom: '20px',
      paddingLeft: '18px',
      ...backgroundProps(context, containerName, paleColor),
    });
    addText(context, benefit.id, number, {
      fontSize: '12px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, benefit.id, title, 'h3', {
      fontSize: '20px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, benefit.id, body, {
      fontSize: '14px',
      lineHeight: '1.5',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }
  addButton(context, whyCopy.id, 'Plan a visit', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });

  const pricingSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '974px',
    minHeightTablet: '1996px',
    paddingTop: '100px',
    paddingTopTablet: '90px',
    paddingTopMobile: '70px',
    paddingBottom: '104px',
    paddingBottomTablet: '94px',
    paddingBottomMobile: '74px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, paleColor),
  });
  const pricingIntro = createCanvasNode(context, containerName, pricingSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '44px',
    gapTablet: '28px',
    gapMobile: '18px',
    alignItems: 'flex-end',
    responsiveStack: 'mobile',
  });
  const pricingTitle = createCanvasNode(context, containerName, pricingIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, pricingTitle.id, 'PRICING', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, pricingTitle.id, 'Choose a plan that fits the pace of your space.', 'h2', {
    fontSize: '50px',
    fontSizeTablet: '40px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const pricingLead = createCanvasNode(context, containerName, pricingIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '20px',
  });
  addText(context, pricingLead.id, 'Start with a focused reset or keep a dependable routine. Every plan begins with a confirmed room list.', {
    fontSize: '17px',
    lineHeight: '1.62',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, pricingLead.id, 'Compare plans', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const pricingGrid = createCanvasNode(context, containerName, pricingSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '24px',
    gapTablet: '24px',
    gapMobile: '16px',
    paddingTop: '52px',
    paddingTopTablet: '48px',
    paddingTopMobile: '40px',
    responsiveStack: 'mobile',
  });
  const plans = [
    ['Essentials', '$140', 'A focused visit for the rooms that carry the week.', ['Up to three rooms', 'Kitchen or bath focus', 'Final room check']],
    ['Routine', '$220', 'Steady home care with a repeatable room-by-room plan.', ['Whole-home route', 'Priority surface care', 'Flexible visit cadence']],
    ['Deep Reset', '$360', 'Extra time for detail work, transitions, and seasonal care.', ['Extended room list', 'Detail equipment set', 'Handover checklist']],
  ];
  for (const [index, plan] of plans.entries()) {
    const [title, price, body, features] = plan;
    const highlighted = index === 1;
    const planCard = createCanvasNode(context, containerName, pricingGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '28px',
      minHeight: '590px',
      minHeightTablet: '760px',
      minHeightMobile: '620px',
      paddingTop: '40px',
      paddingRight: '34px',
      paddingBottom: '40px',
      paddingLeft: '34px',
      borderWidth: highlighted ? '0px' : '1px',
      borderColor: '#e2e4e0',
      ...backgroundProps(context, containerName, highlighted ? panelColor : white),
      boxShadow: highlighted ? 'shadow-lg' : 'shadow-sm',
    });
    const planCopy = createCanvasNode(context, containerName, planCard.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
    });
    addText(context, planCopy.id, highlighted ? 'MOST POPULAR' : 'CLEANING PLAN', {
      fontSize: '11px',
      lineHeight: '1.3',
      fontWeight: '800',
      letterSpacing: '0.14em',
      textColor: highlighted ? highlightColor : panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, planCopy.id, title, 'h3', {
      fontSize: '30px',
      fontSizeMobile: '27px',
      lineHeight: '1.15',
      fontWeight: '800',
      textColor: highlighted ? white : style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, planCopy.id, price, 'div', {
      fontSize: '48px',
      fontSizeMobile: '42px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: highlighted ? white : style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, planCopy.id, body, {
      fontSize: '15px',
      lineHeight: '1.58',
      textColor: highlighted ? 'rgba(255, 255, 255, 0.72)' : style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const featureList = createCanvasNode(context, containerName, planCard.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    for (const feature of features) {
      addText(context, featureList.id, `Included: ${feature}`, {
        fontSize: '14px',
        lineHeight: '1.45',
        textColor: highlighted ? 'rgba(255, 255, 255, 0.82)' : style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
    addButton(context, planCard.id, highlighted ? 'Choose routine' : 'Choose plan', '#', {
      alignment: 'stretch',
      buttonDisplay: 'flex',
      borderRadius: '0px',
      backgroundColor: highlighted ? highlightColor : panelColor,
      textColor: highlighted ? panelColor : white,
    });
  }

  const testimonialsSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '757px',
    minHeightTablet: '688px',
    paddingTop: '96px',
    paddingTopTablet: '76px',
    paddingTopMobile: '66px',
    paddingBottom: '100px',
    paddingBottomTablet: '80px',
    paddingBottomMobile: '70px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, paleColor),
  });
  const testimonialsIntro = createCanvasNode(context, containerName, testimonialsSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '720px',
  });
  addText(context, testimonialsIntro.id, 'CLIENT NOTES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, testimonialsIntro.id, 'Small details that make the whole visit feel easier.', 'h2', {
    fontSize: '46px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    lineHeightTablet: '1.12',
    lineHeightMobile: '1.14',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const testimonialGrid = createCanvasNode(context, containerName, testimonialsSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '20px',
    gapTablet: '18px',
    gapMobile: '14px',
    paddingTop: '46px',
    paddingTopTablet: '40px',
    paddingTopMobile: '34px',
    responsiveStack: 'mobile',
  });
  const testimonials = [
    ['The crew arrived ready and left the kitchen feeling calm without disrupting the afternoon.', 'Rina Cole', 'Weekly home care'],
    ['The room list was clear, the timing was accurate, and every question had a practical answer.', 'Marcus Bell', 'Apartment reset'],
    ['Our office feels consistently looked after, especially the shared areas that used to get missed.', 'Talia Reed', 'Workplace upkeep'],
    ['The final walk-through made the result easy to see and the next visit easy to plan.', 'Evan Shaw', 'Seasonal deep clean'],
  ];
  for (const [index, testimonial] of testimonials.entries()) {
    const [quote, author, role] = testimonial;
    const card = createCanvasNode(context, containerName, testimonialGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '24px',
      minHeight: '330px',
      minHeightTablet: '210px',
      minHeightMobile: '270px',
      paddingTop: '28px',
      paddingRight: '24px',
      paddingBottom: '28px',
      paddingLeft: '24px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    const quoteCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
    });
    addText(context, quoteCopy.id, '5 / 5', {
      fontSize: '13px',
      lineHeight: '1',
      fontWeight: '800',
      textColor: '#c89200',
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, quoteCopy.id, quote, {
      fontSize: '16px',
      lineHeight: '1.62',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const authorRow = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12px',
    });
    addMediaSurface(context, authorRow.id, 'reference-media', mediaVariant(teamImages[index], `maidy-testimonial-${index + 1}`), {
      width: '52px',
      minHeight: '52px',
      minHeightTablet: '52px',
      minHeightMobile: '52px',
      borderRadius: '999px',
      backgroundPosition: 'top',
    });
    const authorCopy = createCanvasNode(context, containerName, authorRow.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '3px',
    });
    addHeading(context, authorCopy.id, author, 'h3', {
      fontSize: '16px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, authorCopy.id, role, {
      fontSize: '12px',
      lineHeight: '1.35',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const teamSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '845px',
    minHeightTablet: '1380px',
    paddingTop: '0px',
    paddingBottom: '96px',
    paddingBottomTablet: '90px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const teamStage = createCanvasNode(context, containerName, teamSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-start',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    responsiveStack: 'mobile',
  });
  createCanvasNode(context, containerName, teamStage.id, {
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 4,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    width: '100%',
    minHeight: '350px',
    minHeightTablet: '350px',
    minHeightMobile: '330px',
    ...backgroundProps(context, containerName, highlightColor),
  });
  const teamIntro = createCanvasNode(context, containerName, teamStage.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'flex-end',
    gap: '44px',
    gapTablet: '28px',
    gapMobile: '16px',
    gridColumnStart: 1,
    gridColumnStartTablet: 1,
    gridColumnStartMobile: 1,
    gridColumnSpan: 4,
    gridColumnSpanTablet: 2,
    gridColumnSpanMobile: 1,
    gridRowStart: 1,
    gridRowStartTablet: 1,
    gridRowStartMobile: 1,
    paddingTop: '70px',
    paddingTopTablet: '64px',
    paddingTopMobile: '54px',
    paddingRight: '42px',
    paddingRightTablet: '30px',
    paddingRightMobile: '20px',
    paddingLeft: '42px',
    paddingLeftTablet: '30px',
    paddingLeftMobile: '20px',
    responsiveStack: 'mobile',
  });
  const teamTitle = createCanvasNode(context, containerName, teamIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, teamTitle.id, 'OUR TEAM', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, teamTitle.id, 'People who bring calm, care, and consistency.', 'h2', {
    fontSize: '48px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    lineHeightTablet: '1.1',
    lineHeightMobile: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const teamLead = createCanvasNode(context, containerName, teamIntro.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '18px',
  });
  addText(context, teamLead.id, 'Every crew member follows the same clear visit plan while bringing thoughtful attention to each room.', {
    fontSize: '17px',
    lineHeight: '1.58',
    textColor: '#4c554f',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, teamLead.id, 'Meet the crew', '#', {
    borderRadius: '0px',
    backgroundColor: panelColor,
    textColor: white,
  });
  const teamMembers = [
    ['Lena Brooks', 'Home care lead'],
    ['Tessa Morgan', 'Detail specialist'],
    ['Nia Foster', 'Workplace lead'],
    ['Avery Cole', 'Visit coordinator'],
  ];
  for (const [index, member] of teamMembers.entries()) {
    const desktopColumn = index + 1;
    const tabletColumn = (index % 2) + 1;
    const tabletRow = Math.floor(index / 2) + 1;
    const mobileRow = index + 1;
    const cardPosition = createCanvasNode(context, containerName, teamStage.id, {
      gridColumnStart: desktopColumn,
      gridColumnStartTablet: tabletColumn,
      gridColumnStartMobile: 1,
      gridRowStart: 1,
      gridRowStartTablet: tabletRow,
      gridRowStartMobile: mobileRow,
      paddingTop: '262px',
      paddingTopTablet: index < 2 ? '262px' : '0px',
      paddingTopMobile: index === 0 ? '250px' : '0px',
    });
    const card = createCanvasNode(context, containerName, cardPosition.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '420px',
      minHeightTablet: '470px',
      minHeightMobile: '430px',
      paddingBottom: '24px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-md',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(teamImages[index], `maidy-team-${index + 1}`), {
      width: '100%',
      minHeight: '285px',
      minHeightTablet: '330px',
      minHeightMobile: '300px',
      borderRadius: '0px',
      backgroundPosition: 'top',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingRight: '20px',
      paddingLeft: '20px',
    });
    addHeading(context, cardCopy.id, member[0], 'h3', {
      fontSize: '22px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, member[1], {
      fontSize: '14px',
      lineHeight: '1.45',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const articlesSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '824px',
    minHeightTablet: '1191px',
    paddingTop: '96px',
    paddingTopTablet: '84px',
    paddingTopMobile: '66px',
    paddingBottom: '102px',
    paddingBottomTablet: '88px',
    paddingBottomMobile: '72px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const articlesIntro = createCanvasNode(context, containerName, articlesSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '720px',
  });
  addText(context, articlesIntro.id, 'ROOM NOTES', {
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: panelColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, articlesIntro.id, 'Practical reading for a calmer weekly reset.', 'h2', {
    fontSize: '46px',
    fontSizeTablet: '38px',
    fontSizeMobile: '34px',
    lineHeight: '1.1',
    lineHeightTablet: '1.12',
    lineHeightMobile: '1.14',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  const articlesGrid = createCanvasNode(context, containerName, articlesSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '22px',
    gapTablet: '22px',
    gapMobile: '16px',
    responsiveStack: 'mobile',
    paddingTop: '46px',
    paddingTopTablet: '42px',
    paddingTopMobile: '34px',
  });
  const articles = [
    ['A ten-minute closing routine', 'Small room-by-room habits that make the next morning feel lighter.'],
    ['Preparing for a focused visit', 'A short checklist that helps the crew spend more time on the work that matters.'],
    ['A practical guide to shared surfaces', 'Simple care for kitchens, handles, switches, desks, and busy family spaces.'],
  ];
  for (const [index, article] of articles.entries()) {
    const card = createCanvasNode(context, containerName, articlesGrid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minHeight: '420px',
      minHeightTablet: '430px',
      minHeightMobile: '390px',
      paddingBottom: '26px',
      ...backgroundProps(context, containerName, white),
      boxShadow: 'shadow-sm',
    });
    addMediaSurface(context, card.id, 'reference-media', mediaVariant(serviceImages[(index + 1) % serviceImages.length], `maidy-article-${index + 1}`), {
      width: '100%',
      minHeight: '235px',
      minHeightTablet: '245px',
      minHeightMobile: '220px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const cardCopy = createCanvasNode(context, containerName, card.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingRight: '24px',
      paddingLeft: '24px',
    });
    addText(context, cardCopy.id, 'HOME ROUTINES', {
      fontSize: '11px',
      lineHeight: '1.3',
      fontWeight: '800',
      letterSpacing: '0.12em',
      textColor: panelColor,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, cardCopy.id, article[0], 'h3', {
      fontSize: '23px',
      lineHeight: '1.2',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, cardCopy.id, article[1], {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
  }

  const newsletterSection = createCanvasNode(context, sectionName, 'ROOT', {
    minHeight: '351px',
    minHeightTablet: '341px',
    paddingTop: '0px',
    paddingBottom: '0px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const newsletterWrap = createCanvasNode(context, containerName, newsletterSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'two',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    alignItems: 'center',
    gap: '46px',
    gapTablet: '30px',
    gapMobile: '24px',
    minHeight: '351px',
    minHeightTablet: '341px',
    minHeightMobile: '430px',
    paddingTop: '58px',
    paddingTopTablet: '50px',
    paddingTopMobile: '44px',
    paddingRight: '58px',
    paddingRightTablet: '40px',
    paddingRightMobile: '24px',
    paddingBottom: '58px',
    paddingBottomTablet: '50px',
    paddingBottomMobile: '44px',
    paddingLeft: '58px',
    paddingLeftTablet: '40px',
    paddingLeftMobile: '24px',
    responsiveStack: 'mobile',
    ...backgroundProps(context, containerName, panelColor),
  });
  const newsletterCopy = createCanvasNode(context, containerName, newsletterWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  addText(context, newsletterCopy.id, 'ROOM LETTER', {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '800',
    letterSpacing: '0.18em',
    textColor: highlightColor,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addHeading(context, newsletterCopy.id, 'A useful note for a tidier week.', 'h2', {
    fontSize: '36px',
    fontSizeTablet: '30px',
    fontSizeMobile: '29px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: white,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, newsletterCopy.id, 'Occasional room-care ideas, visit preparation tips, and seasonal reminders.', {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  const newsletterForm = createCanvasNode(context, containerName, newsletterWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '10px',
    responsiveStack: 'mobile',
  });
  const emailField = createCanvasNode(context, containerName, newsletterForm.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    flexGrow: 1,
    minHeight: '54px',
    paddingRight: '18px',
    paddingLeft: '18px',
    ...backgroundProps(context, containerName, white),
  });
  addText(context, emailField.id, 'Email address', {
    fontSize: '14px',
    lineHeight: '1.4',
    textColor: '#747a76',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addButton(context, newsletterForm.id, 'Subscribe', '#', {
    borderRadius: '0px',
    paddingTop: '18px',
    paddingRight: '24px',
    paddingBottom: '18px',
    paddingLeft: '24px',
    backgroundColor: highlightColor,
    textColor: panelColor,
  });

  const footerSection = createCanvasNode(context, sectionName, 'ROOT', {
    tag: 'footer',
    paddingTop: '92px',
    paddingTopTablet: '76px',
    paddingTopMobile: '66px',
    paddingBottom: '76px',
    paddingBottomTablet: '70px',
    paddingBottomMobile: '64px',
    minHeight: '415px',
    minHeightTablet: '603px',
    minHeightMobile: '760px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, white),
  });
  const footerWrap = createCanvasNode(context, containerName, footerSection.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'four',
    gridTemplateColumnsTablet: 'two',
    gridTemplateColumnsMobile: 'one',
    gap: '44px',
    gapTablet: '34px',
    gapMobile: '30px',
    responsiveStack: 'mobile',
  });
  const footerLead = createCanvasNode(context, containerName, footerWrap.id, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '18px',
  });
  addHeading(context, footerLead.id, 'Tidyra', 'h2', {
    fontSize: '34px',
    fontSizeMobile: '30px',
    lineHeight: '1.12',
    fontWeight: '800',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, footerLead.id, 'Prepared crews, clear room plans, and a dependable path from booking to final check.', {
    fontSize: '16px',
    lineHeight: '1.6',
    textColor: style.muted,
    marginTop: '0px',
    marginBottom: '0px',
  });
  for (const [title, links] of [
    ['Services', ['Home refresh', 'Workplace upkeep', 'Deep reset']],
    ['Company', ['Our approach', 'The crew', 'Room notes']],
    ['Contact', ['+1 (415) 555-0148', context.replacementProfile.email]],
  ]) {
    const column = createCanvasNode(context, containerName, footerWrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });
    addHeading(context, column.id, title, 'h3', {
      fontSize: '18px',
      lineHeight: '1.3',
      fontWeight: '800',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    for (const link of links) {
      addText(context, column.id, link, {
        fontSize: '15px',
        lineHeight: '1.5',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
    }
  }

  const copyrightSection = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '18px',
    paddingTopTablet: '20px',
    paddingTopMobile: '24px',
    paddingBottom: '18px',
    paddingBottomTablet: '20px',
    paddingBottomMobile: '24px',
    minHeight: '57px',
    minHeightTablet: '67px',
    minHeightMobile: '96px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const copyrightWrap = createCanvasNode(context, containerName, copyrightSection.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
    responsiveStack: 'mobile',
  });
  addText(context, copyrightWrap.id, 'Copyright 2026 Tidyra. All rights reserved.', {
    fontSize: '12px',
    lineHeight: '1.4',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, copyrightWrap.id, 'Privacy  |  Terms', {
    fontSize: '12px',
    lineHeight: '1.4',
    textColor: 'rgba(255, 255, 255, 0.7)',
    marginTop: '0px',
    marginBottom: '0px',
  });
}

function addHeroProofDeck(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  if (!container) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const proofGrid = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '20px',
    responsiveStack: 'mobile',
  });

  if (requiredRoleMinimum(context.brief, 'secondary') > 0) {
    addMediaSurface(context, proofGrid.id, 'secondary', context.replacementProfile.secondary, {
      minHeight: geometry.secondaryMinHeight,
      borderRadius: geometry.cardRadius,
    });
  }

  addHeroProofCard(context, proofGrid.id);

  const stats = statItems(context.brief);
  if (stats.length > 0) {
    addMetricCard(context, proofGrid.id);
  }
}

function addMetricCard(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  const stats = statItems(context.brief);
  if (!container || stats.length === 0) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const card = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingTop: '22px',
    paddingRight: '22px',
    paddingBottom: '22px',
    paddingLeft: '22px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, container.name, style.cardBackground),
    boxShadow: 'soft',
  });
  addHeading(context, card.id, stats[0].value, 'div', {
    fontSize: '34px',
    lineHeight: '1',
    fontWeight: '850',
    textColor: style.cardInk,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, card.id, stats[0].label, {
    fontSize: '15px',
    lineHeight: '1.45',
    textColor: style.cardMuted,
  });
  context.heroProofCards += 1;
}

function addHeroProofCard(context, parentId) {
  const container = findComponent(context.contractIndex, ['Container']);
  if (!container) {
    return;
  }
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const proof = proofCopy(context.replacementProfile);
  const card = createCanvasNode(context, container.name, parentId, {
    layoutDisplay: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '14px',
    paddingTop: '24px',
    paddingRight: '24px',
    paddingBottom: '24px',
    paddingLeft: '24px',
    borderRadius: geometry.cardRadius,
    ...backgroundProps(context, container.name, style.cardBackground),
    boxShadow: 'soft',
  });

  addText(context, card.id, proof.eyebrow, {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '800',
    textColor: style.accent,
    backgroundColor: style.badgeBackground,
    paddingY: '7px',
    paddingX: '10px',
    borderRadius: '999px',
  });
  addHeading(context, card.id, proof.title, 'h3', {
    fontSize: '28px',
    fontSizeMobile: '24px',
    lineHeight: '1.08',
    fontWeight: '850',
    textColor: style.cardInk,
    marginTop: '0px',
    marginBottom: '0px',
  });
  addText(context, card.id, proof.body, {
    fontSize: '15px',
    lineHeight: '1.55',
    textColor: style.cardMuted,
  });
  addButton(context, card.id, secondaryAction(context.brief, proof.cta), '#');
  context.heroProofCards += 1;
}

function addServicesSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const careglo = context.replacementProfile?.name === 'luxury-car-care';
  const count = Math.max(requiredRoleMinimum(context.brief, 'service-card'), 0);
  if (count === 0 && h3Texts(context.brief).length === 0) {
    return;
  }

  if (careglo) {
    const services = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '128px',
      paddingBottom: '88px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '20px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    const row = createCanvasNode(context, containerName, services.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'six',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '24px',
    });
    const copy = createCanvasNode(context, containerName, row.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '48px',
      gridColumnSpan: 2,
      gridColumnSpanTablet: 2,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    const copyTop = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxWidth: '370px',
    });
    addHeading(context, copyTop.id, 'Precision Finish Care', 'h2', {
      fontSize: '16px',
      fontSizeMobile: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, copyTop.id, 'Every vehicle receives deliberate care, with each surface restored to a crisp, lasting finish.', {
      fontSize: '16px',
      fontSizeMobile: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const about = createCanvasNode(context, containerName, copy.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '420px',
    });
    addHeading(context, about.id, '/Our studio', 'h2', {
      fontSize: '20px',
      lineHeight: '1.3',
      fontWeight: '400',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, about.id, 'Refined Care, One Finish at a Time', 'h2', {
      fontSize: '32px',
      fontSizeMobile: '28px',
      lineHeight: '1.2',
      fontWeight: '400',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addMediaSurface(context, row.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[0], 'careglo-about-tall'), {
      gridColumnSpan: 2,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '420px',
      minHeightMobile: '320px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const right = createCanvasNode(context, containerName, row.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '48px',
      gridColumnSpan: 2,
      gridColumnSpanTablet: 1,
      gridColumnSpanMobile: 1,
      minHeight: '555px',
      minHeightTablet: '0px',
      minHeightMobile: '0px',
    });
    addMediaSurface(context, right.id, 'service-card', mediaVariant(context.replacementProfile.serviceCard[1], 'careglo-about-side'), {
      minHeight: '400px',
      minHeightTablet: '360px',
      minHeightMobile: '280px',
      borderRadius: '0px',
      backgroundPosition: 'center',
    });
    const rightCopy = createCanvasNode(context, containerName, right.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    });
    addHeading(context, rightCopy.id, 'Care Built Around You', 'h3', {
      fontSize: '20px',
      lineHeight: '1.25',
      fontWeight: '400',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, rightCopy.id, 'Flexible treatments for every vehicle, finish, and routine.', {
      fontSize: '16px',
      lineHeight: '1.4',
      fontWeight: '400',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const serviceCards = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '96px',
      paddingTopTablet: '0px',
      paddingTopMobile: '131px',
      paddingBottom: '76px',
      paddingBottomTablet: '90px',
      paddingBottomMobile: '88px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '24px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    const serviceIntro = createCanvasNode(context, containerName, serviceCards.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'two',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '48px',
      gapTablet: '28px',
      gapMobile: '22px',
      minHeight: '178px',
      minHeightTablet: '160px',
      minHeightMobile: '383px',
    });
    const serviceHeading = createCanvasNode(context, containerName, serviceIntro.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    addText(context, serviceHeading.id, '/Our top solution', {
      fontSize: '17px',
      lineHeight: '1.35',
      textColor: style.accent,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addHeading(context, serviceHeading.id, 'Premium finish care for every surface.', 'h2', {
      fontSize: '46px',
      fontSizeTablet: '38px',
      fontSizeMobile: '34px',
      lineHeight: '1.1',
      fontWeight: '600',
      textColor: style.ink,
      marginTop: '0px',
      marginBottom: '0px',
    });
    const serviceLead = createCanvasNode(context, containerName, serviceIntro.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '18px',
    });
    addText(context, serviceLead.id, 'Choose focused interior, exterior, or protection work, then shape the treatment around the vehicle and its daily use.', {
      fontSize: '17px',
      fontSizeMobile: '16px',
      lineHeight: '1.6',
      textColor: style.muted,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addButton(context, serviceLead.id, 'View treatments', '#', {
      backgroundColor: style.buttonBg,
      textColor: style.buttonFg,
    });
    const grid = createCanvasNode(context, containerName, serviceCards.id, {
      layoutDisplay: 'grid',
      gridTemplateColumns: 'three',
      gridTemplateColumnsTablet: 'two',
      gridTemplateColumnsMobile: 'one',
      gap: '24px',
    });
    const labels = h3Texts(context.brief);
    for (let index = 0; index < 3; index += 1) {
      const source = context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length];
      const mediaSource = mediaVariant(source, `careglo-service-card-${index + 1}`);
      const desktopHeight = '555px';
      const tabletHeight = index === 2 ? '366px' : '500px';
      const mobileHeight = index === 0 ? '454px' : index === 1 ? '500px' : '366px';
      const card = createCanvasNode(context, containerName, grid.id, {
        layoutDisplay: 'flex',
        flexDirection: 'column',
        justifyContent: index === 0 ? 'space-between' : 'flex-end',
        gap: '16px',
        gridColumnSpanTablet: index === 2 ? 2 : 1,
        gridColumnSpanMobile: 1,
        minHeight: desktopHeight,
        minHeightTablet: tabletHeight,
        minHeightMobile: mobileHeight,
        paddingTop: '24px',
        paddingRight: '24px',
        paddingBottom: '24px',
        paddingLeft: '24px',
        borderRadius: '20px',
        ...(index === 0
          ? backgroundProps(context, containerName, style.cardBackground)
          : {
              backgroundImage: mediaSource,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundOverlay: 'rgba(4, 7, 12, 0.48)',
            }),
      });
      addText(context, card.id, `0${index + 1}`, {
        fontSize: '15px',
        lineHeight: '1.2',
        fontWeight: '600',
        textColor: style.accent,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addHeading(context, card.id, labels[index] || `Service ${index + 1}`, 'h3', {
        fontSize: '24px',
        lineHeight: '1.25',
        fontWeight: '600',
        textColor: style.ink,
        marginTop: '0px',
        marginBottom: '0px',
      });
      addText(context, card.id, serviceCopy(context.replacementProfile, index), {
        fontSize: '16px',
        lineHeight: '1.5',
        fontWeight: '400',
        textColor: style.muted,
        marginTop: '0px',
        marginBottom: '0px',
      });
      if (index === 0) {
        addButton(context, card.id, 'Book a treatment', '#', {
          backgroundColor: style.buttonBg,
          textColor: style.buttonFg,
        });
        addMediaSurface(context, card.id, 'service-card', mediaSource, {
          width: '100%',
          minHeight: '200px',
          minHeightTablet: '200px',
          minHeightMobile: '180px',
          borderRadius: '14px',
          backgroundPosition: 'center',
        });
      }
    }
    return;
  }

  const services = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '64px',
    paddingBottom: '88px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  addHeading(context, services.id, secondHeading(context.brief), 'h2', {
    fontSize: '42px',
    fontSizeMobile: '34px',
    lineHeight: '1.08',
    fontWeight: '850',
    textColor: style.ink,
    marginTop: '0px',
    marginBottom: '0px',
  });

  const grid = createCanvasNode(context, containerName, services.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: 'three',
    gap: '24px',
    responsiveStack: 'tablet',
  });
  const cardCount = Math.max(count, Math.min(3, h3Texts(context.brief).length || 3));
  const labels = h3Texts(context.brief);

  for (let index = 0; index < cardCount; index += 1) {
    const card = createCanvasNode(context, containerName, grid.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '16px',
      paddingTop: '18px',
      paddingRight: '18px',
      paddingBottom: '22px',
      paddingLeft: '18px',
      borderRadius: geometry.cardRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
      boxShadow: 'soft',
    });
    addMediaSurface(context, card.id, 'service-card', context.replacementProfile.serviceCard[index % context.replacementProfile.serviceCard.length], {
      minHeight: geometry.serviceMediaMinHeight,
      borderRadius: geometry.mediaRadius,
    });
    addHeading(context, card.id, labels[index] || `Service ${index + 1}`, 'h3', {
      fontSize: '24px',
      lineHeight: '1.15',
      fontWeight: '800',
      textColor: style.cardInk,
      marginTop: '0px',
      marginBottom: '0px',
    });
    addText(context, card.id, serviceCopy(context.replacementProfile, index), {
      fontSize: '15px',
      lineHeight: '1.55',
      textColor: style.cardMuted,
    });
  }
}

function addLogoStripSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const maidy = isMaidyProfile(context);
  const strip = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: maidy ? '82px' : '44px',
    paddingTopTablet: maidy ? '52px' : undefined,
    paddingTopMobile: maidy ? '64px' : undefined,
    paddingBottom: maidy ? '82px' : '44px',
    paddingBottomTablet: maidy ? '52px' : undefined,
    paddingBottomMobile: maidy ? '64px' : undefined,
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.buttonBg),
  });
  const wrap = createCanvasNode(context, containerName, strip.id, {
    layoutDisplay: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '36px',
    gapTablet: maidy ? '18px' : undefined,
    gapMobile: maidy ? '8px' : undefined,
    responsiveStack: maidy ? undefined : 'tablet',
  });
  for (const label of ['ALDER', 'NORTHLINE', 'VERDANT', 'DAYMARK', 'KINSHIP']) {
    addText(context, wrap.id, label, {
      fontSize: '34px',
      fontSizeTablet: maidy ? '18px' : undefined,
      fontSizeMobile: maidy ? '12px' : '24px',
      fontWeight: '800',
      lineHeight: '1',
      textColor: 'rgba(255, 255, 255, 0.42)',
    });
  }
}

function addStatsSection(context, sectionName, containerName) {
  const style = context.styleProfile;
  const geometry = context.geometryProfile;
  const stats = statItems(context.brief).slice(0, 4);
  if (context.replacementProfile?.name === 'luxury-car-care') {
    const careStats = [
      { value: '34K+', label: 'vehicles renewed' },
      { value: '12+', label: 'years refining finishes' },
      { value: '95%', label: 'returning clients' },
      { value: '100%', label: 'handover checks' },
    ];
    while (stats.length < 4) {
      stats.push(careStats[stats.length]);
    }
  }
  if (stats.length === 0) {
    return;
  }

  const statsGrid = findComponent(context.contractIndex, ['StatsGrid']);
  if (statsGrid) {
    const section = createCanvasNode(context, sectionName, 'ROOT', {
      paddingTop: '34px',
      paddingBottom: '34px',
      innerMaxWidth: geometry.innerMaxWidth,
      innerPaddingX: '20px',
      ...backgroundProps(context, sectionName, style.bg),
    });
    createLeafNode(context, statsGrid.name, section.id, {
      items: stats.map((item) => ({ value: item.value, label: item.label })),
      columns: Math.min(stats.length, 4),
      columnsTablet: Math.min(stats.length, 4),
      columnsMobile: Math.min(stats.length, 2),
      cellBg: style.bg,
      cellPadding: '20px',
      borderColor: style.panel,
      borderRadius: '0px',
      valueColor: style.ink,
      labelColor: style.muted,
      accentColor: style.accent,
      metricOrder: 'value-label',
    });
    return;
  }

  const section = createCanvasNode(context, sectionName, 'ROOT', {
    paddingTop: '34px',
    paddingBottom: '34px',
    innerMaxWidth: geometry.innerMaxWidth,
    innerPaddingX: '20px',
    ...backgroundProps(context, sectionName, style.bg),
  });
  const wrap = createCanvasNode(context, containerName, section.id, {
    layoutDisplay: 'grid',
    gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
    gap: '20px',
    responsiveStack: 'mobile',
  });

  for (const item of stats) {
    const card = createCanvasNode(context, containerName, wrap.id, {
      layoutDisplay: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingTop: '20px',
      paddingRight: '20px',
      paddingBottom: '20px',
      paddingLeft: '20px',
      borderRadius: geometry.mediaRadius,
      ...backgroundProps(context, containerName, style.cardBackground),
    });
    addHeading(context, card.id, item.value, 'div', { fontSize: '30px', fontWeight: '850', textColor: style.ink });
    addText(context, card.id, item.label, { fontSize: '15px', textColor: style.muted });
  }
}

function addMediaSurface(context, parentId, role, source, props) {
  const container = findComponent(context.contractIndex, ['Container']);
  const image = findComponent(context.contractIndex, ['ImageBlock', 'Image', 'ImageGallery']);
  const containerMediaProp = container ? firstAllowedProp(context, container.name, ['backgroundImage', 'image', 'media', 'src', 'url']) : '';

  if (container && containerMediaProp) {
    createCanvasNode(context, container.name, parentId, {
      ...props,
      [containerMediaProp]: source,
      backgroundSize: props.backgroundSize || 'cover',
      backgroundPosition: props.backgroundPosition || (role === 'secondary' ? 'center center' : 'center center'),
    });
    return;
  }

  if (image) {
    const imageProp = firstAllowedProp(context, image.name, ['image', 'src', 'url']);
    createLeafNode(context, image.name, parentId, {
      [imageProp || 'image']: source,
      objectFit: props.objectFit || 'cover',
      objectPosition: props.objectPosition || 'center center',
      imageHeight: props.minHeight || '320px',
      borderRadius: props.borderRadius || '18px',
    });
    return;
  }

  context.warnings.push(`Missing media component for ${role}; no media node was created.`);
}

function addImageSurface(context, parentId, role, source, props) {
  const image = findComponent(context.contractIndex, ['ImageBlock', 'Image']);
  if (!image) {
    addMediaSurface(context, parentId, role, source, props);
    return;
  }

  const imageProp = firstAllowedProp(context, image.name, ['image', 'src', 'url']);
  createLeafNode(context, image.name, parentId, {
    [imageProp || 'image']: source,
    alt: props.alt || `${role} image`,
    width: props.width,
    maxWidth: props.maxWidth || props.width,
    height: props.height || props.minHeight || '320px',
    objectFit: props.objectFit || 'contain',
    objectPosition: props.objectPosition || 'center',
    borderRadius: props.borderRadius || '0px',
  });
}

function lumenDoctorCutoutSource() {
  const source = String(process.env.MONTEBY_LUMEN_DOCTOR_CUTOUT_URL || '').trim();

  if (!/^https?:\/\//i.test(source) || !isTransparentCutoutSource(source)) {
    return '';
  }

  return source;
}

function optomattaHeroCompositeSource() {
  const source = String(process.env.MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL || '').trim();
  return /^https?:\/\//i.test(source) ? source : '';
}

function maidyHeroCompositeSource() {
  const source = String(process.env.MONTEBY_MAIDY_HERO_COMPOSITE_URL || '').trim();
  return /^https?:\/\//i.test(source) ? source : '';
}

function isTransparentCutoutSource(source) {
  return /\.(?:png|webp)(?:[?#]|$)/i.test(String(source || ''));
}

function isMaidyProfile(context) {
  return context.replacementProfile?.name === 'maid-service-agency';
}

function isLumenProfile(context) {
  return context.replacementProfile?.name === 'lumen-eye-care-editorial';
}

function isOptomattaProfile(context) {
  return context.replacementProfile?.name === 'optomatta-optical-retail';
}

function maidyPanelColor(context) {
  const secondaryAccent = String(context.styleProfile.accent2 || '').trim().toLowerCase();
  return secondaryAccent === '#ffdd67' ? context.styleProfile.accent : context.styleProfile.accent2 || context.styleProfile.accent;
}

function maidyHighlightColor(context) {
  const panelColor = String(maidyPanelColor(context) || '').trim().toLowerCase();
  const candidates = [
    context.styleProfile.accent2,
    context.styleProfile.accent,
    context.styleProfile.buttonBg,
    '#ffdd67',
  ];

  return candidates.find((candidate) => {
    const color = String(candidate || '').trim();
    return color && color.toLowerCase() !== panelColor;
  }) || '#ffdd67';
}

function maidyEyebrowText(brief, profile) {
  return `${brandName(brief, profile)} CLEANING SERVICE`.toUpperCase();
}

function maidyHeroHeadingLines() {
  return {
    body: ['Fresh Rooms,', 'Calm Spaces,', 'Every Visit'],
    accent: 'Clean & Ready',
  };
}

function isMaidyRealReferenceBrief(brief) {
  const sourceUrl = typeof brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? brief.authoringRequirements.realReferenceSourceUrl
    : '';

  return brief.authoringRequirements?.requireRealReference === true
    && /\bmaidy\b|askproject\.net\/maidy/i.test(sourceUrl);
}

function replacementProfileForBrief(brief) {
  const haystack = [
    brief.target?.archetype,
    brief.target?.referenceStyle,
    brief.target?.variant,
    brief.text?.title,
    firstHeading(brief),
    secondHeading(brief),
    ...h3Texts(brief),
  ].filter(Boolean).join(' ').toLowerCase();

  const profile = REPLACEMENT_PROFILES.find((item) => item.match.some((term) => haystack.includes(term))) || defaultReplacementProfile;
  const realReferenceSourceUrl = typeof brief.authoringRequirements?.realReferenceSourceUrl === 'string'
    ? brief.authoringRequirements.realReferenceSourceUrl.trim()
    : '';
  const usesRealReference = brief.authoringRequirements?.requireRealReference === true || /^https?:\/\//i.test(realReferenceSourceUrl);
  const canUseGeneratedTargetMedia = usesRealReference === false && Boolean(brief.target?.seed) && Array.isArray(brief.media?.surfaces);
  if (!canUseGeneratedTargetMedia) {
    return profile;
  }

  const surfaces = brief.media.surfaces
    .filter((surface) => surface && typeof surface === 'object' && typeof surface.source === 'string' && surface.source.trim());
  const hero = surfaces.find((surface) => surface.role === 'hero')?.source || profile.hero;
  const secondary = surfaces.find((surface) => surface.role === 'secondary')?.source || profile.secondary;
  const serviceCard = surfaces
    .filter((surface) => surface.role === 'service-card')
    .map((surface) => surface.source)
    .filter(Boolean);

  return {
    ...profile,
    hero,
    secondary,
    equipment: profile.equipment,
    serviceCard: serviceCard.length > 0 ? serviceCard : profile.serviceCard,
  };
}

function maidyHeroCutoutSource() {
  const source = String(process.env.MONTEBY_MAIDY_HERO_CUTOUT_URL || '').trim();

  if (!/^https?:\/\//i.test(source) || !isTransparentCutoutSource(source)) {
    return '';
  }

  return source;
}

function run(context, sectionName, containerName) {
  addNavSection(context, sectionName, containerName);
  addHeroSection(context, sectionName, containerName);
  if (isOptomattaProfile(context)) {
    addOptomattaProofStripSection(context, sectionName, containerName);
    addOptomattaIntroSection(context, sectionName, containerName);
  }
  if (isMaidyProfile(context)) {
    addLogoStripSection(context, sectionName, containerName);
    addMaidyHomepageDepthSections(context, sectionName, containerName);
  } else if (!isLumenProfile(context)) {
    const rootCountBeforeServices = context.nodeMap.ROOT.nodes.length;
    addServicesSection(context, sectionName, containerName);
    const rootCountAfterServices = context.nodeMap.ROOT.nodes.length;
    addStatsSection(context, sectionName, containerName);
    if (
      context.replacementProfile?.name === 'luxury-car-care'
      && rootCountAfterServices >= rootCountBeforeServices + 2
      && context.nodeMap.ROOT.nodes.length === rootCountAfterServices + 1
    ) {
      const statsSectionId = context.nodeMap.ROOT.nodes.pop();
      context.nodeMap.ROOT.nodes.splice(rootCountBeforeServices + 1, 0, statsSectionId);
    }
  }
  if (context.replacementProfile?.name === 'luxury-car-care') {
    addCaregloHomepageDepthSections(context, sectionName, containerName);
  }
  if (isOptomattaProfile(context)) {
    addOptomattaHomepageDepthSections(context, sectionName, containerName);
  }
  if (isLumenProfile(context)) {
    addLumenHomepageDepthSections(context, sectionName, containerName);
  }
}

function qualityErrors(draft, referenceManifest, options) {
  const errors = [];
  const sourceUrl = typeof referenceManifest?.sourceUrl === 'string' ? referenceManifest.sourceUrl : '';

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && draft.stats?.mediaProfile === 'maid-service-agency'
    && /\bmaidy\b|askproject\.net\/maidy/i.test(sourceUrl)
    && !maidyHeroCutoutSource()
    && !maidyHeroCompositeSource()
  ) {
    errors.push({
      code: 'missing_maidy_hero_cutout_asset',
      message: 'Captured Maidy references use a cleaner/person cutout or composite hero artwork. Provide a generated, licensed, or user-provided transparent PNG/WebP through MONTEBY_MAIDY_HERO_CUTOUT_URL, or a full hero composite through MONTEBY_MAIDY_HERO_COMPOSITE_URL, before drafting a real-reference Maidy candidate.',
    });
  }

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && draft.stats?.mediaProfile === 'optomatta-optical-retail'
    && /optomatta|kits\.moxcreative\.com\/optomatta/i.test(sourceUrl)
    && !optomattaHeroCompositeSource()
  ) {
    errors.push({
      code: 'missing_optomatta_hero_composite_asset',
      message: 'Captured Optomatta references use one full-width optical hero bitmap. Provide a generated, licensed, or user-provided 1440px-wide composite replacement through MONTEBY_OPTOMATTA_HERO_COMPOSITE_URL before drafting a real-reference Optomatta candidate.',
    });
  }

  if (
    options.requireRealReference
    && options.requireMarketplaceMedia
    && /\blumen\b|omispace\.com\/lumen/i.test(sourceUrl)
    && !lumenDoctorCutoutSource()
  ) {
    errors.push({
      code: 'missing_lumen_doctor_cutout_asset',
      message: 'Captured Lumen references use a transparent/cutout-like doctor hero. Provide a generated, licensed, or user-provided transparent PNG/WebP through MONTEBY_LUMEN_DOCTOR_CUTOUT_URL before drafting a real-reference Lumen candidate.',
    });
  }

  return errors;
}

  return { qualityErrors, replacementProfileForBrief, run };
}

module.exports = { createHistoricalBenchmarkRecipes };
