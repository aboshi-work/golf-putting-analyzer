/**
 * 印刷用のパッティングカード v4（A4 3枚: OUT カード・IN カード・使い方）を生成する。
 *
 *   npx tsx scripts/scorecard/build-card.ts
 *
 * 出力: public/scorecard/putting-card-v4.html（アプリの Web 版から /scorecard/putting-card-v4.html で開ける）
 * PDF は scripts/scorecard/render-pdf.js で同じ HTML から作る。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCardSvg, type CardFill } from "../../lib/scorecard/card-svg";
import { BLOCK_H, CARD_H, CARD_W, FACE_H, FACE_ROWS_TOP, type CardSide } from "../../lib/scorecard/layout";

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

// 使い方ページの記入例（1〜3番）
const EXAMPLE: CardFill = {
  date: "0925",
  course: "富士見CC",
  markStyle: "check",
  rows: [
    // 1番: 3m のパーパット、下り・左曲がり → 1パットで入った
    { puttFor: 2, p1: { dist: "3", ud: 2, lr: 1 }, total: "1" },
    // 2番: 8m のバーディパット、上り・右曲がり、ショート → 2nd 1.2m 平・まっすぐ → 2パット
    { puttFor: 1, p1: { dist: "8", ud: 1, lr: 2, miss: 0 }, p2: { dist: "1.2", ud: 0, lr: 0 }, total: "2" },
    // 3番: 15m のバーディパット、平・まっすぐ、オーバー → 2nd 2.5m 下・左 → 3rd 0.6m → 3パット
    { puttFor: 1, p1: { dist: "15", ud: 0, lr: 0, miss: 1 }, p2: { dist: "2.5", ud: 2, lr: 1 }, p3: { dist: "0.6" }, total: "3" },
  ],
};
/** 記入例として見せる範囲（1面目の上端〜3番の下端） */
const EXAMPLE_H = FACE_ROWS_TOP[0] + BLOCK_H * 3 + 1;

function manualSheet(): string {
  return `<div class="sheet manual" id="manual">
  <div class="abs" style="left:${PANEL_X}mm; top:12mm; width:${CARD_W}mm;">
    <h1>使い方・記入の仕方</h1>
    <p class="lead">パッティングカード v4 は、1ホールのパットを2段で記録し、写真を撮るだけでアプリに取り込めるカードです。</p>

    <h2>1. 準備</h2>
    <div class="steps">
      <div class="step"><b>① 印刷</b>A4 に等倍（実際のサイズ）で。はがきくらいの厚紙だと書きやすい</div>
      <div class="step"><b>② 切る</b>OUT・IN の2枚を実線で切り取る</div>
      <div class="step"><b>③ 折る</b>点線で山折り。折ると ${CARD_W}×${FACE_H}mm でポケットに入る</div>
    </div>

    <h2>2. 記入例（OUT カードの1〜3番）</h2>
    <div class="example">${buildCardSvg("out", { fill: EXAMPLE })}</div>
    <ol class="ex">
      <li><b>1番（1パット）</b>3m のパーパットが入った → 何のパット「P」、1st 距離「3」、下・左、計「1」</li>
      <li><b>2番（2パット）</b>8m のバーディパットが1.2m ショート → 1st「8」上・右・短、2nd「1.2」平・直、計「2」</li>
      <li><b>3番（3パット）</b>15m をオーバーして2.5m、それも外して0.6m → 1st「15」平・直・長、2nd「2.5」下・左、3rd「0.6」、計「3」</li>
    </ol>

    <h2>3. 各欄の書き方</h2>
    <table class="howto">
      <tr><th>何のパット？</th><td>1打目のパットが入れば何のスコアか。E イーグル / Ba バーディ / P パー / Bo ボギー / D+ ダボ以上。パーオンしたらバーディパット</td></tr>
      <tr><th>距離</th><td>歩測でよい。1st は整数の m、2nd・3rd は「1.5」のように小数1桁（整数と小数を別の枠に）</td></tr>
      <tr><th>傾斜・曲がり</th><td>平・上・下 と 直・左・右 から1つずつ。分からなければ空欄でよい</td></tr>
      <tr><th>外れ</th><td>1st が入らなかったとき、ショートなら「短」、オーバーなら「長」</td></tr>
      <tr><th>計</th><td>そのホールの総パット数。4パット以上もそのまま書く（2nd・3rd の欄は分かる範囲で）</td></tr>
      <tr><th>書き方</th><td>選択は枠の中に ✓（塗りつぶし・× でも可）。数字は1枠に1字</td></tr>
    </table>

    <div class="cols">
      <div class="box"><h3>4. いつ書くか</h3>カップインしたら、次のホールへ歩きながら書く。グリーン上で書いてプレーを遅らせない。</div>
      <div class="box"><h3>5. 撮影</h3>ラウンド後にカードを開いて平らに置き、四隅の ■ が全部入るように真上から。OUT と IN で1枚ずつ。向きは逆さでもよい。</div>
      <div class="box"><h3>6. アプリで確認</h3>読み取り結果のうち、黄色の「要確認」だけ見直して保存。カードに書けなかった項目はここで足せる。</div>
      <div class="box"><h3>7. ゴルフ規則</h3>自分で書いたメモは、${CARD_W}×${FACE_H}mm（4.25×7インチ以内）のカードならラウンド中に見てもかまわない（規則の解釈 4.3a/1）。</div>
    </div>
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
  .manual h2 { font-size: 4.2mm; margin: 6mm 0 2mm; padding-bottom: .8mm; border-bottom: .4mm solid var(--accent); color: var(--accent); }
  .manual h3 { font-size: 3.4mm; margin: 0 0 1mm; color: var(--accent); }
  .manual .lead { font-size: 3.4mm; }
  .manual .step { font-size: 3mm; padding: 1.8mm 2.4mm; }
  .manual .step b { font-size: 3.3mm; }
  .example { width: ${CARD_W}mm; height: ${EXAMPLE_H}mm; overflow: hidden; border: .25mm solid #bbb; border-radius: 1.5mm; }
  .example svg { display: block; }
  .ex { margin: 2mm 0 0; padding-left: 5mm; font-size: 3mm; line-height: 1.6; }
  .ex b { margin-right: 2mm; }
  .howto { width: 100%; border-collapse: collapse; font-size: 3mm; line-height: 1.5; }
  .howto th { width: 26mm; text-align: left; vertical-align: top; padding: 1.4mm 2mm; background: #eef3ef; border: .25mm solid #c9d3cc; white-space: nowrap; }
  .howto td { padding: 1.4mm 2.4mm; border: .25mm solid #c9d3cc; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 6mm; }
  .box { border: .3mm solid #c9d3cc; border-radius: 2mm; padding: 2.4mm 3mm; font-size: 3mm; line-height: 1.55; }
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
${manualSheet()}
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
