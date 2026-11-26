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
import { shadowPrimary } from "@/lib/card-shadow";
import { hapticSuccess } from "@/lib/haptics";
import { getCourses, getPutters, getRound, getRounds, saveRound, updateRound } from "@/lib/storage";
import {
  CompetitionFormat,
  GolfCourse,
  GrassType,
  GreenCondition,
  LABELS,
  Putter,
  Round,
  RoundType,
  Weather,
  WindSpeed,
} from "@/lib/types";

const STIMP_PRESETS = ["8.5", "9.0", "9.5", "10.0", "10.5"];

function offsetYmd(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * ラウンドの作成と、ラウンド情報（日付・コース・パター・グリーン・環境）の編集を1画面に集約。
 *  - /new-round                        新規作成（よく使う項目は前回の値を引き継ぎ、すぐカード撮影か手入力へ進める）
 *  - /new-round?edit=<id>              既存ラウンドの情報を編集（ホールの記録はそのまま）
 *  - /new-round?edit=<id>&after=scan   カードの読み取りから作ったラウンドに、続けて情報を入れる（「あとで」で飛ばせる）
 */
export default function NewRoundScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width: rawScreenW } = useWindowDimensions();
  const screenW = rawScreenW > 0 ? rawScreenW : 390;
  const contentW = Math.min(screenW, 720) - 32;
  const { edit, after } = useLocalSearchParams<{ edit?: string; after?: string }>();
  const afterScan = Boolean(edit) && after === "scan";

  const [putters, setPutters] = useState<Putter[]>([]);
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // 基本項目
  const [date, setDate] = useState(() => offsetYmd(0));
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [selectedPutterId, setSelectedPutterId] = useState<string | null>(null);
  const [grassType, setGrassType] = useState<GrassType>("bent");
  const [stimpmeter, setStimpmeter] = useState("9.0");

  // 詳しい環境（任意）
  const [frontNineGreen, setFrontNineGreen] = useState("");
  const [backNineGreen, setBackNineGreen] = useState("");
  const [greenCondition, setGreenCondition] = useState<GreenCondition>("good");
  const [weather, setWeather] = useState<Weather>("sunny");
  const [windSpeed, setWindSpeed] = useState<WindSpeed>("calm");
  const [temperature, setTemperature] = useState("");
  const [mowingHeight, setMowingHeight] = useState("");
  const [compaction, setCompaction] = useState("");
  const [roundType, setRoundType] = useState<RoundType>("private");
  const [competitionFormat, setCompetitionFormat] = useState<CompetitionFormat>("stroke");

  useEffect(() => {
    const loadData = async () => {
      const [puttersData, coursesData] = await Promise.all([getPutters(), getCourses()]);
      setPutters(puttersData);
      setCourses(coursesData);
      if (puttersData.length > 0) {
        const acePutter = puttersData.find((p) => p.ranking === "ace");
        setSelectedPutterId(acePutter?.id || puttersData[0].id);
      }
      const base = edit ? await getRound(edit).catch(() => null) : (await getRounds().catch(() => []))[0] ?? null;
      if (!base) return;
      if (edit) {
        setDate(base.date.split("T")[0]);
        setWeather(base.weather);
        setWindSpeed(base.windSpeed);
        setTemperature(base.temperature != null ? String(base.temperature) : "");
        setSelectedCourseId(base.courseId || null);
        setCourseName(base.courseName === "未設定" ? "" : base.courseName);
        setFrontNineGreen(base.frontNineGreen ?? "");
        setBackNineGreen(base.backNineGreen ?? "");
        setMowingHeight(base.mowingHeight != null ? String(base.mowingHeight) : "");
        setCompaction(base.compaction != null ? String(base.compaction) : "");
        setGreenCondition(base.greenCondition);
        if (base.temperature != null || base.mowingHeight != null || base.compaction != null || base.frontNineGreen) {
          setMoreOpen(true);
        }
      }
      setGrassType(base.grassType);
      if (base.stimpmeter) setStimpmeter(Number(base.stimpmeter).toFixed(1));
      setRoundType(base.roundType);
      setCompetitionFormat(base.competitionFormat);
      if (base.putterId && puttersData.some((p) => p.id === base.putterId)) setSelectedPutterId(base.putterId);
    };
    loadData();
  }, [edit]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  const handleCourseSelect = (course: GolfCourse) => {
    setSelectedCourseId(course.id);
    setCourseName(course.name);
    if (course.greens.length > 0) {
      setFrontNineGreen(course.greens[0]);
      setBackNineGreen(course.greens[0]);
    }
  };

  const handleSubmit = async (nextDest: "round" | "scan" | "manual") => {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      setError("日付は YYYY-MM-DD 形式で入力してください");
      return;
    }
    if (!courseName.trim()) {
      setError("コース名を選択または入力してください");
      return;
    }
    if (!selectedPutterId && putters.length > 0) {
      setError("使用パターを選択してください");
      return;
    }

    const selectedPutter = putters.find((p) => p.id === selectedPutterId);
    const roundData: Omit<Round, "id" | "createdAt" | "updatedAt"> = {
      date,
      weather,
      temperature: temperature ? parseFloat(temperature) : undefined,
      windSpeed,
      courseId: selectedCourseId || "",
      courseName: courseName.trim(),
      frontNineGreen,
      backNineGreen,
      roundType,
      competitionFormat,
      grassType,
      stimpmeter: parseFloat(stimpmeter) || 9.0,
      mowingHeight: mowingHeight ? parseFloat(mowingHeight) : undefined,
      compaction: compaction ? parseFloat(compaction) : undefined,
      greenCondition,
      putterId: selectedPutterId || "",
      putterName: selectedPutter ? `${selectedPutter.brandName} ${selectedPutter.productName}` : "",
      holes: [],
      totalPutts: 0,
    };

    setIsSubmitting(true);
    try {
      if (edit) {
        const { holes: _holes, totalPutts: _total, ...info } = roundData;
        await updateRound(edit, info);
        hapticSuccess();
        router.replace(`/round/${edit}` as never);
        return;
      }
      const created = await saveRound(roundData);
      hapticSuccess();
      if (nextDest === "scan") {
        router.replace(`/scan-card?roundId=${created.id}` as never);
      } else if (nextDest === "manual") {
        router.replace(`/hole-input/${created.id}` as never);
      } else {
        router.replace(`/round/${created.id}` as never);
      }
    } catch {
      setError(edit ? "保存に失敗しました。もう一度お試しください。" : "ラウンドの作成に失敗しました。もう一度お試しください。");
      setIsSubmitting(false);
    }
  };

  const today = offsetYmd(0);
  const yesterday = offsetYmd(-1);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* ヘッダー */}
        <View
          style={{
            width: "100%",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
        >
          <View style={{ width: "100%", maxWidth: 688, minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => router.back()} accessibilityLabel="戻る" style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
              <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
            </Pressable>
            <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 19, fontWeight: "700" }}>
              {afterScan ? "ラウンドの情報" : edit ? "ラウンド情報を編集" : "新規ラウンド"}
            </Text>
            {afterScan ? (
              <Pressable onPress={() => router.replace(`/round/${edit}` as never)} accessibilityRole="button" style={{ minHeight: 36, justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "800" }}>あとで</Text>
              </Pressable>
            ) : (
              <View style={{ width: 32, height: 32 }} />
            )}
          </View>
        </View>

        <ScrollView style={{ width: "100%" }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 18, paddingBottom: 32, alignItems: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 688, gap: 16 }}>
            {afterScan && (
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
                  カードの記録を保存しました。天気・グリーンの速さ・使ったパターを入れると、条件別の分析ができます（あとからラウンド画面で入れても大丈夫です）。
                </Text>
              </View>
            )}

            {!edit && (
              <Pressable
                onPress={() => router.replace("/scan-card" as never)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <IconSymbol name="camera.fill" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>記入済みのカードが手元にある場合</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>撮影から始めて、コースやパターは後からでも入れられます</Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>撮影へ →</Text>
              </Pressable>
            )}

            {/* 1. 基本情報 */}
            <Card>
              <SectionTitle title="基本項目" subtitle="前回のラウンド設定を引き継いでいます" />
              <View style={{ gap: 18 }}>
                {/* 日付 */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>プレー日</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <QuickChip label="今日" active={date === today} onPress={() => setDate(today)} />
                      <QuickChip label="昨日" active={date === yesterday} onPress={() => setDate(yesterday)} />
                    </View>
                  </View>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    style={{
                      minHeight: 46,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      paddingHorizontal: 12,
                      fontSize: 16,
                      fontVariant: ["tabular-nums"],
                      color: colors.foreground,
                    }}
                  />
                </View>

                {/* コース */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>コース *</Text>
                  {courses.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {courses.map((course) => {
                        const active = selectedCourseId === course.id;
                        return (
                          <Pressable
                            key={course.id}
                            onPress={() => handleCourseSelect(course)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={{
                              minHeight: 38,
                              paddingHorizontal: 12,
                              borderRadius: 9,
                              borderWidth: 1,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active ? colors.primary : colors.background,
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: active ? colors.onPrimary : colors.foreground, fontSize: 14, fontWeight: active ? "800" : "600" }}>
                              {course.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <TextInput
                    value={courseName}
                    onChangeText={(text) => {
                      setCourseName(text);
                      setSelectedCourseId(null);
                    }}
                    placeholder="ゴルフコース名を入力"
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

                {/* 使用パター */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>使用パター</Text>
                  {putters.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {putters.map((putter) => {
                        const active = selectedPutterId === putter.id;
                        return (
                          <Pressable
                            key={putter.id}
                            onPress={() => setSelectedPutterId(putter.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={{
                              minHeight: 46,
                              paddingHorizontal: 14,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active ? `${colors.primary}16` : colors.background,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 15, fontWeight: active ? "800" : "600" }}>
                              {`${putter.brandName} ${putter.productName}`}
                            </Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>
                              {LABELS.putterRanking[putter.ranking]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => router.push("/putter-form" as never)}
                      style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>+ パターを登録する</Text>
                    </Pressable>
                  )}
                </View>

                {/* 芝とグリーンの速さ */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>芝の種類</Text>
                  <OptionRow
                    options={(Object.keys(LABELS.grassType) as GrassType[]).map((g) => ({ value: g, label: LABELS.grassType[g] }))}
                    value={grassType}
                    onChange={setGrassType}
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>グリーンの速さ（スティンプ ft）</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {STIMP_PRESETS.map((s) => (
                      <QuickChip key={s} label={`${s}ft`} active={stimpmeter === s} onPress={() => setStimpmeter(s)} />
                    ))}
                    <TextInput
                      value={stimpmeter}
                      onChangeText={setStimpmeter}
                      placeholder="9.0"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={{
                        width: 82,
                        minHeight: 38,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        paddingHorizontal: 10,
                        fontSize: 15,
                        fontWeight: "700",
                        textAlign: "center",
                        fontVariant: ["tabular-nums"],
                        color: colors.foreground,
                      }}
                    />
                  </View>
                </View>
              </View>
            </Card>

            {/* 2. 詳しい環境（任意・折りたたみ） */}
            <Card>
              <Pressable
                onPress={() => setMoreOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: moreOpen }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 18, fontWeight: "700" }}>
                    詳しい環境・種別（任意）
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                    {`${LABELS.weather[weather]}・${LABELS.roundType[roundType]}・状態${LABELS.greenCondition[greenCondition]}`}
                  </Text>
                </View>
                <IconSymbol name="chevron.down" size={20} color={colors.muted} style={{ transform: [{ rotate: moreOpen ? "180deg" : "0deg" }] }} />
              </Pressable>

              {moreOpen && (
                <View style={{ gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>ラウンド種別</Text>
                    <OptionRow
                      options={(Object.keys(LABELS.roundType) as RoundType[]).map((r) => ({ value: r, label: LABELS.roundType[r] }))}
                      value={roundType}
                      onChange={setRoundType}
                    />
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>競技形式</Text>
                    <OptionRow
                      options={(Object.keys(LABELS.competitionFormat) as CompetitionFormat[]).map((f) => ({ value: f, label: LABELS.competitionFormat[f] }))}
                      value={competitionFormat}
                      onChange={setCompetitionFormat}
                    />
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>グリーンコンディション</Text>
                    <OptionRow
                      options={(Object.keys(LABELS.greenCondition) as GreenCondition[]).map((c) => ({ value: c, label: LABELS.greenCondition[c] }))}
                      value={greenCondition}
                      onChange={setGreenCondition}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>使用グリーン（OUT）</Text>
                      {selectedCourse && selectedCourse.greens.length > 1 && (
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                          {selectedCourse.greens.map((g) => (
                            <QuickChip key={g} label={g} active={frontNineGreen === g} onPress={() => setFrontNineGreen(g)} />
                          ))}
                        </View>
                      )}
                      <SmallInput value={frontNineGreen} onChangeText={setFrontNineGreen} placeholder="A" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>使用グリーン（IN）</Text>
                      {selectedCourse && selectedCourse.greens.length > 1 && (
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                          {selectedCourse.greens.map((g) => (
                            <QuickChip key={g} label={g} active={backNineGreen === g} onPress={() => setBackNineGreen(g)} />
                          ))}
                        </View>
                      )}
                      <SmallInput value={backNineGreen} onChangeText={setBackNineGreen} placeholder="A" />
                    </View>
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>天気</Text>
                    <OptionRow
                      options={(Object.keys(LABELS.weather) as Weather[]).map((w) => ({ value: w, label: LABELS.weather[w] }))}
                      value={weather}
                      onChange={setWeather}
                    />
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>風速</Text>
                    <OptionRow
                      options={(Object.keys(LABELS.windSpeed) as WindSpeed[]).map((w) => ({ value: w, label: LABELS.windSpeed[w] }))}
                      value={windSpeed}
                      onChange={setWindSpeed}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>気温（℃）</Text>
                      <SmallInput value={temperature} onChangeText={setTemperature} placeholder="22" keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>刈り高（mm）</Text>
                      <SmallInput value={mowingHeight} onChangeText={setMowingHeight} placeholder="3.3" keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>硬さ</Text>
                      <SmallInput value={compaction} onChangeText={setCompaction} placeholder="22" keyboardType="decimal-pad" />
                    </View>
                  </View>
                </View>
              )}
            </Card>

            {error && <ErrorBanner message={error} />}
          </View>
        </ScrollView>

        {/* 下部アクション */}
        <View
          style={{
            width: "100%",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
        >
          <View style={{ width: "100%", maxWidth: 688, flexDirection: "row", gap: 10 }}>
            {edit ? (
              <Pressable
                disabled={isSubmitting}
                onPress={() => void handleSubmit("round")}
                accessibilityRole="button"
                style={[
                  {
                    flex: 1,
                    minHeight: 50,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isSubmitting ? 0.6 : 1,
                  },
                  shadowPrimary,
                ]}
              >
                <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "800" }}>
                  {isSubmitting ? "保存中..." : "保存する"}
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  disabled={isSubmitting}
                  onPress={() => void handleSubmit("manual")}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    minHeight: 50,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>手入力へ</Text>
                </Pressable>
                <Pressable
                  disabled={isSubmitting}
                  onPress={() => void handleSubmit("scan")}
                  accessibilityRole="button"
                  style={[
                    {
                      flex: 1.5,
                      minHeight: 50,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isSubmitting ? 0.6 : 1,
                    },
                    shadowPrimary,
                  ]}
                >
                  <IconSymbol name="camera.fill" size={18} color={colors.onPrimary} />
                  <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: "800" }}>
                    {isSubmitting ? "作成中..." : "保存して撮影へ"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function QuickChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.background,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: active ? colors.onPrimary : colors.foreground, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
        {label}
      </Text>
    </Pressable>
  );
}

function OptionRow<T extends string>({
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : colors.background,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: active ? colors.onPrimary : colors.foreground, fontSize: 14, fontWeight: active ? "800" : "600" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SmallInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      style={{
        minHeight: 42,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        fontSize: 15,
        color: colors.foreground,
        fontVariant: ["tabular-nums"],
      }}
    />
  );
}
