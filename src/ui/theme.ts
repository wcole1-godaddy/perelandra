interface Flavor {
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

const latte: Flavor = {
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

const mocha: Flavor = {
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
  
  return 'light';
}

function createTheme(flavor: Flavor) {
  const c = flavor.colors;
  
  return {
    text: {
      primary: c.text,
      secondary: c.subtext0,
      muted: c.overlay1,
      inverse: c.base,
    },
    border: {
      default: c.surface1,
      muted: c.surface0,
      focus: c.lavender,
    },
    accent: {
      primary: c.lavender,
      success: c.green,
      warning: c.yellow,
      error: c.red,
      info: c.blue,
    },
    status: {
      running: c.green,
      starting: c.yellow,
      stopping: c.peach,
      stopped: c.overlay1,
      error: c.red,
      success: c.green,
      warning: c.yellow,
      idle: c.overlay1,
      blocked: c.peach,
      active: c.lavender,
    },
    statusBar: {
      bg: c.mantle,
      fg: c.subtext0,
    },
    surface: {
      base: c.base,
      mantle: c.mantle,
      crust: c.crust,
      surface0: c.surface0,
      surface1: c.surface1,
      surface2: c.surface2,
    },
    palette: c,
  } as const;
}

const colorScheme = detectColorScheme();
const activeFlavor = colorScheme === 'light' ? latte : mocha;

export const theme = createTheme(activeFlavor);
export const currentFlavor = activeFlavor;
export type Theme = typeof theme;
