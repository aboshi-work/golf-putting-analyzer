/**
 * パッティングカード v4 の物理レイアウト（単一の正）。
 *
 * - 印刷用 HTML（scripts/scorecard/build-card.ts が public/scorecard/ に生成）も、
 *   OCR の画素判定も、すべてこのファイルの mm 座標から作る。HTML を計測し直す必要はない。
 * - カードは OUT 用（1〜9番）と IN 用（10〜18番）の2枚。1枚 = 開いた状態で 170 × 204 mm（縦長）。
 *   上半分が1面目（5ホール）、下半分が2面目（4ホール）。中央（y=102）で山折りすると 170 × 102 mm になり、
 *   ゴルフ規則の解釈 4.3a/1（グリーン読みの資料）の大きさの上限 4.25 × 7 インチ (107.95 × 177.8 mm) に
 *   縦横とも約6mm の余裕で収まる。両面とも同じ向きに印刷するので、縦にめくると裏も正しい向きで読める。
 * - 撮影はカードを開いて1枚（9ホール）。四隅の■は開いた状態の四隅にある。
 * - 1ホール = 2段（上段: 何のパット・1st / 下段: 計・2nd・3rd）。v3（1ホール1行・175 × 105）と同じ項目のまま、
 *   枠を約1.4倍にした。右側の空き（RESERVED_X0〜TABLE_LIMIT_X1）は項目を足すときのために空けてある。
 * - 四隅の■と、向きキーを180°回した位置（右下の■の左上）には何も置かない（マーク検出と向き判定のため）。
 *
 * 座標系: カードを開いた状態の左上が原点、x 右・y 下、単位 mm。Rect は枠の外形。
 */

export type MmRect = { x: number; y: number; w: number; h: number };
export type MmPoint = { x: number; y: number };

export type CardSide = "out" | "in";

export const CARD_W = 170;
/** 開いた状態の高さ（折ると FACE_H） */
export const CARD_H = 204;
/** 1面の高さ。y = FACE_H が折り線 */
export const FACE_H = 102;

// ─── 位置合わせマーク ───────────────────────────────────────────────────────
export const MARKER_SIZE = 5;
const MARKER_INSET = 3;
const mc = MARKER_INSET + MARKER_SIZE / 2; // マーク中心の端からの距離

/** 四隅マーク中心（TL, TR, BR, BL の時計回り） */
export const MARKER_CENTERS: [MmPoint, MmPoint, MmPoint, MmPoint] = [
  { x: mc, y: mc },
  { x: CARD_W - mc, y: mc },
  { x: CARD_W - mc, y: CARD_H - mc },
  { x: mc, y: CARD_H - mc },
];

/** 向き判定用の塗りつぶし正方形（左上マークの右隣）。180°回転した位置は必ず空白にしておく */
export const ORIENTATION_KEY: MmRect = { x: 10.2, y: 4, w: 3, h: 3 };

/** 面の識別コード。OUT 面は [0]、IN 面は [1] だけが塗りつぶされている */
export const SIDE_CODE: [MmRect, MmRect] = [
  { x: 62, y: 4, w: 3, h: 3 },
  { x: 66.2, y: 4, w: 3, h: 3 },
];

// ─── ヘッダー（OUT 面のみ記入欄あり） ───────────────────────────────────────
const DIGIT_W = 5.2;
const DIGIT_H = 5.8;
const DIGIT_PITCH = 5.8;

/** 日付 MM/DD の4枠（OUT 面のみ） */
export const DATE_X = 91.5;
export const DATE_BOXES: MmRect[] = [0, 1, 2, 3].map((i) => ({
  x: DATE_X + i * DIGIT_PITCH + (i >= 2 ? 2.2 : 0), // 月と日の間に "/" の余白
  y: 3.8,
  w: DIGIT_W,
  h: DIGIT_H,
}));

/** コース名の手書き欄（下線） */
export const COURSE_LINE: MmRect = { x: 128.5, y: 3.8, w: 29.5, h: DIGIT_H };

// ─── 表（9ホール × 2段） ────────────────────────────────────────────────────
export const ROW_COUNT = 9;
/** 1面目に載せるホール数（残りは2面目） */
export const FACE1_ROWS = 5;
/** 1段の高さと、1ホール（2段）の高さ */
export const LINE_PITCH = 8.1;
export const BLOCK_H = LINE_PITCH * 2;

export type HeaderBand = { groupY: number; groupH: number; optionY: number; optionH: number };
/** 列見出し（1面目・2面目にそれぞれ印刷する） */
export const HEADER_BANDS: [HeaderBand, HeaderBand] = [
  { groupY: 10.8, groupH: 3.4, optionY: 14.2, optionH: 3.6 },
  { groupY: FACE_H + 8.8, groupH: 3.4, optionY: FACE_H + 12.2, optionH: 3.6 },
];
/** 行の切り抜き（OCR）で各行の上に付ける列見出し */
export const HEADER_BAND = HEADER_BANDS[0];
/** 各面の最初の行の上端 */
export const FACE_ROWS_TOP: [number, number] = [17.8, FACE_H + 15.8];

export const CHECK_PITCH = 6.8;
const CHECK_SIZE = 5.4;
export const CELL_PITCH = 7.6;
const CELL_W = 6.8;
const CELL_H = 6.8;
const DEC_DOT_GAP = 1.6;

/** 表の左端。右端は使っている列の最後（TABLE_X1）。TABLE_LIMIT_X1 までは足せる（向きキーの180°位置 x≈156.8 の手前） */
export const TABLE_X0 = 12.5;
export const TABLE_LIMIT_X1 = 155.5;

const X_HOLE = TABLE_X0;
const W_HOLE = 8;
const X_LINE_LABEL = X_HOLE + W_HOLE;
const W_LINE_LABEL = 6;
/** 列グループの開始 x（間に 0.6mm の区切り） */
const X_A = X_LINE_LABEL + W_LINE_LABEL + 0.5; // 何のパット（上段）/ 3rd・計（下段）
const X_DIST = X_A + CHECK_PITCH * 5 + 0.6;
const X_UD = X_DIST + CELL_PITCH * 2 + DEC_DOT_GAP + 0.6;
const X_LR = X_UD + CHECK_PITCH * 3 + 0.6;
const X_MISS = X_LR + CHECK_PITCH * 3 + 0.6;
const X_P3_LABEL = X_MISS + 0.4;
const X_P3 = X_MISS + 4.6;
export const TABLE_X1 = Math.max(X_MISS + CHECK_PITCH * 2, X_P3 + CELL_PITCH * 2 + DEC_DOT_GAP) + 0.6;
/** 項目を足すときに使える右側の空き */
export const RESERVED_X0 = TABLE_X1;

/** 列の配置（x の開始位置） */
export const COLUMNS = {
  hole: { x: X_HOLE, w: W_HOLE },
  lineLabel: { x: X_LINE_LABEL, w: W_LINE_LABEL },
  /** 上段 */
  puttFor: X_A,
  p1Dist: X_DIST,
  p1UD: X_UD,
  p1LR: X_LR,
  p1Miss: X_MISS,
  /** 下段（計は「何のパット」の下、2nd は 1st の真下、3rd は「外れ」の下） */
  totalLabel: X_A + 1,
  total: X_A + 5,
  p3Label: X_P3_LABEL,
  p3Dist: X_P3,
  p2Dist: X_DIST,
  p2UD: X_UD,
  p2LR: X_LR,
} as const;

/** 列の幅（見出しの中央寄せに使う） */
export const COLUMN_WIDTHS = {
  puttFor: CHECK_PITCH * 5,
  dist: CELL_PITCH * 2 + DEC_DOT_GAP,
  ud: CHECK_PITCH * 3,
  lr: CHECK_PITCH * 3,
  miss: CHECK_PITCH * 2,
} as const;

/** 列グループの区切り線の x（見出しから表の下端まで縦に引く） */
export const GROUP_DIVIDERS = [X_LINE_LABEL, X_DIST - 0.3, X_UD - 0.3, X_MISS - 0.3, TABLE_X1];

/** 選択肢のラベル（印刷用）と OCR の値 */
export const PUTT_FOR_OPTIONS = ["E", "Ba", "P", "Bo", "D+"] as const;
export const UD_OPTIONS = ["F", "U", "D"] as const;
export const LR_OPTIONS = ["S", "L", "R"] as const;
export const MISS_OPTIONS = ["short", "long"] as const;

export type PuttForCode = (typeof PUTT_FOR_OPTIONS)[number];
export type UdCode = (typeof UD_OPTIONS)[number];
export type LrCode = (typeof LR_OPTIONS)[number];
export type MissCode = (typeof MISS_OPTIONS)[number];

export const OPTION_PRINT_LABELS = {
  puttFor: ["E", "Ba", "P", "Bo", "D+"],
  ud: ["平", "上", "下"],
  lr: ["直", "左", "右"],
  miss: ["短", "長"],
} as const;

export type RowLayout = {
  /** 1ホール（2段）全体 */
  band: MmRect;
  /** 0 = 1面目 / 1 = 2面目 */
  face: 0 | 1;
  /** 上段・下段の中心 y */
  line1Y: number;
  line2Y: number;
  holeLabel: MmRect;
  puttFor: MmRect[];
  p1: { dist: MmRect[]; ud: MmRect[]; lr: MmRect[]; miss: MmRect[] };
  /** 2nd/3rd の距離は [整数部, 小数部]（間に小数点が印刷されている） */
  p2: { dist: MmRect[]; ud: MmRect[]; lr: MmRect[] };
  p3: { dist: MmRect[] };
  total: MmRect;
};

function checks(x0: number, count: number, cy: number): MmRect[] {
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + i * CHECK_PITCH + (CHECK_PITCH - CHECK_SIZE) / 2,
    y: cy - CHECK_SIZE / 2,
    w: CHECK_SIZE,
    h: CHECK_SIZE,
  }));
}

function digits(x0: number, count: number, cy: number): MmRect[] {
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + i * CELL_PITCH + (CELL_PITCH - CELL_W) / 2,
    y: cy - CELL_H / 2,
    w: CELL_W,
    h: CELL_H,
  }));
}

/** 整数部 + 小数点 + 小数部 */
function decimal(x0: number, cy: number): MmRect[] {
  const a = { x: x0 + (CELL_PITCH - CELL_W) / 2, y: cy - CELL_H / 2, w: CELL_W, h: CELL_H };
  const b = { ...a, x: x0 + CELL_PITCH + DEC_DOT_GAP + (CELL_PITCH - CELL_W) / 2 };
  return [a, b];
}

/** 小数点の中心（印刷用） */
export function decimalDotCenter(x0: number, cy: number): MmPoint {
  return { x: x0 + CELL_PITCH + DEC_DOT_GAP / 2, y: cy + CELL_H / 2 - 0.8 };
}

/** i 番目のホールの上端 y */
export function rowTopY(i: number): number {
  return i < FACE1_ROWS ? FACE_ROWS_TOP[0] + BLOCK_H * i : FACE_ROWS_TOP[1] + BLOCK_H * (i - FACE1_ROWS);
}

export function rowCenterY(i: number): number {
  return rowTopY(i) + BLOCK_H / 2;
}

/** 各面の表の下端 */
export const FACE_ROWS_BOTTOM: [number, number] = [rowTopY(FACE1_ROWS - 1) + BLOCK_H, rowTopY(ROW_COUNT - 1) + BLOCK_H];
/** 表の一番下（2面目の最後の行の下端） */
export const ROWS_BOTTOM = FACE_ROWS_BOTTOM[1];

export const ROWS: RowLayout[] = Array.from({ length: ROW_COUNT }, (_, i) => {
  const top = rowTopY(i);
  const y1 = top + LINE_PITCH / 2;
  const y2 = top + LINE_PITCH * 1.5;
  return {
    band: { x: TABLE_X0, y: top, w: TABLE_X1 - TABLE_X0, h: BLOCK_H },
    face: i < FACE1_ROWS ? 0 : 1,
    line1Y: y1,
    line2Y: y2,
    holeLabel: { x: COLUMNS.hole.x, y: top, w: COLUMNS.hole.w, h: BLOCK_H },
    puttFor: checks(COLUMNS.puttFor, 5, y1),
    p1: {
      dist: digits(COLUMNS.p1Dist, 2, y1),
      ud: checks(COLUMNS.p1UD, 3, y1),
      lr: checks(COLUMNS.p1LR, 3, y1),
      miss: checks(COLUMNS.p1Miss, 2, y1),
    },
    p2: {
      dist: decimal(COLUMNS.p2Dist, y2),
      ud: checks(COLUMNS.p2UD, 3, y2),
      lr: checks(COLUMNS.p2LR, 3, y2),
    },
    p3: { dist: decimal(COLUMNS.p3Dist, y2) },
    total: digits(COLUMNS.total, 1, y2)[0],
  };
});

/** 表の範囲（列見出し＋1面目の行）。OCR で行ごとに切り出すときの横幅に使う */
export const TABLE_RECT: MmRect = {
  x: TABLE_X0,
  y: HEADER_BAND.groupY,
  w: TABLE_X1 - TABLE_X0,
  h: FACE_ROWS_BOTTOM[0] - HEADER_BAND.groupY,
};

export function holeNumberFor(side: CardSide, rowIndex: number): number {
  return side === "out" ? rowIndex + 1 : rowIndex + 10;
}

// ─── mm ⇔ マーク基準の正規化座標 ───────────────────────────────────────────
// OCR はマーク中心を (0,0)-(1,1) とする正規化座標で扱う（撮影距離に依存しない）。
const M0 = MARKER_CENTERS[0];
const MARKER_SPAN_X = MARKER_CENTERS[1].x - M0.x;
const MARKER_SPAN_Y = MARKER_CENTERS[3].y - M0.y;

/** マーク中心矩形の 高さ / 幅 */
export const MARKER_RECT_ASPECT = MARKER_SPAN_Y / MARKER_SPAN_X;

export function mmToNorm(p: MmPoint): MmPoint {
  return { x: (p.x - M0.x) / MARKER_SPAN_X, y: (p.y - M0.y) / MARKER_SPAN_Y };
}

export function rectMmToNorm(r: MmRect): MmRect {
  const a = mmToNorm({ x: r.x, y: r.y });
  return { x: a.x, y: a.y, w: r.w / MARKER_SPAN_X, h: r.h / MARKER_SPAN_Y };
}

/** 面の外形（カード全体）の正規化座標。補正画像の出力範囲に使う */
export const CARD_BOUNDS_NORM: MmRect = rectMmToNorm({ x: 0, y: 0, w: CARD_W, h: CARD_H });
