/**
 * 分析・共通まわりの UI 部品（枠線レスカード・見出し・ピル・セグメント・数値タイル）。
 * 色はテーマのトークンだけを使う（ダークモード対応）。
 */
import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { shadowSm } from "@/lib/card-shadow";

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 22,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.border,
          padding: padded ? 20 : 0,
          overflow: "hidden",
        },
        shadowSm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.foreground,
            fontSize: 19,
            fontWeight: "800",
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 3, lineHeight: 20 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  dot,
  textColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  dot?: string;
  /** 暗い背景の上に置くときの文字色 */
  textColor?: string;
}) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 13,
        minHeight: 36,
        borderRadius: 18,
        borderWidth: textColor ? 1 : 0,
        borderColor: selected ? tint : "rgba(255,255,255,0.22)",
        backgroundColor: selected
          ? textColor
            ? "rgba(255,255,255,0.18)"
            : tint
          : textColor
            ? "rgba(255,255,255,0.08)"
            : colors.surface,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {dot ? <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: dot, opacity: selected ? 1 : 0.35 }} /> : null}
      <Text
        style={{
          color: textColor ?? (selected ? colors.onPrimary : colors.foreground),
          opacity: textColor && !selected ? 0.75 : 1,
          fontSize: 13,
          fontWeight: selected ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 14, padding: 4 }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 11,
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Text style={{ color: active ? colors.onPrimary : colors.muted, fontSize: 14, fontWeight: active ? "800" : "600" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({ label, value, unit, note, tone }: { label: string; value: string; unit?: string; note?: string; tone?: "good" | "bad" | "neutral" }) {
  const colors = useColors();
  const color = tone === "good" ? colors.success : tone === "bad" ? colors.error : colors.foreground;
  return (
    <View style={{ flex: 1, minWidth: 130, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
        <Text style={{ color, fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -0.6 }}>{value}</Text>
        {unit ? <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700", marginLeft: 3 }}>{unit}</Text> : null}
      </View>
      {note ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{note}</Text> : null}
    </View>
  );
}

export function Note({ children, icon = "info.circle" }: { children: ReactNode; icon?: "info.circle" | "exclamationmark.triangle.fill" }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "flex-start" }}>
      <IconSymbol name={icon} size={16} color={colors.muted} style={{ marginTop: 2 }} />
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, flex: 1 }}>{children}</Text>
    </View>
  );
}

/** 符号付きの打数（+0.4 / −1.2） */
export function formatStrokes(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return `${v > 0 ? "+" : "−"}${s}`;
}
