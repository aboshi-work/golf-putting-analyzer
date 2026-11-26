// ホーム画面（ネイティブアプリ調ダッシュボード）。
//  - 3D グリーンのヒーローに「直近5Rの調子」を重ねる
//  - クイック操作（撮影・印刷）をコンパクトに置き、中央＋タブからいつでも記録開始できる
//  - いちばんの伸びしろと最近のラウンドを枠線レスカードで見せる
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { GreenScene } from "@/components/green/green-scene";
import { STAGE } from "@/components/green/green-types";
import { useDivergingColors } from "@/components/analysis/charts";
import { Card, formatStrokes } from "@/components/analysis/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { shadowSm } from "@/lib/card-shadow";
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
  onScan,
  onPrintCard,
  onOpenAnalytics,
  onOpenRounds,
  onOpenRound,
}: Props) {
  const colors = useColors();
  const pal = useDivergingColors();
  const { width: rawW } = useWindowDimensions();
  const screenW = rawW > 0 ? rawW : 390;
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
  const heroH = Math.min(310, Math.max(252, contentW * 0.66));
  const hasData = stats.recent.holes > 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 112, alignItems: "center" }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={{ width: contentW, gap: 16, paddingTop: 10 }}>
        {pendingSaves > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: `${colors.warning}1A`,
              borderRadius: 16,
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
        <View style={{ borderRadius: 26, overflow: "hidden", backgroundColor: STAGE.bgBottom }}>
          <GreenScene mode="hero" height={heroH} radius={0} accessibilityLabel="グリーン上でボールが曲がりながらカップに入るアニメーション" />
          <View pointerEvents="none" style={{ position: "absolute", left: 22, top: 20, maxWidth: "70%" }}>
            <Text style={{ color: STAGE.textMuted, fontSize: 13, fontWeight: "700" }}>{greeting}</Text>
            <Text
              style={{
                color: STAGE.text,
                fontSize: 26,
                fontWeight: "900",
                marginTop: 2,
                letterSpacing: -0.5,
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
              borderRadius: 18,
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

        {/* ─── クイックアクション（中央＋ボタンからも全機能を開ける） ─── */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <QuickAction icon="camera.fill" title="カードを撮影" note="OUT / IN 2枚" onPress={onScan} />
          <QuickAction icon="printer.fill" title="カードを印刷" note="A4 二つ折り" onPress={onPrintCard} />
        </View>

        {/* ─── 今の練習テーマ ─── */}
        {stats.top && (
          <Pressable
            onPress={onOpenAnalytics}
            accessibilityRole="button"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
          >
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>いちばんの伸びしろ</Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: "900", letterSpacing: -0.4, marginTop: 8 }}>
                {stats.top.title}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 15, marginTop: 6, lineHeight: 23 }}>
                {`1ラウンドあたり約${stats.top.strokesPer18.toFixed(1)}打。${stats.top.evidence}`}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800", marginTop: 12 }}>
                練習メニューと詳しい分析 →
              </Text>
            </Card>
          </Pressable>
        )}

        {/* ─── 最近のラウンド ─── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
            <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }}>
              最近のラウンド
            </Text>
            {played.length > 3 && (
              <Pressable onPress={onOpenRounds} hitSlop={8} style={{ minHeight: 36, justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>すべて見る →</Text>
              </Pressable>
            )}
          </View>

          {rounds.length === 0 ? (
            <Card style={{ alignItems: "center", paddingVertical: 28 }}>
              <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 17 }}>まだラウンドがありません</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 21 }}>
                下の「＋」ボタンからカードを印刷・撮影して始めましょう
              </Text>
            </Card>
          ) : (
            <Card padded={false}>
              {rounds.slice(0, 3).map((r, idx) => {
                const s = stats.bySg.get(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onOpenRound(r.id)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: 15,
                      paddingHorizontal: 18,
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
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", lineHeight: 22 }}>
                        {r.courseName}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                        {s ? `${s.putts}パット・${s.holes}H・3パット${s.threePutts}回` : "未入力"}
                      </Text>
                    </View>
                    {s && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: s.sgPer18 >= 0 ? pal.gain : pal.loss, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                          {formatStrokes(s.sgPer18)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>打/R</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </Card>
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
        <Text style={{ color: STAGE.text, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text>
        {unit ? <Text style={{ color: STAGE.textMuted, fontSize: 12, fontWeight: "600", marginLeft: 3 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function QuickAction({ icon, title, note, onPress }: { icon: "camera.fill" | "printer.fill"; title: string; note: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        shadowSm,
      ]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${colors.primary}16`, alignItems: "center", justifyContent: "center" }}>
        <IconSymbol name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{note}</Text>
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
        height: 46,
        borderRadius: 14,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{`${d.getMonth() + 1}月`}</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900", marginTop: -2, fontVariant: ["tabular-nums"] }}>
        {d.getDate()}
      </Text>
    </View>
  );
}
