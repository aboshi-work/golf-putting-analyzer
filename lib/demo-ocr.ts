/**
 * デモモード用の「読み取り結果」のサンプル（AI を呼ばずに 撮影 → 確認 → 保存 を試せるように）。
 * 記入内容は card-svg の fill 形式で持ち、確認画面に出すカードの絵も同じ記入から描く。
 * 要確認（二重読みの食い違い）と記入ルールの矛盾を、本物の読み取りと同じ形でいくつか入れてある。
 */
import type { SideResult } from "./ocr-session";
import { buildCardSvg, fillToOcrCard, type CardFill } from "./scorecard/card-svg";
import type { CardSide } from "./scorecard/layout";
import { validateRow } from "./scorecard/ocr";

const OUT: CardFill = {
  date: "1123",
  course: "富士見ヶ丘CC",
  markStyle: "check",
  rows: [
    { puttFor: 1, p1: { dist: "8", ud: 1, lr: 2, miss: 0 }, p2: { dist: "1.2", ud: 0, lr: 0 }, total: "2" },
    { puttFor: 2, p1: { dist: "3", ud: 2, lr: 1 }, total: "1" },
    { puttFor: 1, p1: { dist: "15", ud: 0, lr: 0, miss: 1 }, p2: { dist: "2.5", ud: 2, lr: 1 }, p3: { dist: "0.6" }, total: "3" },
    { puttFor: 2, p1: { dist: "6", ud: 2, lr: 2, miss: 1 }, p2: { dist: "0.9", ud: 1, lr: 0 }, total: "2" },
    { puttFor: 3, p1: { dist: "2", ud: 1, lr: 0 }, total: "1" },
    { puttFor: 2, p1: { dist: "11", ud: 0, lr: 1, miss: 0 }, p2: { dist: "1.8", ud: 1, lr: 2 }, total: "2" },
    { puttFor: 1, p1: { dist: "4", ud: 1, lr: 2, miss: 0 }, p2: { dist: "0.4" }, total: "2" },
    { puttFor: 2, p1: { dist: "9", ud: 2, lr: 0, miss: 1 }, p2: { dist: "1.1", ud: 0, lr: 2 }, total: "2" },
    { puttFor: 1, p1: { dist: "5", ud: 0, lr: 1 }, total: "1" },
  ],
};

const IN: CardFill = {
  markStyle: "check",
  ink: "pencil",
  rows: [
    { puttFor: 1, p1: { dist: "9", ud: 1, lr: 1, miss: 0 }, p2: { dist: "1.5", ud: 1, lr: 0 }, total: "2" },
    { puttFor: 2, p1: { dist: "5", ud: 0, lr: 2, miss: 1 }, p2: { dist: "0.7", ud: 2, lr: 0 }, total: "2" },
    { puttFor: 1, p1: { dist: "13", ud: 2, lr: 2, miss: 1 }, p2: { dist: "1.1", ud: 0, lr: 1 }, total: "2" },
    { puttFor: 2, p1: { dist: "1", ud: 1, lr: 0 }, total: "1" },
    { puttFor: 3, p1: { dist: "7", ud: 2, lr: 1, miss: 0 }, p2: { dist: "2.0", ud: 1, lr: 2 }, p3: { dist: "0.5" }, total: "3" },
    { puttFor: 2, p1: { dist: "18", ud: 1, lr: 0, miss: 0 }, p2: { dist: "1.4", ud: 0, lr: 0 }, total: "2" },
    { puttFor: 1, p1: { dist: "6", ud: 0, lr: 2, miss: 1 }, p2: { dist: "0.8", ud: 2, lr: 1 }, total: "2" },
    { puttFor: 2, p1: { dist: "3", ud: 1, lr: 1 }, total: "1" },
    { puttFor: 1, p1: { dist: "10", ud: 0, lr: 2, miss: 1 }, p2: { dist: "0.8", ud: 2, lr: 1 }, total: "2" },
  ],
};

function svgUri(side: CardSide, fill: CardFill): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildCardSvg(side, { fill, outline: true }))}`;
}

function sideResult(side: CardSide, fill: CardFill, conflicts: string[]): SideResult {
  const card = fillToOcrCard(side, fill);
  // 本物の読み取りでありがちな「読めなかった欄」を1つ再現する（OUT 4番の計が空）
  if (side === "out") card.rows[3] = { ...card.rows[3], total: null };
  const warnings: Record<number, string[]> = {};
  card.rows.forEach((row, i) => {
    const w = validateRow(row);
    if (w.length) warnings[i] = w;
  });
  return { side, card, conflicts, warnings, preview: null, previewUri: svgUri(side, fill), rectified: true, blurry: false };
}

/** デモ用の読み取り結果（OUT・IN の2枚） */
export function demoOcrResults(): SideResult[] {
  return [
    sideResult("out", OUT, ["rows[2].p1.lr", "rows[5].puttFor"]),
    sideResult("in", IN, ["rows[4].p2.ud"]),
  ];
}
