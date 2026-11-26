import { useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";

import { SERIF_FONT } from "@/constants/theme";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/analysis/ui";
import { ErrorBanner } from "@/components/ui/error-banner";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { hapticSuccess } from "@/lib/haptics";
import { getCourse, saveCourse, updateCourse } from "@/lib/storage";

export default function CourseFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const { width: rawScreenW } = useWindowDimensions();
  const contentW = Math.min(rawScreenW > 0 ? rawScreenW : 390, 720) - 32;

  const isEditing = Boolean(id);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [greens, setGreens] = useState<string[]>(["A"]);
  const [newGreen, setNewGreen] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCourse(id).then((course) => {
      if (!course) return;
      setName(course.name);
      setLocation(course.location ?? "");
      setGreens(course.greens.length > 0 ? course.greens : []);
    });
  }, [id]);

  const addGreen = () => {
    const trimmed = newGreen.trim();
    if (trimmed && !greens.includes(trimmed)) {
      setGreens([...greens, trimmed]);
      setNewGreen("");
    }
  };

  const removeGreen = (green: string) => {
    setGreens(greens.filter((g) => g !== green));
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("コース名は必須です");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim() || undefined,
        greens,
      };
      if (id) {
        await updateCourse(id, payload);
      } else {
        await saveCourse(payload);
      }
      hapticSuccess();
      router.back();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View
          style={{
            width: "100%",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
          }}
        >
          <View style={{ width: contentW, minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => router.back()} accessibilityLabel="戻る" style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
              <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
            </Pressable>
            <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 19, fontWeight: "700" }}>
              {isEditing ? "コース編集" : "コース登録"}
            </Text>
            <Pressable
              onPress={() => void handleSave()}
              disabled={isSaving}
              style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.primary, justifyContent: "center", opacity: isSaving ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: "800" }}>{isSaving ? "保存中..." : "保存"}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: contentW, gap: 16 }}>
            {error && <ErrorBanner message={error} />}

            <Card>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>コース名 *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="例: ○○カントリークラブ"
                    placeholderTextColor={colors.muted}
                    style={{
                      minHeight: 46,
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

                <View>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>所在地</Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="例: 岐阜県多治見市"
                    placeholderTextColor={colors.muted}
                    style={{
                      minHeight: 46,
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

                <View>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>使用グリーン（A / B / ベント / 高麗 など）</Text>
                  {greens.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {greens.map((green) => (
                        <View
                          key={green}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 12,
                            minHeight: 34,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          }}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>{green}</Text>
                          <Pressable onPress={() => removeGreen(green)} hitSlop={6} accessibilityLabel={`${green}を削除`}>
                            <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={newGreen}
                      onChangeText={setNewGreen}
                      placeholder="グリーン名を追加（例: B）"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                      onSubmitEditing={addGreen}
                      style={{
                        flex: 1,
                        minHeight: 46,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        paddingHorizontal: 12,
                        fontSize: 16,
                        color: colors.foreground,
                      }}
                    />
                    <Pressable
                      onPress={addGreen}
                      accessibilityLabel="グリーンを追加"
                      style={{ paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: "800" }}>追加</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
