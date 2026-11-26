/**
 * 1枚診断レポート（A4 縦・印刷／PDF保存対応）。
 * コーチや同伴者にそのまま見せられるよう、総合損得・練習優先トップ3・距離別・ライン別・ロングパットの要点を1枚にまとめる。
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { SERIF_FONT } from "@/constants/theme";
import { ScreenContainer } from "@/components/screen-container";
import { useDivergingColors } from "@/components/analysis/charts";
import { Segmented, formatStrokes } from "@/components/analysis/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBaseline } from "@/hooks/use-baseline";
import {
  BASELINES,
  holeObservations,
  lagStats,
  lineStats,
  practicePriorities,
  puttForStats,
  puttsPerGir,
  sgSummary,
  type BaselineId,
} from "@/lib/putting-stats";
import { getRoundsWithHoles, getUserProfile } from "@/lib/storage";
import type { Round, UserProfile } from "@/lib/types";

type Period = "last5" | "3m" | "1y" | "all";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "last5", label: "直近5R" },
  { value: "3m", label: "3ヶ月" },
  { value: "1y", label: "1年" },
  { value: "all", label: "全期間" },
];

function filterRounds(rounds: Round[], period: Period): Round[] {
  const played = rounds.filter((r) => r.holes.some((h) => h.totalPutts > 0));
  const sorted = [...played].sort((a, b) => b.date.localeCompare(a.date));
  if (period === "last5") return sorted.slice(0, 5);
  if (period === "all") return sorted;
  const now = new Date();
  const cutoff =
    period === "3m"
      ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const ymd = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  return sorted.filter((r) => r.date >= ymd);
}

const UD_KEYS = ["flat", "uphill", "downhill"] as const;
const LR_KEYS = ["straight", "left", "right"] as const;
const UD_LABEL = { flat: "平ら", uphill: "上り", downhill: "下り" } as const;
const LR_LABEL = { straight: "まっすぐ", left: "左へ", right: "右へ" } as const;

export default function ReportScreen() {
  const router = useRouter();
  const colors = useColors();
  const pal = useDivergingColors();
  const { period: initPeriod, baseline: initBaseline } = useLocalSearchParams<{ period?: string; baseline?: string }>();
  const { width: rawScreenW } = useWindowDimensions();
  const screenW = rawScreenW > 0 ? rawScreenW : 390;

  const [rounds, setRounds] = useState<Round[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(
    initPeriod === "last5" || initPeriod === "3m" || initPeriod === "1y" || initPeriod === "all" ? initPeriod : "all",
  );
  const [storedBaseline] = useBaseline(profile?.handicap);
  const baseline: BaselineId =
    initBaseline === "tour" || initBaseline === "scratch" || initBaseline === "hc15" ? initBaseline : storedBaseline;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([getRoundsWithHoles(), getUserProfile().catch(() => null)])
        .then(([r, p]) => {
          if (!alive) return;
          setRounds(r);
          setProfile(p);
        })
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, []),
  );

  const data = useMemo(() => {
    const scoped = filterRounds(rounds, period);
    const holes = holeObservations(scoped, baseline);
    const sg = sgSummary(holes);
    const priorities = practicePriorities(holes, baseline);
    const lag = lagStats(holes);
    const lines = lineStats(holes);
    const pf = puttForStats(holes);
    const gir = puttsPerGir(holes);
    const threePuttsPerRound = holes.length ? (holes.filter((h) => h.total >= 3).length / holes.length) * 18 : 0;
    const dates = scoped.map((r) => r.date.split("T")[0]).sort();
    return {
      scoped,
      sg,
      priorities,
      lag,
      lines,
      gir,
      birdieConv: pf.find((s) => s.puttFor === "birdie")?.conversion ?? null,
      parSave: pf.find((s) => s.puttFor === "par")?.conversion ?? null,
      threePuttsPerRound,
      dateRange: dates.length > 1 ? `${dates[0].replace(/-/g, "/")} 〜 ${dates[dates.length - 1].replace(/-/g, "/")}` : dates[0]?.replace(/-/g, "/") ?? "—",
    };
  }, [rounds, period, baseline]);

  const base = BASELINES[baseline];
  const today = new Date();
  const issued = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const isWide = screenW >= 700;
  const noPrintProp = Platform.OS === "web" ? ({ dataSet: { noPrint: "true" } } as object) : {};

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* 操作バー（印刷時は非表示） */}
      <View
        {...noPrintProp}
        style={{
          width: "100%",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 10,
          alignItems: "center",
        }}
      >
        <View style={{ width: "100%", maxWidth: 760, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Pressable onPress={() => router.back()} accessibilityLabel="戻る" style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 38 }}>
              <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>戻る</Text>
            </Pressable>
            <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 18, fontWeight: "700" }}>1枚診断レポート</Text>
            {Platform.OS === "web" ? (
              <Pressable
                onPress={() => window.print()}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 38,
                  paddingHorizontal: 14,
                  borderRadius: 9,
                  backgroundColor: colors.primary,
                }}
              >
                <IconSymbol name="printer.fill" size={16} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: "800" }}>印刷 / PDF</Text>
              </Pressable>
            ) : (
              <View style={{ width: 64 }} />
            )}
          </View>
          <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: 18, paddingBottom: 40 }}>
        {/* レポート本体（紙面を想定して常に白地＋深い墨色） */}
        <View
          style={{
            width: "100%",
            maxWidth: 760,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#D8D2C6",
            padding: isWide ? 28 : 18,
            gap: 18,
          }}
        >
          {/* タイトル帯 */}
          <View style={{ borderBottomWidth: 2, borderBottomColor: "#184228", paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <View>
              <Text style={{ color: "#9E7418", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>STROKE GAINED PUTTING REPORT</Text>
              <Text style={{ color: "#171C18", fontFamily: SERIF_FONT, fontSize: 24, fontWeight: "700", marginTop: 2 }}>
                パッティング診断レポート
              </Text>
            </View>
            <View style={{ alignItems: isWide ? "flex-end" : "flex-start" }}>
              <Text style={{ color: "#171C18", fontSize: 15, fontWeight: "800" }}>
                {`${profile?.name || "プレイヤー"}${profile?.handicap != null ? `（HC ${profile.handicap}）` : ""}`}
              </Text>
              <Text style={{ color: "#5E5A52", fontSize: 12, marginTop: 2 }}>
                {`対象: ${data.dateRange}（${data.scoped.length}R / ${data.sg.holes}H）・作成: ${issued}`}
              </Text>
            </View>
          </View>

          {data.sg.holes === 0 ? (
            <Text style={{ color: "#5E5A52", fontSize: 15, paddingVertical: 24, textAlign: "center" }}>
              選択した期間に分析できるラウンドデータがありません。
            </Text>
          ) : (
            <>
              {/* 1. 総合評価 */}
              <View style={{ flexDirection: isWide ? "row" : "column", gap: 14, backgroundColor: "#F6F4EE", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#E4DEC9" }}>
                <View style={{ flex: 1.1 }}>
                  <Text style={{ color: "#5E5A52", fontSize: 12, fontWeight: "700" }}>{`総合損得（${base.label}比）`}</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <Text style={{ color: data.sg.sgPer18 >= 0 ? "#2F78B5" : "#C96A14", fontSize: 38, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                      {formatStrokes(data.sg.sgPer18)}
                    </Text>
                    <Text style={{ color: "#171C18", fontSize: 14, fontWeight: "700" }}>打 / 18H</Text>
                  </View>
                  <Text style={{ color: "#3A3E3B", fontSize: 13, marginTop: 4 }}>
                    {`実際 ${data.sg.actualPer18.toFixed(1)} ＝ 距離の難しさ ${data.sg.expectedPer18.toFixed(1)} ${data.sg.sgPer18 <= 0 ? "+" : "−"} 腕前 ${Math.abs(data.sg.sgPer18).toFixed(1)}`}
                  </Text>
                </View>

                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <ReportKpi label="3パット / R" value={data.threePuttsPerRound.toFixed(1)} unit="回" />
                  <ReportKpi label="パーオン時パット" value={data.gir.holes > 0 ? data.gir.avg.toFixed(2) : "—"} />
                  <ReportKpi label="バーディ奪取" value={data.birdieConv != null ? `${data.birdieConv.toFixed(0)}%` : "—"} />
                  <ReportKpi label="パーセーブ" value={data.parSave != null ? `${data.parSave.toFixed(0)}%` : "—"} />
                </View>
              </View>

              {/* 2. 練習の優先順位トップ3 */}
              <View style={{ gap: 8 }}>
                <ReportHeading title="練習の優先順位（スコアが一番縮む順）" />
                {data.priorities.length === 0 ? (
                  <Text style={{ color: "#5E5A52", fontSize: 13 }}>目立って失っている分野はありません。</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {data.priorities.map((p, i) => (
                      <View
                        key={p.id}
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#E4DFD3",
                          backgroundColor: "#FCFBF8",
                        }}
                      >
                        <Text style={{ color: "#9E7418", fontFamily: SERIF_FONT, fontSize: 20, fontWeight: "700", width: 20, textAlign: "center" }}>
                          {i + 1}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <Text style={{ color: "#171C18", fontFamily: SERIF_FONT, fontSize: 15, fontWeight: "700" }}>{p.title}</Text>
                            <Text style={{ color: "#C96A14", fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{`${p.strokesPer18.toFixed(1)}打/R`}</Text>
                          </View>
                          <Text style={{ color: "#5E5A52", fontSize: 12, marginTop: 2 }}>{p.evidence}</Text>
                          <Text style={{ color: "#184228", fontSize: 12, fontWeight: "700", marginTop: 4 }}>{`練習：${p.drill}`}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* 3. 距離別損得 ＆ ライン別得意・苦手 */}
              <View style={{ flexDirection: isWide ? "row" : "column", gap: 16 }}>
                {/* 距離帯別 */}
                <View style={{ flex: 1, gap: 6 }}>
                  <ReportHeading title={`距離別の損得（${base.short}比）`} />
                  <View style={{ borderWidth: 1, borderColor: "#E4DFD3", borderRadius: 8, overflow: "hidden" }}>
                    {data.sg.byBand.map((b, idx) => (
                      <View
                        key={b.band.key}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: "#ECE8DE",
                        }}
                      >
                        <Text style={{ color: "#171C18", fontSize: 13, fontWeight: "700", flex: 1 }}>{b.band.label}</Text>
                        <Text style={{ color: "#5E5A52", fontSize: 12, width: 52, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${b.putts}打`}</Text>
                        <Text
                          style={{
                            color: b.sgPer18 >= 0 ? pal.gain : pal.loss,
                            fontSize: 14,
                            fontWeight: "800",
                            width: 68,
                            textAlign: "right",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {`${formatStrokes(b.sgPer18, 2)}打`}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {data.lag.attempts > 0 && (
                    <Text style={{ color: "#5E5A52", fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                      {`ロングパット（6m以上・${data.lag.attempts}回）：平均残り ${data.lag.avgLeave.toFixed(1)}m / 1m以内 ${data.lag.within1m.toFixed(0)}% / 3パット ${data.lag.threePuttRate.toFixed(0)}%${data.lag.shortRate != null ? ` / ショート率 ${data.lag.shortRate.toFixed(0)}%` : ""}`}
                    </Text>
                  )}
                </View>

                {/* ライン別3×3 */}
                <View style={{ flex: 1, gap: 6 }}>
                  <ReportHeading title="ライン別の損得（7m以内・1打あたり）" />
                  <View style={{ borderWidth: 1, borderColor: "#E4DFD3", borderRadius: 8, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", backgroundColor: "#F6F4EE", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#E4DFD3" }}>
                      <Text style={{ width: 46, fontSize: 11, color: "#5E5A52", textAlign: "center" }} />
                      {LR_KEYS.map((l) => (
                        <Text key={l} style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#5E5A52", textAlign: "center" }}>
                          {LR_LABEL[l]}
                        </Text>
                      ))}
                    </View>
                    {UD_KEYS.map((u, i) => (
                      <View key={u} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#ECE8DE" }}>
                        <Text style={{ width: 46, fontSize: 12, fontWeight: "700", color: "#5E5A52", textAlign: "center" }}>{UD_LABEL[u]}</Text>
                        {LR_KEYS.map((l) => {
                          const cell = data.lines.matrix[u][l];
                          return (
                            <View key={l} style={{ flex: 1, paddingVertical: 7, alignItems: "center" }}>
                              <Text
                                style={{
                                  color: cell.putts === 0 ? "#999" : cell.sgPerPutt >= 0 ? pal.gain : pal.loss,
                                  fontSize: 13,
                                  fontWeight: "800",
                                  fontVariant: ["tabular-nums"],
                                }}
                              >
                                {cell.putts > 0 ? formatStrokes(cell.sgPerPutt, 2) : "—"}
                              </Text>
                              <Text style={{ color: "#777", fontSize: 10 }}>{cell.putts > 0 ? `${cell.putts}回` : ""}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* 4. コーチ・次回ラウンド向けメモ欄 */}
              <View style={{ marginTop: 4, gap: 6 }}>
                <ReportHeading title="メモ・次のラウンドの課題" />
                {[0, 1, 2].map((n) => (
                  <View key={n} style={{ height: 24, borderBottomWidth: 1, borderBottomColor: "#DCD6C8" }} />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ReportHeading({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 3, height: 15, backgroundColor: "#184228", borderRadius: 2 }} />
      <Text style={{ color: "#171C18", fontFamily: SERIF_FONT, fontSize: 15, fontWeight: "700" }}>{title}</Text>
    </View>
  );
}

function ReportKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ minWidth: 96, flex: 1 }}>
      <Text style={{ color: "#5E5A52", fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 2 }}>
        <Text style={{ color: "#171C18", fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
        {unit ? <Text style={{ color: "#5E5A52", fontSize: 11, marginLeft: 2 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}
