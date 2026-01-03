import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  type ThemeFlavorName,
  setThemeFlavor,
  getCurrentFlavorName,
  flavorNames,
  flavors,
  detectDefaultFlavor,
} from '../theme';

interface ThemeContextValue {
  flavorName: ThemeFlavorName;
  flavorLabel: string;
  isDark: boolean;
  availableFlavors: Array<{ name: ThemeFlavorName; label: string; dark: boolean }>;
  setFlavor: (name: ThemeFlavorName) => void;
  cycleFlavor: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialFlavor?: ThemeFlavorName;
  onFlavorChange?: (name: ThemeFlavorName) => void;
}

export function ThemeProvider({
  children,
  initialFlavor,
  onFlavorChange,
}: ThemeProviderProps): React.ReactNode {
  const [flavorName, setFlavorName] = useState<ThemeFlavorName>(() => {
    if (initialFlavor) {
      setThemeFlavor(initialFlavor);
      return initialFlavor;
    }
    return getCurrentFlavorName();
  });

  useEffect(() => {
    if (initialFlavor && initialFlavor !== flavorName) {
      setThemeFlavor(initialFlavor);
      setFlavorName(initialFlavor);
    }
  }, [initialFlavor]);

  const setFlavor = useCallback(
    (name: ThemeFlavorName) => {
      setThemeFlavor(name);
      setFlavorName(name);
      onFlavorChange?.(name);
    },
    [onFlavorChange]
  );

  const cycleFlavor = useCallback(() => {
    const currentIndex = flavorNames.indexOf(flavorName);
    const nextIndex = (currentIndex + 1) % flavorNames.length;
    const nextFlavor = flavorNames[nextIndex];
    if (nextFlavor) {
      setFlavor(nextFlavor);
    }
  }, [flavorName, setFlavor]);

  const flavor = flavors[flavorName];

  const value: ThemeContextValue = {
    flavorName,
    flavorLabel: flavor.name,
    isDark: flavor.dark,
    availableFlavors: flavorNames.map((name) => ({
      name,
      label: flavors[name].name,
      dark: flavors[name].dark,
    })),
    setFlavor,
    cycleFlavor,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      flavorName: detectDefaultFlavor(),
      flavorLabel: flavors[detectDefaultFlavor()].name,
      isDark: flavors[detectDefaultFlavor()].dark,
      availableFlavors: flavorNames.map((name) => ({
        name,
        label: flavors[name].name,
        dark: flavors[name].dark,
      })),
      setFlavor: () => {},
      cycleFlavor: () => {},
    };
  }
  return context;
}
