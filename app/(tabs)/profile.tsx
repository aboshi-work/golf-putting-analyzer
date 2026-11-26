import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { SERIF_FONT } from "@/constants/theme";
import { ScreenContainer } from "@/components/screen-container";
import { Card, Chip, SectionTitle, Segmented } from "@/components/analysis/ui";
import { ConfirmBox } from "@/components/ui/confirm-box";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBaseline } from "@/hooks/use-baseline";
import { hapticSuccess } from "@/lib/haptics";
import {
  getUserProfile,
  saveUserProfile,
  getPutters,
  deletePutter,
  getCourses,
  deleteCourse,
  deleteAllRounds,
  getRoundsWithHoles,
} from "@/lib/storage";
import { UserProfile, Putter, GolfCourse, LABELS } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { buildRoundsCsv, deliverCsv } from "@/lib/export-csv";
import { setDemoMode } from "@/lib/demo-mode";
import { openPrintCard } from "@/lib/print-card";
import { BASELINES, type BaselineId } from "@/lib/putting-stats";
import { useIsDemo } from "@/lib/session-context";
import { useThemeContext, type ThemeMode } from "@/lib/theme-provider";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "自動" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { themeMode, setThemeMode } = useThemeContext();
  const { width: rawScreenW } = useWindowDimensions();
  const contentW = Math.min(rawScreenW > 0 ? rawScreenW : 390, 760) - 32;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [putters, setPutters] = useState<Putter[]>([]);
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHandicap, setEditHandicap] = useState("");
  const [editStrideLength, setEditStrideLength] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeletePutterConfirm, setShowDeletePutterConfirm] = useState<string | null>(null);
  const [showDeleteCourseConfirm, setShowDeleteCourseConfirm] = useState<string | null>(null);
  const [showDeleteAllRoundsConfirm, setShowDeleteAllRoundsConfirm] = useState(false);
  const [isDeletingAllRounds, setIsDeletingAllRounds] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "busy" | "done" | "empty" | "error">("idle");
  const isDemo = useIsDemo();
  const [baseline, setBaseline] = useBaseline(profile?.handicap);

  const loadData = useCallback(async () => {
    const [profileData, puttersData, coursesData] = await Promise.all([
      getUserProfile(),
      getPutters(),
      getCourses(),
    ]);
    setProfile(profileData);
    setPutters(puttersData);
    setCourses(coursesData);
    if (profileData) {
      setEditName(profileData.name);
      setEditHandicap(profileData.handicap.toString());
      setEditStrideLength(profileData.strideLength.toString());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleSaveProfile = async () => {
    const updated = await saveUserProfile({
      name: editName,
      handicap: parseFloat(editHandicap) || 0,
      strideLength: parseFloat(editStrideLength) || 0.7,
    });
    setProfile(updated);
    setIsEditing(false);
    hapticSuccess();
  };

  const handleConfirmDeletePutter = async (putterId: string) => {
    await deletePutter(putterId);
    hapticSuccess();
    setShowDeletePutterConfirm(null);
    loadData();
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    if (isDemo) {
      await setDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const handleConfirmDeleteCourse = async (courseId: string) => {
    await deleteCourse(courseId);
    hapticSuccess();
    setShowDeleteCourseConfirm(null);
    loadData();
  };

  const handleExportCsv = async () => {
    setExportState("busy");
    try {
      const rounds = await getRoundsWithHoles();
      if (rounds.length === 0) {
        setExportState("empty");
        return;
      }
      await deliverCsv(buildRoundsCsv(rounds));
      hapticSuccess();
      setExportState("done");
    } catch (e) {
      console.error("[profile] export csv failed:", e);
      setExportState("error");
    }
  };

  const handleConfirmDeleteAllRounds = async () => {
    setIsDeletingAllRounds(true);
    try {
      await deleteAllRounds();
      hapticSuccess();
      setShowDeleteAllRoundsConfirm(false);
    } finally {
      setIsDeletingAllRounds(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 112 }} showsVerticalScrollIndicator={false}>
          <View style={{ width: contentW, gap: 16, paddingTop: 14 }}>
            <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 28, fontWeight: "700", letterSpacing: 0.2 }}>
              プロフィール
            </Text>

            {/* 基本情報 */}
            <Card>
              <SectionTitle
                title="基本情報"
                right={
                  <Pressable
                    onPress={() => {
                      if (isEditing) void handleSaveProfile();
                      else setIsEditing(true);
                    }}
                    accessibilityRole="button"
                    style={{
                      minHeight: 34,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isEditing ? colors.primary : colors.border,
                      backgroundColor: isEditing ? colors.primary : "transparent",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: isEditing ? colors.onPrimary : colors.primary, fontSize: 14, fontWeight: "700" }}>
                      {isEditing ? "保存" : "編集"}
                    </Text>
                  </Pressable>
                }
              />

              {isEditing ? (
                <View style={{ gap: 14 }}>
                  <FieldInput label="名前" value={editName} onChangeText={setEditName} placeholder="名前を入力" />
                  <FieldInput label="ハンディキャップ" value={editHandicap} onChangeText={setEditHandicap} placeholder="0" keyboardType="decimal-pad" />
                  <View>
                    <FieldInput label="歩幅（メートル）" value={editStrideLength} onChangeText={setEditStrideLength} placeholder="0.7" keyboardType="decimal-pad" />
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>歩数から距離を計算するために使用します</Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <InfoRow label="名前" value={profile?.name || "未設定"} first />
                  <InfoRow label="ハンディキャップ" value={profile?.handicap != null ? String(profile.handicap) : "未設定"} />
                  <InfoRow label="歩幅" value={profile?.strideLength ? `${profile.strideLength}m` : "未設定"} />
                </View>
              )}
            </Card>

            {/* 外観（ライト／ダーク） */}
            <Card>
              <SectionTitle title="外観" subtitle="画面の明るさを切り替えます（自動は端末の設定に合わせます）" />
              <Segmented options={THEME_OPTIONS} value={themeMode} onChange={setThemeMode} />
            </Card>

            {/* マイパター */}
            <Card>
              <SectionTitle
                title="マイパター"
                right={<AddButton label="追加" onPress={() => router.push("/putter-form" as never)} />}
              />

              {putters.length > 0 ? (
                <View>
                  {putters.map((putter, idx) => (
                    <View
                      key={putter.id}
                      style={{
                        paddingVertical: 12,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                              {`${putter.brandName} ${putter.productName}`}
                            </Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>
                              {LABELS.putterRanking[putter.ranking]}
                            </Text>
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, fontVariant: ["tabular-nums"] }}>
                            {`${putter.length}" / ${putter.weight}g`}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <IconAction icon="pencil" label="編集" color={colors.primary} onPress={() => router.push(`/putter-form?id=${putter.id}` as never)} />
                          <IconAction
                            icon="trash.fill"
                            label="削除"
                            color={colors.error}
                            onPress={() => setShowDeletePutterConfirm(showDeletePutterConfirm === putter.id ? null : putter.id)}
                          />
                        </View>
                      </View>
                      {showDeletePutterConfirm === putter.id && (
                        <ConfirmBox
                          message="削除しますか？"
                          confirmLabel="削除"
                          onCancel={() => setShowDeletePutterConfirm(null)}
                          onConfirm={() => void handleConfirmDeletePutter(putter.id)}
                          style={{ marginTop: 10 }}
                        />
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ paddingVertical: 16, alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>パターが登録されていません</Text>
                  <Pressable
                    onPress={() => router.push("/putter-form" as never)}
                    style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 16, minHeight: 40, justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>最初のパターを登録する</Text>
                  </Pressable>
                </View>
              )}
            </Card>

            {/* 登録コース */}
            <Card>
              <SectionTitle
                title="登録コース"
                right={<AddButton label="追加" onPress={() => router.push("/course-form" as never)} />}
              />

              {courses.length > 0 ? (
                <View>
                  {courses.map((course, idx) => (
                    <View
                      key={course.id}
                      style={{
                        paddingVertical: 12,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{course.name}</Text>
                          {course.greens.length > 0 && (
                            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                              {`グリーン: ${course.greens.join(", ")}`}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <IconAction icon="pencil" label="コースを編集" color={colors.primary} onPress={() => router.push(`/course-form?id=${course.id}` as never)} />
                          <IconAction
                            icon="trash.fill"
                            label="コースを削除"
                            color={colors.error}
                            onPress={() => setShowDeleteCourseConfirm(showDeleteCourseConfirm === course.id ? null : course.id)}
                          />
                        </View>
                      </View>
                      {showDeleteCourseConfirm === course.id && (
                        <ConfirmBox
                          message="削除しますか？"
                          confirmLabel="削除"
                          onCancel={() => setShowDeleteCourseConfirm(null)}
                          onConfirm={() => void handleConfirmDeleteCourse(course.id)}
                          style={{ marginTop: 10 }}
                        />
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: 14 }}>
                  コースが登録されていません
                </Text>
              )}
            </Card>

            {/* パッティングカード */}
            <Card>
              <SectionTitle
                title="パッティングカード"
                subtitle="A4 2枚に印刷して、OUT 用と IN 用のカードを作ります。それぞれ二つ折りで 170×102mm（ポケットサイズ）。1ホール2段で、全パットの距離・傾斜・曲がりを書けます。"
              />
              <Pressable
                onPress={() => void openPrintCard()}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <IconSymbol name="printer.fill" size={18} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: "800" }}>カードを印刷する</Text>
              </Pressable>
            </Card>

            {/* 分析の比較基準 */}
            <Card>
              <SectionTitle title="分析で比べる相手" subtitle="ストロークス・ゲインド（損得）の基準です。分析タブでも切り替えられます。" />
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(Object.keys(BASELINES) as BaselineId[]).map((b) => (
                  <Chip key={b} label={BASELINES[b].label} selected={baseline === b} onPress={() => setBaseline(b)} />
                ))}
              </View>
              <Pressable onPress={() => router.push("/guide" as never)} style={{ minHeight: 40, justifyContent: "center", marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>分析の見方を読む →</Text>
              </Pressable>
            </Card>

            {/* データのエクスポート */}
            <Card>
              <SectionTitle title="データ" subtitle="全ラウンドのパット記録を1行1パットのCSVで書き出します（Excel対応）。" />
              <Pressable
                onPress={() => void handleExportCsv()}
                disabled={exportState === "busy"}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: `${colors.primary}12`,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: exportState === "busy" ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                <IconSymbol name="list.bullet" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
                  {exportState === "busy" ? "書き出し中..." : "CSVでエクスポート"}
                </Text>
              </Pressable>
              {exportState === "done" && (
                <Text style={{ color: colors.success, fontSize: 13, marginTop: 8, textAlign: "center" }}>書き出しました</Text>
              )}
              {exportState === "empty" && (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: "center" }}>ラウンドデータがありません</Text>
              )}
              {exportState === "error" && (
                <Text style={{ color: colors.error, fontSize: 13, marginTop: 8, textAlign: "center" }}>書き出しに失敗しました</Text>
              )}
            </Card>

            {/* 全ラウンドデータを削除・ログアウト */}
            <View style={{ gap: 10, marginTop: 4 }}>
              {showDeleteAllRoundsConfirm ? (
                <Card style={{ borderColor: colors.error }}>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                    全ラウンドデータを削除しますか？
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    全てのラウンド・ホール・パット記録が削除されます。この操作は元に戻せません。
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                    <Pressable
                      onPress={() => setShowDeleteAllRoundsConfirm(false)}
                      disabled={isDeletingAllRounds}
                      style={{ flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>キャンセル</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleConfirmDeleteAllRounds()}
                      disabled={isDeletingAllRounds}
                      style={{ flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", opacity: isDeletingAllRounds ? 0.6 : 1 }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{isDeletingAllRounds ? "削除中..." : "全て削除"}</Text>
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <DangerButton icon="trash.fill" label="全ラウンドデータを削除" onPress={() => setShowDeleteAllRoundsConfirm(true)} />
              )}

              {showLogoutConfirm ? (
                <Card>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                    {isDemo ? "デモを終了しますか？" : "ログアウトしますか？"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                    <Pressable
                      onPress={() => setShowLogoutConfirm(false)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>キャンセル</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleLogout()}
                      style={{ flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{isDemo ? "デモを終了" : "ログアウト"}</Text>
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <DangerButton
                  icon="rectangle.portrait.and.arrow.right"
                  label={isDemo ? "デモを終了してログイン画面へ" : "ログアウト"}
                  onPress={() => setShowLogoutConfirm(true)}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function InfoRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: first ? 0 : 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        returnKeyType="done"
        style={{
          minHeight: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: 12,
          fontSize: 16,
          color: colors.foreground,
        }}
      />
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: colors.primary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <IconSymbol name="plus" size={16} color={colors.onPrimary} />
      <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function IconAction({ icon, label, color, onPress }: { icon: "pencil" | "trash.fill"; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 8 }}
    >
      <IconSymbol name={icon} size={19} color={color} />
    </Pressable>
  );
}

function DangerButton({ icon, label, onPress }: { icon: "trash.fill" | "rectangle.portrait.and.arrow.right"; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <IconSymbol name={icon} size={18} color={colors.error} />
      <Text style={{ color: colors.error, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
