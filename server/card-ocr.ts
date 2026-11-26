/**
 * パッティングカード v4 の読み取り（サーバー）。
 *
 * 精度を上げる仕組み:
 *  1. サーバーで四隅マーク → 向き（0/90/180/270°）→ 台形補正（どの端末の写真でも同じ処理）
 *  2. チェック枠はすべて画素で判定し、LLM の読みより優先する
 *  3. 数字枠のインク有無を画素で測り、「空欄の枠」「記入のある枠」を LLM に伝える＋捏造を除去
 *  4. カード全体に加えて「列見出し＋その行」の切り抜きを9枚送り、行ずれ（隣の行の値を読む）を防ぐ
 *  5. 記入済みカードと正解 JSON のお手本（few-shot）を同送
 *  6. responseSchema で型・列挙値を強制
 *  7. 別モデルで二重読みし、食い違いを「要確認」に
 *  8. 行ごとの整合性チェック（計とパット数、距離の大小など）
 *  四隅の■が見つからない写真は読まずに撮り直しを求める（推測で保存させない）
 */
import { invokeLLM, type Message, type MessageContent } from "./_core/llm";
import { ENV } from "./_core/env";
import { prepareCardFromJpeg } from "./_core/card-image";
import { FEWSHOT_ANSWER, FEWSHOT_BASE64, FEWSHOT_MIME } from "./_core/card-fewshot";
import { holeNumberFor, type CardSide } from "../lib/scorecard/layout";
import {
  applyCardHints,
  compareOcrCards,
  isPixelDecided,
  marksToHints,
  normalizeOcrCard,
  validateRow,
  type CardHints,
  type OcrCard,
} from "../lib/scorecard/ocr";

// AI の思考量。チェック欄は画素判定で確定するので、主に数字を読むだけなら minimal で足りる。
// 評価（scripts/scorecard/eval-ocr.ts）: minimal 275/275・1枚 30〜43 秒、low でも 89 秒かかり Vercel の上限を超えた
const OCR_THINKING = (["minimal", "low", "medium", "high"].includes(process.env.OCR_THINKING ?? "") ? process.env.OCR_THINKING : "minimal") as
  | "minimal"
  | "low"
  | "medium"
  | "high";

/** 1回の読み（1モデル）の上限。Vercel の関数の上限（300秒）より十分短く */
const OCR_PASS_TIMEOUT_MS = Number(process.env.OCR_PASS_TIMEOUT_MS ?? 60000);

const PUTT_SCHEMA = (withMiss: boolean, decimal: boolean) => ({
  type: "object",
  properties: {
    meters: {
      type: decimal ? "number" : "integer",
      nullable: true,
      description: decimal ? "距離(m)。整数部と小数部の2枠。例 [1][5] → 1.5、[ ][5] → 0.5。空欄は null" : "距離(m)。2枠の整数。空欄は null",
    },
    ud: { type: "string", enum: ["F", "U", "D"], nullable: true, description: "平=F 上=U 下=D の枠のどれに印があるか" },
    lr: { type: "string", enum: ["S", "L", "R"], nullable: true, description: "直=S 左=L 右=R の枠のどれに印があるか" },
    ...(withMiss ? { miss: { type: "string", enum: ["short", "long"], nullable: true, description: "短=short 長=long" } } : {}),
  },
  required: ["meters", "ud", "lr", ...(withMiss ? ["miss"] : [])],
});

const ROW_SCHEMA = {
  type: "object",
  properties: {
    row: { type: "integer", description: "上から何行目か（1〜9）" },
    puttFor: { type: "string", enum: ["E", "Ba", "P", "Bo", "D+"], nullable: true },
    p1: PUTT_SCHEMA(true, false),
    p2: PUTT_SCHEMA(false, true),
    p3: {
      type: "object",
      properties: { meters: { type: "number", nullable: true } },
      required: ["meters"],
    },
    total: { type: "integer", nullable: true, description: "「計」欄の手書き数字（総パット数）" },
  },
  required: ["row", "puttFor", "p1", "p2", "p3", "total"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    side: { type: "string", enum: ["OUT", "IN"], nullable: true },
    date: { type: "string", nullable: true, description: "日付欄 MMDD の4桁。空欄は null" },
    course: { type: "string", nullable: true },
    rows: { type: "array", items: ROW_SCHEMA, minItems: 9, maxItems: 9 },
  },
  required: ["side", "date", "course", "rows"],
};

const SYSTEM_PROMPT = `あなたはゴルフの「パッティングカード v4」を読み取る専門の OCR です。

## カードの構造（開いた状態の縦長1枚・9ホール）
- OUT カード（1〜9番）と IN カード（10〜18番）がある。どちらも上半分に5ホール、下半分（折り線の下）に4ホール。
- 1ホールは2段。左端に印刷されたホール番号が2段ぶんの高さで入っている。
  - 上段（「1st」）: 何のパット？の5つの□ E / Ba / P / Bo / D+（1打目のパットが入れば何のスコアか）
    → 1st の距離 m（2枠・整数）→ 傾斜 平/上/下 の3□ → 曲がり 直/左/右 の3□ → 外れ 短/長 の2□
  - 下段（「2nd」）: 計（1枠・そのホールの総パット数。「何のパット」の下）
    → 2nd の距離 m（整数部□ ・ 小数部□。1st の距離の真下）→ 傾斜 平/上/下 → 曲がり 直/左/右（1st の真下）
    → 3rd の距離 m（整数部□ ・ 小数部□。「外れ」の下、「3rd」と印刷）
- 上端: 日付（MM / DD の4枠。OUT カードのみ）とコース名（手書き）。
- 出力の rows は上から順に9ホールぶん（上半分の5行 → 下半分の4行）。

## 読み方
- 選択肢の□は「どの位置の枠に手書きの印（✓・塗りつぶし・×・斜線・○囲み）があるか」で判定。ラベル文字は印刷物で記入ではない。
- 数字は1枠1字の手書き。2nd/3rd は整数部と小数部を合わせて小数1桁の数にする（[1][5]→1.5、[0][8]→0.8、[2][ ]→2）。
- 1ホール（2段）の全項目を同じホールから読むこと。隣のホールの値を混ぜない。上段と下段を取り違えない。行の切り抜き画像（1ホールぶん）があるときはそれを優先して見る。
- 何も書かれていない枠・行は null。推測で埋めない（迷ったら null）。
- 1 と 7、4 と 9、3 と 8、5 と 6、0 と 6 の取り違えに注意。距離は 1st が最も長く 2nd、3rd と短くなるのが普通。
- 計は記入されたパット数と一致するのが普通（1st だけ記入→1、2nd まで→2、3rd まで→3。4以上もありうる）。`;

function hintLine(i: number, side: CardSide | null, hints: CardHints): string {
  const r = hints.rows[i];
  const cell = (c: boolean | "unsure") => (c === true ? "記入" : c === false ? "空" : "?");
  const hole = side ? `${holeNumberFor(side, i)}番` : `${i + 1}行目`;
  return `${i + 1}行目(${hole}): 1st距離[${r.p1.dist.map(cell).join(",")}] 2nd距離[${r.p2.dist.map(cell).join(",")}] 3rd距離[${r.p3.dist.map(cell).join(",")}] 計[${cell(r.total)}]`;
}

function image(base64: string, mime = "image/jpeg"): MessageContent {
  return { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } };
}

export type AnalyzeCardInput = {
  base64: string;
  mimeType?: string;
  /** 利用者が撮影画面で選んだ面（画素判定で分からないときに使う） */
  sideHint?: CardSide;
};

export type AnalyzeCardResult = {
  success: boolean;
  /** 読み取れなかった理由（markers_not_found = 四隅の■が見つからない → 撮り直し） */
  reason?: "markers_not_found" | "unreadable";
  card: OcrCard | null;
  side: CardSide | null;
  conflicts: string[];
  /** 行 index → 警告 */
  warnings: Record<number, string[]>;
  /** 確認画面に出す補正済み画像（JPEG base64）。補正できなければ null */
  preview: string | null;
  meta: {
    rectified: boolean;
    rotation: number | null;
    blurry: boolean;
    models: string[];
    verified: boolean;
  };
};

export async function analyzeCard(input: AnalyzeCardInput): Promise<AnalyzeCardResult> {
  const { card: prepared } = prepareCardFromJpeg(input.base64);
  // 四隅の■で位置を確定できない写真は読まない。
  // 補正なしで LLM だけに読ませると、斜めの写真ではチェック欄の半分近くを取り違え、しかも「要確認」に出ない（評価で確認済み）。
  if (!prepared) {
    return {
      success: false,
      reason: "markers_not_found",
      card: null,
      side: input.sideHint ?? null,
      conflicts: [],
      warnings: {},
      preview: null,
      meta: { rectified: false, rotation: null, blurry: false, models: [], verified: false },
    };
  }
  const hints = marksToHints(prepared.processed.marks);
  const side: CardSide | null = hints.side ?? input.sideHint ?? null;

  const fewshot: Message[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "お手本です。この記入済みカード（OUT カード・補正済み）を読み取ってください。" },
        image(FEWSHOT_BASE64, FEWSHOT_MIME),
      ],
    },
    {
      role: "assistant",
      content: JSON.stringify({
        side: "OUT",
        date: FEWSHOT_ANSWER.date,
        course: FEWSHOT_ANSWER.course,
        rows: FEWSHOT_ANSWER.rows.map((r, i) => ({ row: i + 1, ...r })),
      }),
    },
  ];

  const parts: MessageContent[] = [
    {
      type: "text",
      text:
        `次のカードを読み取ってください。四隅の■で正面・正しい向きに補正済みです。${side === "in" ? "IN カード（10〜18番）" : side === "out" ? "OUT カード（1〜9番）" : "OUT / IN は不明"}。\n` +
        "画素の測定で分かった数字枠の記入状況（空＝何も書かれていない）:\n" +
        hints.rows.map((_, i) => hintLine(i, side, hints)).join("\n"),
    },
    image(prepared.fullBase64),
  ];
  prepared.rowBase64.forEach((b64, i) => {
    parts.push({ type: "text", text: `${i + 1}ホール目の切り抜き（上は列見出し。2段で1ホール）:` });
    parts.push(image(b64));
  });

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }, ...fewshot, { role: "user", content: parts }];

  const runPass = async (model?: string): Promise<OcrCard | null> => {
    const t0 = Date.now();
    const response = await invokeLLM({
      messages,
      model,
      responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      thinkingLevel: OCR_THINKING,
      thinkingBudget: OCR_THINKING === "high" ? 4096 : 1024,
    });
    // 所要時間の内訳を Vercel のログで追えるようにする（maxDuration 超過の調査用）
    // 料金の見積もり用にトークン数も出す（思考ぶんは total − 入力 − 出力。思考も出力単価で課金される）
    const u = response.usage;
    const thoughts = u ? Math.max(0, u.total_tokens - u.prompt_tokens - u.completion_tokens) : 0;
    console.log(
      `[ocr] ${model ?? ENV.geminiModel} thinking=${OCR_THINKING} ${((Date.now() - t0) / 1000).toFixed(1)}s` +
        (u ? ` tokens in=${u.prompt_tokens} out=${u.completion_tokens} thoughts=${thoughts}` : ""),
    );
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    try {
      return normalizeOcrCard(JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)));
    } catch {
      return null;
    }
  };

  const verifyModel = ENV.ocrVerifyModel && ENV.ocrVerifyModel !== ENV.geminiModel ? ENV.ocrVerifyModel : null;
  // 片方のモデルが混雑（503）で再試行を続けても全体が待たされないよう、1回の読みに上限を付ける。
  // 上限を超えた側は失敗扱いにし、もう片方の読みで続ける（両方失敗ならエラー）。
  const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${OCR_PASS_TIMEOUT_MS / 1000}s`)), OCR_PASS_TIMEOUT_MS)),
    ]);
  const [primaryResult, verifyResult] = await Promise.allSettled([
    withTimeout(runPass(), "primary"),
    verifyModel ? withTimeout(runPass(verifyModel), "verify") : Promise.resolve(null),
  ]);
  // 片方が失敗しても読み取りは続けるが、原因を追えるようにログへ残す
  for (const [label, r] of [["primary", primaryResult], ["verify", verifyResult]] as const) {
    if (r.status === "rejected") console.warn(`[ocr] ${label} pass failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }
  const primary = primaryResult.status === "fulfilled" ? primaryResult.value : null;
  const verify = verifyResult.status === "fulfilled" ? verifyResult.value : null;
  if (primaryResult.status === "rejected" && !verify) {
    throw primaryResult.reason instanceof Error ? primaryResult.reason : new Error(String(primaryResult.reason));
  }

  const meta = {
    rectified: true,
    rotation: prepared.processed.location.rotation,
    blurry: prepared.processed.blur.isBlurry,
    models: verifyModel ? [ENV.geminiModel, verifyModel] : [ENV.geminiModel],
    verified: Boolean(primary && verify),
  };

  let card = primary ?? verify;
  if (!card) {
    return { success: false, reason: "unreadable", card: null, side, conflicts: [], warnings: {}, preview: prepared.previewBase64, meta };
  }

  const conflicts = new Set<string>();
  if (primary && verify) {
    for (const p of compareOcrCards(primary, verify)) {
      // 画素判定で確定しているフィールドは、モデル同士の食い違いを問題にしない
      if (isPixelDecided(hints, p)) continue;
      conflicts.add(p);
    }
  }
  const merged = applyCardHints(card, hints);
  card = merged.card;
  for (const p of merged.conflicts) conflicts.add(p);
  const finalSide: CardSide | null = hints.side ?? card.side ?? input.sideHint ?? null;
  card = { ...card, side: finalSide };

  const warnings: Record<number, string[]> = {};
  card.rows.forEach((row, i) => {
    const w = validateRow(row);
    if (w.length > 0) warnings[i] = w;
  });

  return {
    success: true,
    card,
    side: finalSide,
    conflicts: Array.from(conflicts),
    warnings,
    preview: prepared.previewBase64,
    meta,
  };
}
