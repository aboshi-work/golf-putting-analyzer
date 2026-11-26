import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { SERIF_FONT } from "@/constants/theme";
import { ScreenContainer } from "@/components/screen-container";
import { useDivergingColors } from "@/components/analysis/charts";
import { Chip, formatStrokes } from "@/components/analysis/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBaseline } from "@/hooks/use-baseline";
import { shadowSm } from "@/lib/card-shadow";
import { BASELINES, holeObservations, roundSgSeries, sgSummary } from "@/lib/putting-stats";
import { getRoundsWithHoles, getUserProfile, syncPendingHoleSaves } from "@/lib/storage";
import { LABELS, type Round, countPlayedHoles } from "@/lib/types";

export default function RoundsScreen() {
  const router = useRouter();
  const colors = useColors();
  const pal = useDivergingColors();
  const { width: rawScreenW } = useWindowDimensions();
  const contentW = Math.min(rawScreenW > 0 ? rawScreenW : 390, 760) - 32;

  const [rounds, setRounds] = useState<Round[]>([]);
  const [handicap, setHandicap] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [baseline] = useBaseline(handicap);

  const loadRounds = useCallback(async () => {
    await syncPendingHoleSaves().catch(() => undefined);
    const [data, profile] = await Promise.all([
      getRoundsWithHoles(),
      getUserProfile().catch(() => null),
    ]);
    setRounds(data);
    setHandicap(profile?.handicap ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRounds().finally(() => setLoading(false));
    }, [loadRounds]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRounds();
    setRefreshing(false);
  }, [loadRounds]);

  const courses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rounds) {
      if (r.courseName) counts.set(r.courseName, (counts.get(r.courseName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [rounds]);

  const hasCompetition = useMemo(
    () => rounds.some((r) => r.roundType === "competition" || r.roundType === "club_competition"),
    [rounds],
  );

  const filtered = useMemo(() => {
    if (courseFilter === "all") return rounds;
    if (courseFilter === "__comp__") {
      return rounds.filter((r) => r.roundType === "competition" || r.roundType === "club_competition");
    }
    return rounds.filter((r) => r.courseName === courseFilter);
  }, [rounds, courseFilter]);

  const stats = useMemo(() => {
    const holes = holeObservations(filtered, baseline);
    const series = roundSgSeries(holes);
    const bySg = new Map(series.map((s) => [s.roundId, s]));
    const summary = sgSummary(holes);
    return { bySg, summary };
  }, [filtered, baseline]);

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ alignItems: "center", paddingBottom: 112 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={{ width: contentW, gap: 16, paddingTop: 12 }}>
          {/* ヘッダー */}
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>
              ラウンド履歴
            </Text>
            {rounds.length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {`${filtered.length}ラウンド`}
              </Text>
            )}
          </View>

          {rounds.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: colors.border, alignItems: "center", marginTop: 12 }}>
              <IconSymbol name="flag.fill" size={40} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 18, fontWeight: "700", marginTop: 12 }}>
                ラウンドデータがありません
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 21 }}>
                右上の「記録する」から新しいラウンドを追加できます
              </Text>
            </View>
          ) : (
            <>
              {/* 絞り込み */}
              {(courses.length > 1 || hasCompetition) && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
                  <Chip label={`すべて（${rounds.length}）`} selected={courseFilter === "all"} onPress={() => setCourseFilter("all")} />
                  {hasCompetition && (
                    <Chip label="競技・月例" selected={courseFilter === "__comp__"} onPress={() => setCourseFilter("__comp__")} />
                  )}
                  {courses.map((c) => (
                    <Chip key={c} label={c} selected={courseFilter === c} onPress={() => setCourseFilter(c)} />
                  ))}
                </ScrollView>
              )}

              {/* サマリー帯 */}
              {stats.summary.holes > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                    {`${filtered.length}ラウンド集計（${BASELINES[baseline].short}比）`}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                      {`平均 ${stats.summary.actualPer18.toFixed(1)} パット/R`}
                    </Text>
                    <Text
                      style={{
                        color: stats.summary.sgPer18 >= 0 ? pal.gain : pal.loss,
                        fontSize: 15,
                        fontWeight: "800",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {`${formatStrokes(stats.summary.sgPer18)} 打/R`}
                    </Text>
                  </View>
                </View>
              )}

              {/* スコアブック風の一覧 */}
              <View style={[{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, shadowSm]}>
                {filtered.map((item, idx) => {
                  const s = stats.bySg.get(item.id);
                  const played = countPlayedHoles(item);
                  const d = new Date(`${item.date.split("T")[0]}T00:00:00`);
                  const meta = [
                    LABELS.grassType[item.grassType],
                    item.stimpmeter ? `${item.stimpmeter}ft` : null,
                    LABELS.weather[item.weather],
                    item.putterName || null,
                  ]
                    .filter(Boolean)
                    .join("・");

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/round/${item.id}` as never)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: pressed ? colors.background : "transparent",
                      })}
                    >
                      <View
                        style={{
                          width: 42,
                          paddingRight: 10,
                          borderRightWidth: 1,
                          borderRightColor: colors.border,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                          {`${d.getMonth() + 1}月`}
                        </Text>
                        <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                          {d.getDate()}
                        </Text>
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 16, fontWeight: "700", lineHeight: 22 }}>
                          {item.courseName}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                          {s ? `${s.putts}パット（${s.holes}H）・3パット${s.threePutts}回` : played > 0 ? `${item.totalPutts}パット（${played}H）` : "未入力"}
                        </Text>
                        {meta ? (
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                            {meta}
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ alignItems: "flex-end", minWidth: 52 }}>
                        {s ? (
                          <>
                            <Text style={{ color: s.sgPer18 >= 0 ? pal.gain : pal.loss, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                              {formatStrokes(s.sgPer18)}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>打/R</Text>
                          </>
                        ) : (
                          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
                            {played > 0 ? `${item.totalPutts}打` : "未入力"}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
