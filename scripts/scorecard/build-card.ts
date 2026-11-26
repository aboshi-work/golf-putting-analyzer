/**
 * 印刷用のパッティングカード v4（A4 2枚: OUT カード・IN カード。各1枚を切り出して二つ折り）を生成する。
 *
 *   npx tsx scripts/scorecard/build-card.ts
 *
 * 出力: public/scorecard/putting-card-v4.html（アプリの Web 版から /scorecard/putting-card-v4.html で開ける）
 * PDF は scripts/scorecard/render-pdf.js で同じ HTML から作る。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCardSvg } from "../../lib/scorecard/card-svg";
import { CARD_H, CARD_W, FACE_H, type CardSide } from "../../lib/scorecard/layout";

const OUT_DIR = path.resolve(__dirname, "../../public/scorecard");

const PANEL_X = (210 - CARD_W) / 2;
const TOP = 46;

function sheet(side: CardSide): string {
  const name = side === "out" ? "OUT カード（1〜9番）" : "IN カード（10〜18番）";
  return `<div class="sheet">
  <div class="abs" style="left:${PANEL_X}mm; top:6mm; width:${CARD_W}mm;">
    <h1>パッティングカード v4　${name}</h1>
    <p class="lead">A4 等倍で印刷 → 実線で切る → 点線で山折り。OUT と IN の2枚で18ホールです。</p>
    <div class="steps">
      <div class="step"><b>① 1ホール2段</b>上段＝何のパット・1st、下段＝計・2nd・3rd</div>
      <div class="step"><b>② 数字は枠に1字</b>2nd・3rd は 1.5 と小数1桁。選択は ✓</div>
      <div class="step"><b>③ 開いて1枚撮影</b>四隅の ■ を入れる（逆さOK）</div>
    </div>
    <p class="rule">折ると ${CARD_W}×${FACE_H}mm（4.25×7インチ以内）。自分で書いたメモはこの大きさならラウンド中に見てもかまいません（ゴルフ規則の解釈 4.3a/1）。</p>
  </div>
  <div class="abs" style="left:${PANEL_X}mm; top:${TOP}mm; width:${CARD_W}mm; height:${CARD_H}mm;">
    ${buildCardSvg(side)}
  </div>
  <!-- 切り取り線と折り線（カードの上に重ねて描く） -->
  <div class="abs cut" style="left:${PANEL_X}mm; top:${TOP}mm; width:${CARD_W}mm; height:${CARD_H}mm;"></div>
  <div class="abs fold" style="left:${PANEL_X - 6}mm; top:${TOP + FACE_H}mm; width:${CARD_W + 12}mm;"></div>
  <div class="abs label" style="left:${PANEL_X + CARD_W + 1}mm; top:${TOP + FACE_H - 1.8}mm;">山折り</div>
  <div class="abs label" style="left:${PANEL_X - 1}mm; top:${TOP + CARD_H + 0.6}mm;">✂ 実線で切り取り</div>
  <div class="abs notes" style="left:${PANEL_X}mm; top:${TOP + CARD_H + 6}mm; width:${CARD_W}mm;">
    厚めの紙（はがき程度）に印刷すると、手のひらの上でも書きやすくなります。折り目はしっかり付け、撮影のときは平らに開いてください。
  </div>
</div>`;
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>パッティングカード v4</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  :root { --ink: #111; --muted: #555; --line: #999; --bg: #e7e4dc; --accent: #1a472a; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 12px; justify-content: center; align-items: center;
    flex-wrap: wrap; padding: 12px 16px; background: #10271a; color: #fff; font-size: 16px; }
  .toolbar button, .toolbar a { font: inherit; font-weight: 700; border: 0; border-radius: 10px; padding: 10px 16px;
    background: #d4a93c; color: #10271a; text-decoration: none; cursor: pointer; }
  .toolbar .hint { opacity: .85; font-size: 14px; }
  .viewport { overflow-x: auto; padding: 24px 16px 48px; }
  .sheet { position: relative; width: 210mm; height: 297mm; margin: 0 auto 24px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.18); overflow: hidden; }
  .abs { position: absolute; }
  h1 { margin: 0; font-size: 5.4mm; line-height: 1.35; font-weight: 900; letter-spacing: .02em; }
  .lead { font-size: 3.3mm; line-height: 1.55; color: var(--ink); margin: 1.6mm 0 0; }
  .steps { display: flex; gap: 3mm; margin-top: 1.8mm; }
  .step { flex: 1; border: .3mm solid #222; border-radius: 2mm; padding: 1.2mm 2.2mm; font-size: 2.6mm; line-height: 1.4; }
  .step b { display: block; font-size: 2.9mm; }
  .cut { border: .25mm solid #222; }
  .fold { border-top: .3mm dashed #222; }
  .label { font-size: 2.6mm; color: var(--muted); background: #fff; padding: 0 1.5mm; white-space: nowrap; }
  .crop { position: absolute; background: #000; }
  .notes { font-size: 2.75mm; line-height: 1.55; color: #222; }
  .notes h2 { font-size: 3.3mm; margin: 0 0 1mm; }
  .rule { font-size: 2.45mm; color: #333; margin: 1.4mm 0 0; line-height: 1.45; }
  @media print {
    html, body { background: #fff; }
    .toolbar { display: none; }
    .viewport { padding: 0; overflow: visible; }
    .sheet { box-shadow: none; margin: 0; page-break-after: always; break-after: page; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">印刷する（A4・倍率100%）</button>
  <a href="putting-card-v4.pdf" download>PDF をダウンロード</a>
  <span class="hint">「実際のサイズ」「用紙に合わせない」で印刷してください</span>
</div>
<div class="viewport">
${(["out", "in"] as CardSide[]).map((side) => sheet(side)).join("\n")}
</div>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, "putting-card-v4.html");
writeFileSync(file, html);
console.log("wrote", file);

// 未記入の各面（OCR のお手本画像・テスト用）
for (const side of ["out", "in"] as const) {
  const svgFile = path.join(OUT_DIR, `card-v4-${side}.svg`);
  writeFileSync(svgFile, buildCardSvg(side, { outline: true }));
  console.log("wrote", svgFile);
}
