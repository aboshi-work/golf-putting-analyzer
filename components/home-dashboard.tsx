// ホーム画面の表示専用コンポーネント（データ取得は app/(tabs)/index.tsx）。
//  - 3D グリーンのヒーロー（ボールが曲がって入る）に「最近の調子」を重ねる
//  - 主役の CTA は「ラウンドを記録」。カード撮影・印刷にもすぐ行ける
//  - 今いちばん伸びしろのある練習テーマと、最近のラウンド（1ラウンドの損得つき）
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { SERIF_FONT } from "@/constants/theme";
import { GreenScene } from "@/components/green/green-scene";
import { STAGE } from "@/components/green/green-types";
import { useDivergingColors } from "@/components/analysis/charts";
import { formatStrokes } from "@/components/analysis/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { shadowPrimary, shadowSm } from "@/lib/card-shadow";
import {
  BASELINES,
  holeObservations,
  practicePriorities,
  roundSgSeries,
  sgSummary,
  type BaselineId,
} from "@/lib/putting-stats";
import { Round, UserProfile } from "@/lib/types";

type Props = {
  rounds: Round[];
  profile: UserProfile | null;
  baseline: BaselineId;
  isDemo?: boolean;
  /** オフラインで端末に保留中のホール保存件数（ラウンド単位） */
  pendingSaves?: number;
  refreshing: boolean;
  onRefresh: () => void;
  onNewRound: () => void;
  onScan: () => void;
  onPrintCard: () => void;
  onOpenAnalytics: () => void;
  onOpenRounds: () => void;
  onOpenRound: (id: string) => void;
  onExitDemo?: () => void;
};

export function HomeDashboard({
  rounds,
  profile,
  baseline,
  pendingSaves = 0,
  refreshing,
  onRefresh,
  onNewRound,
  onScan,
  onPrintCard,
  onOpenAnalytics,
  onOpenRounds,
  onOpenRound,
}: Props) {
  const colors = useColors();
  const pal = useDivergingColors();
  const { width: screenW } = useWindowDimensions();
  const contentW = Math.min(screenW, 760) - 32;

  const played = useMemo(
    () => rounds.filter((r) => r.holes.some((h) => h.totalPutts > 0)).sort((a, b) => b.date.localeCompare(a.date)),
    [rounds],
  );
  const stats = useMemo(() => {
    const recent = played.slice(0, 5);
    const holes = holeObservations(recent, baseline);
    const all = holeObservations(played, baseline);
    const series = roundSgSeries(all);
    const bySg = new Map(series.map((s) => [s.roundId, s]));
    return {
      recent: sgSummary(holes),
      threePuttsPerRound: holes.length ? (holes.filter((h) => h.total >= 3).length / holes.length) * 18 : 0,
      top: practicePriorities(all, baseline)[0] ?? null,
      bySg,
    };
  }, [played, baseline]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";
  const name = profile?.name ? `${profile.name}さん` : "ようこそ";
  const heroH = Math.min(320, Math.max(256, contentW * 0.68));
  const hasData = stats.recent.holes > 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 36, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={{ width: contentW, gap: 18, paddingTop: 14 }}>
        {pendingSaves > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: `${colors.warning}1A`,
              borderColor: `${colors.warning}55`,
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <IconSymbol name="flag.fill" size={18} color={colors.warning} />
            <Text style={{ color: colors.foreground, fontSize: 14, flex: 1, lineHeight: 20 }}>
              {`未送信の入力が${pendingSaves}ラウンド分あります。接続が戻ると自動で送信します（下に引いて再試行）。`}
            </Text>
          </View>
        )}

        {/* ─── ヒーロー: 3D グリーン ─── */}
        <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: STAGE.bgBottom }}>
          <GreenScene mode="hero" height={heroH} radius={0} accessibilityLabel="グリーン上でボールが曲がりながらカップに入るアニメーション" />
          <View pointerEvents="none" style={{ position: "absolute", left: 22, top: 20, maxWidth: "70%" }}>
            <Text style={{ color: STAGE.textMuted, fontSize: 13, fontWeight: "600", letterSpacing: 0.4 }}>{greeting}</Text>
            <Text
              style={{
                color: STAGE.text,
                fontFamily: SERIF_FONT,
                fontSize: 26,
                fontWeight: "700",
                marginTop: 4,
                letterSpacing: 0.3,
              }}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 14,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: "rgba(7,19,12,0.78)",
              borderWidth: 1,
              borderColor: "rgba(243,239,228,0.12)",
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 14,
            }}
          >
            {hasData ? (
              <>
                <HeroStat label={`直近5Rの損得（${BASELINES[baseline].short}比）`} value={formatStrokes(stats.recent.sgPer18)} unit="打/R" flex={1.45} />
                <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(243,239,228,0.14)" }} />
                <HeroStat label="パット/R" value={stats.recent.actualPer18.toFixed(1)} />
                <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(243,239,228,0.14)" }} />
                <HeroStat label="3パット/R" value={stats.threePuttsPerRound.toFixed(1)} />
              </>
            ) : (
              <Text style={{ color: STAGE.text, fontSize: 15, lineHeight: 22, flex: 1 }}>
                カードに記録して撮影するだけ。どの距離で何打失っているかが分かります。
              </Text>
            )}
          </View>
        </View>

        {/* ─── 主アクション ─── */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={onNewRound}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 16,
                paddingHorizontal: 18,
                flexDirection: "row",
                alignItems: "center",
                opacity: pressed ? 0.9 : 1,
              },
              shadowPrimary,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onPrimary, fontFamily: SERIF_FONT, fontWeight: "700", fontSize: 19, letterSpacing: 0.3 }}>
                ラウンドを記録
              </Text>
              <Text style={{ color: colors.onPrimary, opacity: 0.85, fontSize: 13, marginTop: 3 }}>
                カードの撮影・手入力・ラウンド情報
              </Text>
            </View>
            <IconSymbol name="arrow.right" size={20} color={colors.onPrimary} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SubAction icon="camera.fill" title="カードを撮影" note="OUT と IN の2枚" onPress={onScan} />
            <SubAction icon="printer.fill" title="カードを印刷" note="A4 2枚・二つ折り" onPress={onPrintCard} />
          </View>
        </View>

        {/* ─── 今の練習テーマ ─── */}
        {stats.top && (
          <Pressable onPress={onOpenAnalytics} accessibilityRole="button">
            <View
              style={[
                {
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accent,
                },
                shadowSm,
              ]}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 }}>
                いちばんの伸びしろ
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 21, fontWeight: "700", marginTop: 6 }}>
                {stats.top.title}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 16, marginTop: 6, lineHeight: 24 }}>
                {`1ラウンドあたり約${stats.top.strokesPer18.toFixed(1)}打。${stats.top.evidence}`}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800", marginTop: 12 }}>
                練習メニューと詳しい分析 →
              </Text>
            </View>
          </Pressable>
        )}

        {/* ─── 最近のラウンド ─── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
            <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 20, fontWeight: "700" }}>
              最近のラウンド
            </Text>
            {played.length > 3 && (
              <Pressable onPress={onOpenRounds} hitSlop={8} style={{ minHeight: 36, justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>すべて見る →</Text>
              </Pressable>
            )}
          </View>

          {rounds.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontWeight: "700", fontSize: 17 }}>まだラウンドがありません</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 21 }}>
                カードを印刷して次のラウンドに持って行きましょう
              </Text>
            </View>
          ) : (
            <View style={[{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, shadowSm]}>
              {rounds.slice(0, 3).map((r, idx) => {
                const s = stats.bySg.get(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onOpenRound(r.id)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      backgroundColor: pressed ? colors.background : "transparent",
                    })}
                  >
                    <DateColumn date={r.date} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 16, fontWeight: "700", lineHeight: 22 }}>
                        {r.courseName}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                        {s ? `${s.putts}パット・${s.holes}H・3パット${s.threePutts}回` : "未入力"}
                      </Text>
                    </View>
                    {s && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: s.sgPer18 >= 0 ? pal.gain : pal.loss, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                          {formatStrokes(s.sgPer18)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>打/R</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function HeroStat({ label, value, unit, flex = 1 }: { label: string; value: string; unit?: string; flex?: number }) {
  return (
    <View style={{ flex }}>
      <Text style={{ color: STAGE.textMuted, fontSize: 12, fontWeight: "600" }} numberOfLines={2}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 3 }}>
        <Text style={{ color: STAGE.text, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
        {unit ? <Text style={{ color: STAGE.textMuted, fontSize: 12, fontWeight: "600", marginLeft: 3 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function SubAction({ icon, title, note, onPress }: { icon: "camera.fill" | "printer.fill"; title: string; note: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.85 : 1,
        },
        shadowSm,
      ]}
    >
      <IconSymbol name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{note}</Text>
      </View>
    </Pressable>
  );
}

function DateColumn({ date }: { date: string }) {
  const colors = useColors();
  const d = new Date(`${date}T00:00:00`);
  return (
    <View
      style={{
        width: 46,
        paddingRight: 12,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{`${d.getMonth() + 1}月`}</Text>
      <Text style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
        {d.getDate()}
      </Text>
    </View>
  );
}
