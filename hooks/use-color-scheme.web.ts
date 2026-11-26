import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import { useOptionalThemeContext } from "@/lib/theme-provider";

/**
 * Web でも ThemeProvider の状態（自動/ライト/ダーク）を単一の正として返す。
 * SSR と初回ハイドレーションの一致も ThemeProvider 側で制御済み。
 */
export function useColorScheme() {
  const ctx = useOptionalThemeContext();
  const [hasHydrated, setHasHydrated] = useState(false);
  const rnScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (ctx) return ctx.colorScheme;
  return hasHydrated ? rnScheme : "light";
}
