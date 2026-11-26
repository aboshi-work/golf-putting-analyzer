import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import * as Linking from "expo-linking";

import { GreenScene } from "@/components/green/green-scene";
import { STAGE } from "@/components/green/green-types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { shadowLg, shadowPrimary } from "@/lib/card-shadow";
import { setDemoMode } from "@/lib/demo-mode";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

/**
 * スタート画面（フルスクリーン 3D グリーン）。
 * 最初からメール入力欄を出さず、Google / メールシート / デモ体験の3導線だけを置く。
 */
export default function LoginScreen() {
  const colors = useColors();
  const { width: rawW, height: rawH } = useWindowDimensions();
  const screenW = rawW > 0 ? rawW : 390;
  const screenH = rawH > 0 ? rawH : 844;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) setError(err.message);
        else setMessage("確認メールを送信しました。メールを確認してアカウントを有効化してください。");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) setError(err.message);
      }
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectTo =
        Platform.OS === "web" && typeof window !== "undefined"
          ? `${window.location.origin}/oauth/callback`
          : Linking.createURL("oauth/callback");
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (err) setError(err.message);
    } catch {
      setError("Googleログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: STAGE.bgBottom }}>
      {/* 背景フルスクリーン 3D グリーン */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GreenScene
          mode="hero"
          height={screenH}
          radius={0}
          accessibilityLabel="グリーン上でボールがカップに入るアニメーション"
        />
        {/* 上下になめらかな暗緑グラデーションを重ねて文字とボタンの視認性を確保 */}
        <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="startScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#07130C" stopOpacity={0.82} />
              <Stop offset="28%" stopColor="#07130C" stopOpacity={0.22} />
              <Stop offset="56%" stopColor="#07130C" stopOpacity={0.08} />
              <Stop offset="80%" stopColor="#07130C" stopOpacity={0.74} />
              <Stop offset="100%" stopColor="#07130C" stopOpacity={0.96} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={screenW} height={screenH} fill="url(#startScrim)" />
        </Svg>
      </View>

      <SafeAreaView style={{ flex: 1, justifyContent: "space-between", alignItems: "center" }} edges={["top", "bottom"]}>
        {/* 上部ブランドタイトル */}
        <View style={{ width: "100%", maxWidth: 440, paddingHorizontal: 24, paddingTop: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STAGE.one }} />
            <Text style={{ color: STAGE.one, fontSize: 12, fontWeight: "800", letterSpacing: 2 }}>
              STROKE GAINED PUTTING
            </Text>
          </View>
          <Text
            style={{
              color: STAGE.text,
              fontSize: 34,
              fontWeight: "900",
              letterSpacing: -0.8,
              marginTop: 10,
            }}
          >
            パッティング分析
          </Text>
          <Text style={{ color: STAGE.textMuted, fontSize: 15, lineHeight: 23, marginTop: 8 }}>
            カードに書いて撮るだけ。{"\n"}どの距離・ラインで何打失っているかが分かる
          </Text>
        </View>

        {/* 下部アクションドック */}
        <View style={{ width: "100%", maxWidth: 440, paddingHorizontal: 22, paddingBottom: 24, gap: 12 }}>
          {error && !sheetOpen && <ErrorBanner message={error} />}

          {/* 1. Google ではじめる */}
          <Pressable
            onPress={() => void handleGoogleLogin()}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                height: 54,
                borderRadius: 27,
                backgroundColor: "#FFFFFF",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: loading ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
              shadowLg,
            ]}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#4285F4" }}>G</Text>
            </View>
            <Text style={{ color: "#121814", fontSize: 16, fontWeight: "800" }}>Googleではじめる</Text>
          </Pressable>

          {/* 2. メールでログイン / 新規登録（シートを開く） */}
          <Pressable
            onPress={() => {
              setError(null);
              setMessage(null);
              setSheetOpen(true);
            }}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 54,
              borderRadius: 27,
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.28)",
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ color: STAGE.text, fontSize: 16, fontWeight: "800" }}>
              メールアドレスでログイン / 登録
            </Text>
          </Pressable>

          {/* 3. デモ体験 */}
          <Pressable
            onPress={() => void setDemoMode(true)}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: STAGE.one, fontSize: 15, fontWeight: "800" }}>
              まずはデモで体験する（22ラウンド） →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* メールログイン用ボトムシート */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <View
            style={[
              {
                width: "100%",
                maxWidth: 480,
                alignSelf: "center",
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: 32,
              },
              shadowLg,
            ]}
          >
            {/* グラバー */}
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }}>
                {mode === "signin" ? "メールでログイン" : "アカウント作成"}
              </Text>
              <Pressable onPress={() => setSheetOpen(false)} accessibilityLabel="閉じる" style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </Pressable>
            </View>

            {/* モード切替 */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 4,
                marginBottom: 18,
              }}
            >
              {(["signin", "signup"] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setMessage(null);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mode === m ? colors.primary : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "800", color: mode === m ? colors.onPrimary : colors.muted }}>
                    {m === "signin" ? "ログイン" : "新規登録"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 6 }}>メールアドレス</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                minHeight: 48,
                borderRadius: 14,
                paddingHorizontal: 14,
                fontSize: 16,
                color: colors.foreground,
                backgroundColor: colors.background,
                marginBottom: 14,
              }}
            />

            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 6 }}>パスワード</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="6文字以上"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              style={{
                minHeight: 48,
                borderRadius: 14,
                paddingHorizontal: 14,
                fontSize: 16,
                color: colors.foreground,
                backgroundColor: colors.background,
                marginBottom: 18,
              }}
            />

            {error && <ErrorBanner message={error} style={{ marginBottom: 14 }} />}

            {message && (
              <View style={{ backgroundColor: `${colors.success}1F`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{message}</Text>
              </View>
            )}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={loading}
              style={({ pressed }) => [
                {
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: loading ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
                shadowPrimary,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "800" }}>
                  {mode === "signin" ? "ログイン" : "アカウント作成"}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
