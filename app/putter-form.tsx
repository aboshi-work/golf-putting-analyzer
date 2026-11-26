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
import { Card, SectionTitle } from "@/components/analysis/ui";
import { ErrorBanner } from "@/components/ui/error-banner";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { hapticSuccess } from "@/lib/haptics";
import { getPutter, savePutter, updatePutter } from "@/lib/storage";
import { LABELS } from "@/lib/types";

type PutterRanking = "ace" | "2nd" | "3rd" | "4th" | "5th";

export default function PutterFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const { width: rawScreenW } = useWindowDimensions();
  const contentW = Math.min(rawScreenW > 0 ? rawScreenW : 390, 720) - 32;

  const isEditing = Boolean(id);
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [length, setLength] = useState("");
  const [lieAngle, setLieAngle] = useState("");
  const [weight, setWeight] = useState("");
  const [gripName, setGripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [ranking, setRanking] = useState<PutterRanking>("ace");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getPutter(id).then((putter) => {
      if (!putter) return;
      setBrandName(putter.brandName);
      setProductName(putter.productName);
      setLength(putter.length.toString());
      setLieAngle(putter.lieAngle.toString());
      setWeight(putter.weight.toString());
      setGripName(putter.gripName);
      setStartDate(putter.startDate);
      setRanking(putter.ranking);
    });
  }, [id]);

  const handleSave = async () => {
    setError(null);
    if (!brandName.trim()) {
      setError("ブランド名を入力してください");
      return;
    }
    if (!productName.trim()) {
      setError("商品名を入力してください");
      return;
    }

    setIsSaving(true);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const putterData = {
      brandName: brandName.trim(),
      productName: productName.trim(),
      length: parseFloat(length) || 34,
      lieAngle: parseFloat(lieAngle) || 70,
      weight: parseFloat(weight) || 350,
      gripName: gripName.trim(),
      startDate: startDate || today,
      usageCount: 0,
      ranking,
    };

    try {
      if (isEditing && id) {
        await updatePutter(id, putterData);
      } else {
        await savePutter(putterData);
      }
      hapticSuccess();
      router.back();
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
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
              {isEditing ? "パター編集" : "パター登録"}
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

        <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: contentW, gap: 16 }}>
            {error && <ErrorBanner message={error} />}

            <Card>
              <SectionTitle title="基本情報（必須）" />
              <View style={{ gap: 14 }}>
                <LabeledField label="ブランド名 *" value={brandName} onChangeText={setBrandName} placeholder="例: Scotty Cameron" autoCapitalize="words" />
                <LabeledField label="商品名 *" value={productName} onChangeText={setProductName} placeholder="例: Newport 2" autoCapitalize="words" />
              </View>
            </Card>

            <Card>
              <SectionTitle title="スペック（任意）" />
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="長さ（インチ）" value={length} onChangeText={setLength} placeholder="34" keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="ライ角（度）" value={lieAngle} onChangeText={setLieAngle} placeholder="70" keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="重量（g）" value={weight} onChangeText={setWeight} placeholder="350" keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="グリップ" value={gripName} onChangeText={setGripName} placeholder="SuperStroke" />
                  </View>
                </View>
                <LabeledField label="使用開始日" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD（例: 2026-04-01）" />
              </View>
            </Card>

            <Card>
              <SectionTitle title="位置づけ" subtitle="このパターの使用優先度を選択してください" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(Object.keys(LABELS.putterRanking) as PutterRanking[]).map((r) => {
                  const active = ranking === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRanking(r)}
                      style={{
                        minHeight: 42,
                        paddingHorizontal: 16,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : colors.background,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: active ? colors.onPrimary : colors.foreground, fontSize: 15, fontWeight: "700" }}>
                        {LABELS.putterRanking[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
  autoCapitalize?: "none" | "words";
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
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
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
  );
}
