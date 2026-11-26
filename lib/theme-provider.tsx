import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

export type ThemeMode = "system" | "light" | "dark";

const THEME_MODE_KEY = "putting_analyzer_theme_mode";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [hydrated, setHydrated] = useState(Platform.OS !== "web");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    setHydrated(true);
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((saved) => {
        if (saved === "system" || saved === "light" || saved === "dark") {
          setThemeModeState(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const colorScheme: ColorScheme = useMemo(() => {
    if (!hydrated) return "light";
    if (themeMode === "light" || themeMode === "dark") return themeMode;
    return systemScheme === "dark" ? "dark" : "light";
  }, [hydrated, themeMode, systemScheme]);

  const applyScheme = useCallback((scheme: ColorScheme, mode: ThemeMode) => {
    nativewindColorScheme.set(scheme);
    if (Platform.OS !== "web") {
      Appearance.setColorScheme?.(mode === "system" ? null : scheme);
    }
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      root.style.colorScheme = scheme;
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyScheme(colorScheme, themeMode);
  }, [hydrated, colorScheme, themeMode, applyScheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => undefined);
  }, []);

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      setThemeMode(scheme);
    },
    [setThemeMode],
  );

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
        "color-accent": SchemeColors[colorScheme].accent,
        "color-onPrimary": SchemeColors[colorScheme].onPrimary,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themeMode,
      setThemeMode,
      setColorScheme,
    }),
    [colorScheme, themeMode, setThemeMode, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: SchemeColors[colorScheme].background }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}

export function useOptionalThemeContext(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
