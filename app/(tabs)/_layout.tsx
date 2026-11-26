import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Tabs, Redirect, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { shadowLg, shadowMd, shadowPrimary } from "@/lib/card-shadow";
import { setDemoMode } from "@/lib/demo-mode";
import { hapticLight } from "@/lib/haptics";
import { openPrintCard } from "@/lib/print-card";
import { useIsDemo, useSession } from "@/lib/session-context";

type TabMeta = {
  routeName: string;
  label: string;
  icon: "house.fill" | "list.bullet" | "chart.bar.fill" | "person.fill";
};

const LEFT_TABS: TabMeta[] = [
  { routeName: "index", label: "ホーム", icon: "house.fill" },
  { routeName: "rounds", label: "履歴", icon: "list.bullet" },
];
const RIGHT_TABS: TabMeta[] = [
  { routeName: "analytics", label: "分析", icon: "chart.bar.fill" },
  { routeName: "profile", label: "設定", icon: "person.fill" },
];

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const isDemo = useIsDemo();
  const router = useRouter();
  const [recordOpen, setRecordOpen] = useState(false);

  if (session === undefined) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* デモ中は上中央に控えめなピルだけ表示（ヘッダーの左右ボタンと重ならない） */}
      {isDemo && (
        <View
          style={{
            paddingTop: Platform.OS === "web" ? 10 : Math.max(insets.top, 8),
            paddingBottom: 2,
            alignItems: "center",
            backgroundColor: colors.background,
          }}
        >
          <Pressable
            onPress={() => void setDemoMode(false)}
            accessibilityRole="button"
            accessibilityLabel="デモモードを終了してログイン画面へ戻る"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              minHeight: 28,
              borderRadius: 14,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
              DEMO（サンプル22R） · 終了
            </Text>
          </Pressable>
        </View>
      )}

      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <FloatingTabBar
            {...props}
            onPressAdd={() => {
              hapticLight();
              setRecordOpen(true);
            }}
          />
        )}
      >
        <Tabs.Screen name="index" options={{ title: "ホーム" }} />
        <Tabs.Screen name="rounds" options={{ title: "履歴" }} />
        <Tabs.Screen name="analytics" options={{ title: "分析" }} />
        <Tabs.Screen name="profile" options={{ title: "設定" }} />
      </Tabs>

      {/* 中央「＋」ボタンから開く記録アクションシート */}
      <Modal visible={recordOpen} transparent animationType="slide" onRequestClose={() => setRecordOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setRecordOpen(false)} />
          <View
            style={[
              {
                width: "100%",
                maxWidth: 480,
                alignSelf: "center",
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 24) + 8,
                gap: 10,
              },
              shadowLg,
            ]}
          >
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 8 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }}>
                記録をはじめる
              </Text>
              <Pressable onPress={() => setRecordOpen(false)} accessibilityLabel="閉じる" style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <SheetAction
              icon="camera.fill"
              title="カードを撮影して読み取る"
              subtitle="OUT と IN の2枚を撮って自動で入力"
              primary
              onPress={() => {
                setRecordOpen(false);
                router.push("/scan-card" as never);
              }}
            />
            <SheetAction
              icon="pencil"
              title="新規ラウンドを作成・手入力"
              subtitle="コースやパターを選んでホールごとに入力"
              onPress={() => {
                setRecordOpen(false);
                router.push("/new-round" as never);
              }}
            />
            <SheetAction
              icon="printer.fill"
              title="パッティングカードを印刷"
              subtitle="A4 2枚・ポケットサイズの二つ折りカード"
              onPress={() => {
                setRecordOpen(false);
                void openPrintCard();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FloatingTabBar({ state, navigation, onPressAdd }: BottomTabBarProps & { onPressAdd: () => void }) {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 12);

  const activeName = state.routes[state.index]?.name;

  const renderTab = (t: TabMeta) => {
    const active = activeName === t.routeName;
    return (
      <Pressable
        key={t.routeName}
        onPress={() => {
          if (!active) {
            hapticLight();
            navigation.navigate(t.routeName);
          }
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => ({
          flex: 1,
          height: 50,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          backgroundColor: active ? `${colors.primary}18` : "transparent",
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <IconSymbol name={t.icon} size={22} color={active ? colors.primary : colors.muted} />
        <Text
          style={{
            color: active ? colors.primary : colors.muted,
            fontSize: 11,
            fontWeight: active ? "800" : "600",
            marginTop: 2,
          }}
        >
          {t.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        alignItems: "center",
        paddingHorizontal: 14,
        zIndex: 100,
      }}
    >
      <View
        style={[
          {
            width: "100%",
            maxWidth: 440,
            height: 66,
            borderRadius: 33,
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: isDark ? "rgba(20, 33, 25, 0.92)" : "rgba(255, 255, 255, 0.92)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(18,24,20,0.06)",
            ...(Platform.OS === "web" ? ({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as object) : {}),
          },
          shadowMd,
        ]}
      >
        {LEFT_TABS.map(renderTab)}

        {/* 中央の記録 FAB */}
        <Pressable
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel="ラウンドを記録する"
          style={({ pressed }) => [
            {
              width: 52,
              height: 52,
              borderRadius: 26,
              marginHorizontal: 4,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
            shadowPrimary,
          ]}
        >
          <IconSymbol name="plus" size={28} color={colors.onPrimary} />
        </Pressable>

        {RIGHT_TABS.map(renderTab)}
      </View>
    </View>
  );
}

function SheetAction({
  icon,
  title,
  subtitle,
  primary,
  onPress,
}: {
  icon: "camera.fill" | "pencil" | "printer.fill";
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: primary ? colors.primary : colors.background,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: primary ? "rgba(255,255,255,0.18)" : colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconSymbol name={icon} size={22} color={primary ? colors.onPrimary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: primary ? colors.onPrimary : colors.foreground, fontSize: 16, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: primary ? colors.onPrimary : colors.muted, opacity: primary ? 0.85 : 1, fontSize: 13, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={primary ? colors.onPrimary : colors.muted} />
    </Pressable>
  );
}
