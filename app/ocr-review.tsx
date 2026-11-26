/**
 * 読み取り結果の確認（カード v4）。
 * - カードごとに補正済みの画像と9ホールの読み取り結果を、カードと同じ2段の並びで表示する
 * - 「要確認」（二重読み・画素判定との食い違い）と記入ルールの矛盾を欄ごとに色で示す。直すか「このままでOK」で消える
 * - 「次の要確認へ」で要確認のあるホールだけを順に開いて見直せる
 * - 既存ラウンドに保存、またはカードの日付・コース名で新しいラウンドを作る
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { SERIF_FONT } from "@/constants/theme";
import { ErrorBanner } from "@/components/ui/error-banner";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { shadowPrimary, shadowSm } from "@/lib/card-shadow";
import { hapticSuccess } from "@/lib/haptics";
import { clearOcrSession, getOcrSession, type SideResult } from "@/lib/ocr-session";
import { CARD_H, CARD_W, holeNumberFor, LR_OPTIONS, MISS_OPTIONS, PUTT_FOR_OPTIONS, UD_OPTIONS, type CardSide } from "@/lib/scorecard/layout";
import { cardDateToYmd, rowHasData, rowToHole, validateRow, type OcrRow } from "@/lib/scorecard/ocr";
import { getPutters, getRounds, saveHolesForRound, saveRound } from "@/lib/storage";
import type { HoleData, Round } from "@/lib/types";

const CARD_ASPECT = CARD_W / CARD_H;
const LABEL = {
  puttFor: { E: "イーグル", Ba: "バーディ", P: "パー", Bo: "ボギー", "D+": "ダボ+" } as Record<string, string>,
  ud: { F: "平ら", U: "上り", D: "下り" } as Record<string, string>,
  lr: { S: "まっすぐ", L: "左へ", R: "右へ" } as Record<string, string>,
  miss: { short: "ショート", long: "オーバー" } as Record<string, string>,
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SHORT = {
  ud: { F: "平", U: "上", D: "下" } as Record<string, string>,
  lr: { S: "直", L: "左", R: "右" } as Record<string, string>,
  miss: { short: "短", long: "長" } as Record<string, string>,
};

/** 1パットぶんの要約（例 "8m 上・右・短"）。何も無ければ null */
function puttText(p: { meters: number | null; ud?: string | null; lr?: string | null; miss?: string | null }): string | null {
  const marks = [p.ud ? SHORT.ud[p.ud] : null, p.lr ? SHORT.lr[p.lr] : null, p.miss ? SHORT.miss[p.miss] : null].filter(Boolean);
  if (p.meters == null && marks.length === 0) return null;
  return [p.meters != null ? `${p.meters}m` : "?m", marks.join("・")].filter(Boolean).join(" ");
}

export default function OcrReviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width: screenW } = useWindowDimensions();
  const contentW = Math.min(screenW, 760) - 32;
  const session = useMemo(() => getOcrSession(), []);

  const [sides, setSides] = useState<SideResult[]>(session?.results ?? []);
  const [open, setOpen] = useState<string | null>(null);
  const [showImage, setShowImage] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(() => cardDateToYmd(session?.results.find((r) => r.side === "out")?.card.date ?? null) ?? todayYmd());
  const [course, setCourse] = useState(() => session?.results.find((r) => r.card.course)?.card.course ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** ホールの行の y 位置（ScrollView の中身の座標）。「次の要確認へ」でスクロールする先 */
  const rowY = useRef<Record<string, number>>({});
  const sideY = useRef<Record<string, number>>({});

  // 要確認のある最初の行を開いておく
  useEffect(() => {
    for (const s of sides) {
      const i = s.card.rows.findIndex((_, idx) => s.conflicts.some((c) => c.startsWith(`rows[${idx}]`)) || (s.warnings[idx]?.length ?? 0) > 0);
      if (i >= 0) {
        setOpen(`${s.side}-${i}`);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueCount = sides.reduce((n, s) => n + s.conflicts.length + Object.values(s.warnings).reduce((a, w) => a + w.length, 0), 0);
  /** 要確認のあるホールの id（上から順） */
  const issueRows = sides.flatMap((s) =>
    s.card.rows.flatMap((_, i) => (s.conflicts.some((c) => c.startsWith(`rows[${i}]`)) || (s.warnings[i]?.length ?? 0) > 0 ? [`${s.side}-${i}`] : [])),
  );
  /** 開いたあとでスクロールする先（開閉で位置がずれるので、描き直してから測る） */
  const scrollTarget = useRef<string | null>(null);
  const goNextIssue = () => {
    if (issueRows.length === 0) return;
    const at = open ? issueRows.indexOf(open) : -1;
    const next = issueRows[(at + 1) % issueRows.length];
    scrollTarget.current = next;
    setOpen(next);
  };
  useEffect(() => {
    const target = scrollTarget.current;
    if (!target || target !== open) return;
    const t = setTimeout(() => {
      const side = target.split("-")[0];
      const y = (sideY.current[side] ?? 0) + (rowY.current[target] ?? 0);
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      scrollTarget.current = null;
    }, 80);
    return () => clearTimeout(t);
  }, [open]);
  /** そのホールの要確認と警告を、直さずに消す（画像と見比べて合っていたとき） */
  const acceptRow = (side: CardSide, index: number) => {
    setSides((prev) =>
      prev.map((s) => {
        if (s.side !== side) return s;
        const warnings = { ...s.warnings };
        delete warnings[index];
        return { ...s, warnings, conflicts: s.conflicts.filter((c) => !c.startsWith(`rows[${index}]`)) };
      }),
    );
    if (open === `${side}-${index}`) setOpen(null);
  };
  const holes: HoleData[] = useMemo(
    () => sides.flatMap((s) => s.card.rows.flatMap((row, i) => (rowToHole(s.side, i, row) ? [rowToHole(s.side, i, row)!] : []))),
    [sides],
  );

  const editRow = (side: CardSide, index: number, path: string, fn: (r: OcrRow) => OcrRow) => {
    setSides((prev) =>
      prev.map((s) => {
        if (s.side !== side) return s;
        const rows = s.card.rows.map((r, i) => (i === index ? fn(r) : r));
        const warnings = { ...s.warnings };
        const w = validateRow(rows[index]);
        if (w.length) warnings[index] = w;
        else delete warnings[index];
        return { ...s, card: { ...s.card, rows }, warnings, conflicts: s.conflicts.filter((c) => c !== `rows[${index}].${path}`) };
      }),
    );
  };

  const save = async () => {
    if (holes.length === 0) {
      setError("保存できるホールがありません");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let roundId = session?.roundId;
      if (roundId) {
        await saveHolesForRound(roundId, holes);
      } else {
        const putters = await getPutters().catch(() => []);
        // 天気・グリーン・パターは保存のあとで入れてもらう。それまでは前回のラウンドの値を仮に使う
        const last = (await getRounds().catch(() => []))[0];
        const ace = putters.find((p) => p.id === last?.putterId) ?? putters.find((p) => p.ranking === "ace") ?? putters[0];
        const newRound: Omit<Round, "id" | "createdAt" | "updatedAt"> = {
          date,
          weather: "sunny",
          windSpeed: "calm",
          courseId: "",
          courseName: course.trim() || "未設定",
          frontNineGreen: "",
          backNineGreen: "",
          roundType: last?.roundType ?? "private",
          competitionFormat: last?.competitionFormat ?? "stroke",
          grassType: last?.grassType ?? "bent",
          stimpmeter: last?.stimpmeter ?? 9,
          greenCondition: "good",
          putterId: ace?.id ?? "",
          putterName: ace ? `${ace.brandName} ${ace.productName}` : "",
          holes,
          totalPutts: holes.reduce((s, h) => s + h.totalPutts, 0),
        };
        const created = await saveRound(newRound);
        roundId = created.id;
      }
      clearOcrSession();
      hapticSuccess();
      // 新しく作ったラウンドは、続けて天気・グリーン・パターを入れてもらう（「あとで」で飛ばせる）
      router.replace((session?.roundId ? `/round/${roundId}` : `/new-round?edit=${roundId}&after=scan`) as never);
    } catch (e) {
      setError(`保存に失敗しました（${e instanceof Error ? e.message : String(e)}）`);
    } finally {
      setSaving(false);
    }
  };

  if (!session || sides.length === 0) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>確認する読み取り結果がありません</Text>
        <Pressable onPress={() => router.replace("/scan-card" as never)} style={{ marginTop: 14, minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.primary, justifyContent: "center" }}>
          <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "800" }}>カードを撮影する</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="戻る" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: SERIF_FONT, fontSize: 19, fontWeight: "700", flex: 1 }}>読み取り結果の確認</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ alignItems: "center", paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentW, gap: 14, paddingTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: issueCount ? `${colors.warning}1A` : `${colors.success}1A` }}>
            <IconSymbol name={issueCount ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={22} color={issueCount ? colors.warning : colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 15, flex: 1, lineHeight: 21 }}>
              {issueCount
                ? `要確認が ${issueRows.length} ホールあります。黄色の欄をカードの画像と見比べ、直すか「このままでOK」を押してください。`
                : `${holes.length}ホールを読み取りました。念のため画像と見比べてから保存してください。`}
            </Text>
          </View>

          {!session.roundId && (
            <View style={[{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }, shadowSm]}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>新しいラウンドとして保存</Text>
              <LabeledInput label="日付" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
              <LabeledInput label="コース" value={course} onChange={setCourse} placeholder="コース名" />
              <Text style={{ color: colors.muted, fontSize: 13 }}>天気・グリーンの速さ・パターは、保存のあとに続けて入れられます（飛ばしても可）。</Text>
            </View>
          )}

          {sides.map((s) => {
            const key = s.side;
            return (
              <View key={key} style={{ gap: 8 }} onLayout={(e) => (sideY.current[key] = e.nativeEvent.layout.y)}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900" }}>{s.side === "out" ? "OUT（1〜9番）" : "IN（10〜18番）"}</Text>
                  {(s.preview || s.previewUri) && (
                    <Pressable onPress={() => setShowImage((v) => ({ ...v, [key]: !v[key] }))} style={{ minHeight: 44, justifyContent: "center" }}>
                      <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "800" }}>{showImage[key] ? "画像を閉じる" : "カードの画像を見る"}</Text>
                    </Pressable>
                  )}
                </View>
                {showImage[key] && (s.preview || s.previewUri) && (
                  <Image
                    source={{ uri: s.previewUri ?? `data:image/jpeg;base64,${s.preview}` }}
                    style={{ width: contentW, height: contentW / CARD_ASPECT, borderRadius: 12, backgroundColor: colors.surface }}
                    resizeMode="contain"
                    accessibilityLabel="補正済みのカード画像"
                  />
                )}
                {s.card.rows.map((row, i) => {
                  const id = `${key}-${i}`;
                  const flags = s.conflicts.filter((c) => c.startsWith(`rows[${i}]`)).map((c) => c.replace(`rows[${i}].`, ""));
                  const warns = s.warnings[i] ?? [];
                  const expanded = open === id;
                  const hasIssue = flags.length + warns.length > 0;
                  return (
                    <View
                      key={id}
                      onLayout={(e) => (rowY.current[id] = e.nativeEvent.layout.y)}
                      style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: hasIssue ? 2 : 1, borderColor: hasIssue ? colors.warning : colors.border, overflow: "hidden" }}
                    >
                      <Pressable
                        onPress={() => setOpen(expanded ? null : id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityLabel={`${holeNumberFor(s.side, i)}番ホール${hasIssue ? "、要確認あり" : ""}`}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 64 }}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900", width: 34, textAlign: "center" }}>{`${holeNumberFor(s.side, i)}`}</Text>
                        <CardRowView row={row} flags={flags} />
                        {hasIssue && <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />}
                        <IconSymbol name="chevron.down" size={20} color={colors.muted} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
                      </Pressable>
                      {expanded && (
                        <RowEditor
                          row={row}
                          flags={flags}
                          warnings={warns}
                          onEdit={(path, fn) => editRow(s.side, i, path, fn)}
                          onAccept={hasIssue ? () => acceptRow(s.side, i) : undefined}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
          {error && <ErrorBanner message={error} />}
        </View>
      </ScrollView>
      <View style={{ padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        {issueRows.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800", flex: 1 }}>{`要確認 あと ${issueRows.length} ホール`}</Text>
            <Pressable
              onPress={goNextIssue}
              accessibilityRole="button"
              style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center", backgroundColor: colors.warning }}
            >
              <Text style={{ color: "#1A1A1A", fontSize: 15, fontWeight: "900" }}>次の要確認へ</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          accessibilityRole="button"
          style={[{ minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }, shadowPrimary]}
        >
          <Text style={{ color: colors.onPrimary, fontSize: 17, fontWeight: "900" }}>{saving ? "保存中…" : `${holes.length}ホールを保存`}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "700", width: 56 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{ flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 16, color: colors.foreground, backgroundColor: colors.background }}
      />
    </View>
  );
}

/** 閉じた状態の1ホール。カードと同じ2段（上段: 何のパット・1st / 下段: 計・2nd・3rd）。要確認の欄は黄色 */
function CardRowView({ row, flags }: { row: OcrRow; flags: string[] }) {
  const colors = useColors();
  if (!rowHasData(row)) {
    return <Text style={{ color: colors.muted, fontSize: 15, flex: 1 }}>記入なし</Text>;
  }
  const flaggedAny = (prefix: string) => flags.some((f) => f === prefix || f.startsWith(`${prefix}.`));
  const Cell = ({ label, text, flagged, strong }: { label: string; text: string | null; flagged: boolean; strong?: boolean }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: flagged ? `${colors.warning}40` : "transparent",
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: text ? colors.foreground : colors.muted, fontSize: strong ? 15 : 14, fontWeight: strong ? "900" : "700" }}>{text ?? "—"}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Cell label="" text={row.puttFor ? LABEL.puttFor[row.puttFor] : null} flagged={flaggedAny("puttFor")} strong />
        <Cell label="1st" text={puttText(row.p1)} flagged={flaggedAny("p1")} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Cell label="計" text={row.total != null ? String(row.total) : null} flagged={flaggedAny("total")} strong />
        <Cell label="2nd" text={puttText(row.p2)} flagged={flaggedAny("p2")} />
        {(row.p3.meters != null || flaggedAny("p3")) && <Cell label="3rd" text={puttText(row.p3)} flagged={flaggedAny("p3")} />}
      </View>
    </View>
  );
}

function RowEditor({
  row,
  flags,
  warnings,
  onEdit,
  onAccept,
}: {
  row: OcrRow;
  flags: string[];
  warnings: string[];
  onEdit: (path: string, fn: (r: OcrRow) => OcrRow) => void;
  /** 要確認があるときだけ。押すとこのホールの要確認と警告を消す */
  onAccept?: () => void;
}) {
  const colors = useColors();
  const flagged = (p: string) => flags.includes(p);
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
      {warnings.map((w) => (
        <Text key={w} style={{ color: colors.foreground, fontSize: 14 }}>{`⚠ ${w}`}</Text>
      ))}
      {onAccept && (
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.success, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.success, fontSize: 15, fontWeight: "900" }}>画像と同じなので、このままでOK</Text>
        </Pressable>
      )}
      <Line label="何のパット" flagged={flagged("puttFor")}>
        <Pick options={PUTT_FOR_OPTIONS} labels={LABEL.puttFor} value={row.puttFor} onChange={(v) => onEdit("puttFor", (r) => ({ ...r, puttFor: v }))} />
      </Line>
      <Line label="計（総パット）" flagged={flagged("total")}>
        <Pick options={["0", "1", "2", "3", "4", "5"] as const} value={row.total == null ? null : String(row.total) as "0"} onChange={(v) => onEdit("total", (r) => ({ ...r, total: v == null ? null : Number(v) }))} />
      </Line>
      {(["p1", "p2", "p3"] as const).map((k, idx) => (
        <View key={k} style={{ gap: 8, paddingTop: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "900" }}>{["1st", "2nd", "3rd"][idx]}</Text>
          <Line label="距離 m" flagged={flagged(`${k}.meters`)}>
            <NumberBox
              value={row[k].meters}
              decimals={k !== "p1"}
              onChange={(m) => onEdit(`${k}.meters`, (r) => ({ ...r, [k]: { ...r[k], meters: m } }))}
            />
          </Line>
          {k !== "p3" && (
            <>
              <Line label="傾斜" flagged={flagged(`${k}.ud`)}>
                <Pick options={UD_OPTIONS} labels={LABEL.ud} value={row[k].ud} onChange={(v) => onEdit(`${k}.ud`, (r) => ({ ...r, [k]: { ...r[k], ud: v } }))} />
              </Line>
              <Line label="曲がり" flagged={flagged(`${k}.lr`)}>
                <Pick options={LR_OPTIONS} labels={LABEL.lr} value={row[k].lr} onChange={(v) => onEdit(`${k}.lr`, (r) => ({ ...r, [k]: { ...r[k], lr: v } }))} />
              </Line>
            </>
          )}
          {k === "p1" && (
            <Line label="外れ" flagged={flagged("p1.miss")}>
              <Pick options={MISS_OPTIONS} labels={LABEL.miss} value={row.p1.miss ?? null} onChange={(v) => onEdit("p1.miss", (r) => ({ ...r, p1: { ...r.p1, miss: v } }))} />
            </Line>
          )}
        </View>
      ))}
    </View>
  );
}

function Line({ label, flagged, children }: { label: string; flagged: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6, padding: flagged ? 8 : 0, borderRadius: 10, backgroundColor: flagged ? `${colors.warning}22` : "transparent" }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{flagged ? `${label}（要確認）` : label}</Text>
      {children}
    </View>
  );
}

function Pick<T extends string>({ options, labels, value, onChange }: { options: readonly T[]; labels?: Record<string, string>; value: T | null; onChange: (v: T | null) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(active ? null : o)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flexGrow: 1, minWidth: 40, minHeight: 42, paddingHorizontal: 8, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
          >
            <Text style={{ color: active ? colors.onPrimary : colors.foreground, fontSize: 15, fontWeight: "800" }}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberBox({ value, decimals, onChange }: { value: number | null; decimals: boolean; onChange: (v: number | null) => void }) {
  const colors = useColors();
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(/[^0-9.]/g, "");
        setText(clean);
        const n = Number(clean);
        onChange(clean && Number.isFinite(n) && n > 0 ? (decimals ? Math.round(n * 10) / 10 : Math.round(n)) : null);
      }}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder="空欄"
      placeholderTextColor={colors.muted}
      style={{ width: 120, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 18, fontWeight: "800", color: colors.foreground, backgroundColor: colors.background }}
    />
  );
}
