import { Tabs, Redirect } from "expo-router";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { setDemoMode } from "@/lib/demo-mode";
import { useIsDemo, useSession } from "@/lib/session-context";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const isDemo = useIsDemo();
  const { width: screenW } = useWindowDimensions();

  // 認証状態が解決するまでタブ配下の画面（とそのデータ取得）をマウントしない。
  if (session === undefined) return null;
  if (!session) return <Redirect href="/login" />;

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;
  const barInnerW = Math.min(screenW, 760) - 32;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isDemo && (
        <View
          style={{
            paddingTop: Platform.OS === "web" ? 8 : Math.max(insets.top, 8),
            paddingBottom: 8,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            alignItems: "center",
          }}
        >
          <View style={{ width: "100%", maxWidth: 728, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />
            <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18, flex: 1 }}>
              デモモードで表示中（サンプル22ラウンド・編集も試せます）
            </Text>
            <Pressable
              onPress={() => void setDemoMode(false)}
              accessibilityRole="button"
              style={{
                minHeight: 30,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>終了</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.muted,
          headerShown: false,
          tabBarButton: Platform.OS === "web" ? undefined : HapticTab,
          tabBarLabelStyle: {
            fontSize: 12,
            lineHeight: 16,
            fontWeight: "700",
            letterSpacing: 0.2,
          },
          tabBarStyle: {
            paddingTop: 6,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            zIndex: 100,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "ホーム",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="rounds"
          options={{
            title: "ラウンド",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "分析",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "プロフィール",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
