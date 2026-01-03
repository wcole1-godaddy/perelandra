/**
 * Catppuccin-based theme with opencode-style layout patterns
 *
 * Uses Catppuccin Mocha/Macchiato/Frappe/Latte palettes with opencode's semantic naming:
 * - primary/secondary/accent for actions and highlights
 * - background/backgroundPanel/backgroundElement for layering
 * - border/borderActive/borderSubtle for borders
 * - text/textMuted for typography
 */

interface CatppuccinFlavor {
  name: string;
  dark: boolean;
  colors: {
    rosewater: string;
    flamingo: string;
    pink: string;
    mauve: string;
    red: string;
    maroon: string;
    peach: string;
    yellow: string;
    green: string;
    teal: string;
    sky: string;
    sapphire: string;
    blue: string;
    lavender: string;
    text: string;
    subtext1: string;
    subtext0: string;
    overlay2: string;
    overlay1: string;
    overlay0: string;
    surface2: string;
    surface1: string;
    surface0: string;
    base: string;
    mantle: string;
    crust: string;
  };
}

const latte: CatppuccinFlavor = {
  name: 'Latte',
  dark: false,
  colors: {
    rosewater: '#dc8a78',
    flamingo: '#dd7878',
    pink: '#ea76cb',
    mauve: '#8839ef',
    red: '#d20f39',
    maroon: '#e64553',
    peach: '#fe640b',
    yellow: '#df8e1d',
    green: '#40a02b',
    teal: '#179299',
    sky: '#04a5e5',
    sapphire: '#209fb5',
    blue: '#1e66f5',
    lavender: '#7287fd',
    text: '#4c4f69',
    subtext1: '#5c5f77',
    subtext0: '#6c6f85',
    overlay2: '#7c7f93',
    overlay1: '#8c8fa1',
    overlay0: '#9ca0b0',
    surface2: '#acb0be',
    surface1: '#bcc0cc',
    surface0: '#ccd0da',
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
  },
};

const frappe: CatppuccinFlavor = {
  name: 'Frappé',
  dark: true,
  colors: {
    rosewater: '#f2d5cf',
    flamingo: '#eebebe',
    pink: '#f4b8e4',
    mauve: '#ca9ee6',
    red: '#e78284',
    maroon: '#ea999c',
    peach: '#ef9f76',
    yellow: '#e5c890',
    green: '#a6d189',
    teal: '#81c8be',
    sky: '#99d1db',
    sapphire: '#85c1dc',
    blue: '#8caaee',
    lavender: '#babbf1',
    text: '#c6d0f5',
    subtext1: '#b5bfe2',
    subtext0: '#a5adce',
    overlay2: '#949cbb',
    overlay1: '#838ba7',
    overlay0: '#737994',
    surface2: '#626880',
    surface1: '#51576d',
    surface0: '#414559',
    base: '#303446',
    mantle: '#292c3c',
    crust: '#232634',
  },
};

const macchiato: CatppuccinFlavor = {
  name: 'Macchiato',
  dark: true,
  colors: {
    rosewater: '#f4dbd6',
    flamingo: '#f0c6c6',
    pink: '#f5bde6',
    mauve: '#c6a0f6',
    red: '#ed8796',
    maroon: '#ee99a0',
    peach: '#f5a97f',
    yellow: '#eed49f',
    green: '#a6da95',
    teal: '#8bd5ca',
    sky: '#91d7e3',
    sapphire: '#7dc4e4',
    blue: '#8aadf4',
    lavender: '#b7bdf8',
    text: '#cad3f5',
    subtext1: '#b8c0e0',
    subtext0: '#a5adcb',
    overlay2: '#939ab7',
    overlay1: '#8087a2',
    overlay0: '#6e738d',
    surface2: '#5b6078',
    surface1: '#494d64',
    surface0: '#363a4f',
    base: '#24273a',
    mantle: '#1e2030',
    crust: '#181926',
  },
};

const mocha: CatppuccinFlavor = {
  name: 'Mocha',
  dark: true,
  colors: {
    rosewater: '#f5e0dc',
    flamingo: '#f2cdcd',
    pink: '#f5c2e7',
    mauve: '#cba6f7',
    red: '#f38ba8',
    maroon: '#eba0ac',
    peach: '#fab387',
    yellow: '#f9e2af',
    green: '#a6e3a1',
    teal: '#94e2d5',
    sky: '#89dceb',
    sapphire: '#74c7ec',
    blue: '#89b4fa',
    lavender: '#b4befe',
    text: '#cdd6f4',
    subtext1: '#bac2de',
    subtext0: '#a6adc8',
    overlay2: '#9399b2',
    overlay1: '#7f849c',
    overlay0: '#6c7086',
    surface2: '#585b70',
    surface1: '#45475a',
    surface0: '#313244',
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
  },
};

export type ThemeFlavorName = 'mocha' | 'macchiato' | 'frappe' | 'latte';

export const flavors: Record<ThemeFlavorName, CatppuccinFlavor> = {
  mocha,
  macchiato,
  frappe,
  latte,
};

export const flavorNames: ThemeFlavorName[] = ['mocha', 'macchiato', 'frappe', 'latte'];

function detectColorScheme(): 'dark' | 'light' {
  const colorterm = process.env.COLORFGBG;
  if (colorterm) {
    const [, bg] = colorterm.split(';');
    if (bg === '0' || bg === '8') return 'dark';
    if (bg === '7' || bg === '15') return 'light';
  }

  const termProgram = process.env.TERM_PROGRAM;
  const ghosttyTheme = process.env.GHOSTTY_RESOURCES_DIR;

  if (ghosttyTheme || termProgram === 'ghostty') {
    return 'light';
  }

  return 'dark';
}

export function detectDefaultFlavor(): ThemeFlavorName {
  return detectColorScheme() === 'light' ? 'latte' : 'mocha';
}

function createTheme(flavor: CatppuccinFlavor) {
  const c = flavor.colors;

  return {
    primary: c.lavender,
    secondary: c.sapphire,
    accent: c.mauve,

    error: c.red,
    warning: c.yellow,
    success: c.green,
    info: c.blue,

    text: c.text,
    textMuted: c.overlay1,
    selectedForeground: c.base,

    background: c.crust,
    backgroundPanel: c.base,
    backgroundElement: c.surface0,

    border: c.surface1,
    borderActive: c.lavender,
    borderSubtle: c.surface0,

    statusRunning: c.green,
    statusStarting: c.yellow,
    statusStopping: c.peach,
    statusStopped: c.overlay1,
    statusError: c.red,
    statusSuccess: c.green,
    statusWarning: c.yellow,
    statusIdle: c.overlay1,
    statusBlocked: c.peach,
    statusActive: c.lavender,

    palette: c,
  } as const;
}

export const SplitBorder = {
  border: ['left' as const, 'right' as const],
  customBorderChars: {
    vertical: '┃',
    horizontal: '',
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
  },
};

export const LeftBorder = {
  border: ['left' as const],
  customBorderChars: {
    vertical: '┃',
    horizontal: '',
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
  },
};

let currentFlavorName: ThemeFlavorName = detectDefaultFlavor();
let currentTheme = createTheme(flavors[currentFlavorName]);

export function getTheme() {
  return currentTheme;
}

export function getThemeMeta() {
  return { name: flavors[currentFlavorName].name, dark: flavors[currentFlavorName].dark };
}

export function getCurrentFlavorName(): ThemeFlavorName {
  return currentFlavorName;
}

export function setThemeFlavor(name: ThemeFlavorName): void {
  currentFlavorName = name;
  currentTheme = createTheme(flavors[name]);
}

export const theme = new Proxy({} as ReturnType<typeof createTheme>, {
  get(_target, prop: string) {
    return (currentTheme as Record<string, unknown>)[prop];
  },
});

export const themeMeta = new Proxy({} as { name: string; dark: boolean }, {
  get(_target, prop: string) {
    const meta = getThemeMeta();
    return (meta as Record<string, unknown>)[prop];
  },
});

export type ThemeType = ReturnType<typeof createTheme>;
