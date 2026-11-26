# Claude Code 引き継ぎメモ

## 現在の状態

- 作業ブランチ: `fable5/v3-card-analytics-3d`（`fable5/gemini3-ui-refresh` から分岐。2026-09-25 の v3 改修）
- GitHub: `aboshi-work/golf-putting-analyzer`（2026-11 に `aboshiDaisuke/putting-analyzer-v2` から移動・改名。古い URL は GitHub が転送する）
- ドラフトPR: https://github.com/aboshiDaisuke/putting-analyzer-v2/pull/1
- Supabase project ref: `ijrrzinlhqhinlmzunzn` (`putting-analyzer`)
- 本番: https://putting-analyzer-v2.vercel.app/
- **2026-09-25 に Supabase を Restore し、migration 0003・0004・0005 を本番に適用済み**
  （`scripts/db/apply-migrations.ts --apply`。RLS 有効・anon の REST は 401 を確認。適用前のデータは scratchpad に JSON で退避）。
  本番 DB は drizzle の適用履歴テーブルが**空**（手動適用の運用）なので `drizzle-kit migrate` は使わないこと
- 停止の原因: 停止防止の cron が `main`（本番）に入っていなかった。PR #1 をマージすると Vercel の日次 cron が有効になる

## 2026-09-16 の修正（コミット済み・未プッシュ・本番DB未適用）

- RLS 対応の migration `drizzle/0004_enable_rls.sql`（RLS 有効化 + anon/authenticated の権限取消）
- `drizzle/0003_holes_unique_and_fk_indexes.sql`（holes の (roundId, holeNumber) ユニーク、FK 索引、重複行の事前削除）
- ホール保存を1トランザクション化し、ラウンド合計をサーバーで再計算（`server/db.ts` `saveHoles`）
- 手入力のメートル距離が分析に反映されない不具合、OCR のホール番号強制上書き、日付の1日ずれ、
  一覧の平均パット分母、ネイティブ OAuth スキーム、health エンドポイントの情報露出を修正
- 傾斜「未記入」を null で保持（フラットと区別）、ラグ分析は 2nd パットの距離を使用
- 表示名を `users.name` に保存、認証 context にキャッシュ導入、cookie 認証経路など未使用コードを削除

## 2026-09-16 追加分（OCR精度向上・機能）

- OCR: 台形補正（Web）→ 枠の画素判定 → responseSchema → お手本画像 few-shot → 二重読み → 整合性チェック。
  詳細は FABLE5_VERSION.md。`OCR_VERIFY_MODEL` を Vercel 環境変数に追加すると検証モデルを変更/無効化できる（未設定なら lite で有効）
- オフライン保存キュー、距離別チャートのツアー目安、CSV エクスポート
- （v2 の `scripts/ocr/`・`lib/ocr-layout.ts` は v3 で廃止）

## 2026-11-26 カード v4（ブランチ feature/card-v4）

- **プロ・シングル向けに全項目を残したまま枠を約1.4倍**（チェック欄 3.8→5.4mm、数字 5.2→6.8mm）。1ホール2段（上段: 何のパット・1st / 下段: 計・2nd・3rd）
- **OUT 用・IN 用の2枚**。1枚 = 開いて 170×204mm（上半分5ホール・下半分4ホール）、山折りで 170×102mm（4.25×7インチに約6mm の余裕）
- **撮影は開いて1枚**（1ラウンド2枚のまま）。OCR の構造（9行・OcrCard の型）は v3 と同じで、座標だけ layout.ts で変えた
- v3 カードは読めなくなった（座標が違う）。v3 の印刷ファイル・テスト写真は削除
- 縦長の写真で四隅■が見つからない不具合を修正（`findCornerMarkers` の縮小を長い辺基準に）
- 1回の読み（1モデル）に 60 秒の上限（`OCR_PASS_TIMEOUT_MS`）。片方が 503 で粘っても、もう片方の読みで続ける
- 評価: 通常 275/275、悪条件 456/458（誤読2件は要確認に表示）、1枚 7〜20 秒
- 表の右側に約12mm の空き（`RESERVED_X0`〜`TABLE_LIMIT_X1`）。項目を足すならここ
- 規則の書き方を修正: 自分で書いたメモは大きさの範囲内ならラウンド中に見てよい（R&A・USGA の FAQ 3・10・11）

## 2026-11-26 UI の改善（ブランチ feature/card-v4）

- 確認画面: カードと同じ2段表示・要確認の欄を黄色・画面下に「次の要確認へ」・各ホールに「このままでOK」
- デモモードの撮影画面に「サンプルのカードで試す」（`lib/demo-ocr.ts`。AI を呼ばずに 確認 → 保存 を試せる）
- 記録の流れ: 読み取りから作ったラウンドは続けて「ラウンドの情報」（`/new-round?edit=<id>&after=scan`、「あとで」で飛ばせる）。
  ラウンド詳細に「情報を編集」。新規作成と読み取りからの作成で、パター・芝・グリーンの速さ・種別を前回のラウンドから引き継ぐ
- 手入力に「詳しく（任意）」: 2段のライン・外れた方向（5方向）・タッチ1〜5・メンタル1〜5、ホールごとに乗せたショットの距離（yd → 1st の distPrev）。
  型・API・zod・CSV に missedDirection / touch / mental を戻した（DB の列は 0000 からある）。分析画面の「詳しい記録の傾向」で使う（`detailStats`）。デモは直近8ラウンドに詳しい記録あり（別の乱数で追加）
- 分析画面に目次と「目次へ」ボタン。ラウンド一覧のゴミ箱は外した（削除は詳細画面だけ）
- 小さな修正: 手入力のホール切り替えの「2打」が切れる（flexShrink）、新規ラウンドの入力漏れをそのステップで止める

## 2026-09-25 v3 改修（カード・OCR・分析・3D）

- **カード v3**: 1枚で18ホール（A4 に表 OUT・裏 IN を印刷して二つ折り、175×105mm = 規則のポケットサイズ以内）。
  座標の正は `lib/scorecard/layout.ts`（mm）。SVG は `lib/scorecard/card-svg.ts`、印刷ページは
  `npx tsx scripts/scorecard/build-card.ts` → `public/scorecard/putting-card-v3.html`、PDF は `scripts/scorecard/render-pdf.js`。
  **レイアウトを変えたら** build-card → render-pdf → gen-fixtures → build-fewshot を再実行し `npx vitest run` と eval-ocr で確認
- **OCR v3**: サーバー（`server/card-ocr.ts` / `server/_core/card-image.ts`）で JPEG デコード → 四隅■＋向きキーで 0/90/180/270° 補正
  → 面コードで OUT/IN 判定 → 全チェック枠を画素判定・数字枠のインク有無 → Gemini（全体＋行ごとの切り抜き＋記入済みお手本）→ 統合・検証。
  精度評価は `npx tsx scripts/scorecard/eval-ocr.ts`（合成写真3枚で 275/275、要確認に出ない誤読 0）。v2 カードの読み取りは廃止
- **データ**: putts に `missLength`（short/long）を追加 → `drizzle/0005_putts_miss_length.sql`（未適用）。
  `putts.result` は「このパットが入れば何のスコアか」（1ホール1回の「何のパット？」から自動で埋める。`lib/putting.ts`）
- **分析**: ストロークス・ゲインド中心に作り直し（`lib/putting-stats.ts`、設計は `docs/ANALYTICS.md`）
- **3D**: `components/green/green-scene.web.tsx`（three.js・動的 import・画面外で停止・reduced-motion 対応）、ネイティブは SVG
- **デモモード**: ログイン画面「ログインせずにデモを見る」。`lib/demo-mode.ts`（メモリ上のストア）＋ `lib/demo-data.ts`。
  Supabase 停止中の画面確認にも使える（localStorage `putting_analyzer_demo_mode=1`）

## 2026-11-26 の状態（最優先）

- Supabase は停止していた（停止防止が main に無いため）→ 2026-11-26 に Resume 済み。/api/health は connected
- Vercel の Git 連携はリポジトリ移動で切れていた → 2026-11-26 に `aboshi-work/golf-putting-analyzer` へつなぎ直し済み
  （GitHub の Vercel アプリは aboshi-work にこのリポジトリだけ許可）。Vercel のプロジェクト名と本番 URL は putting-analyzer-v2 のまま
- **読み取りモデルを変更（61b3007）**: 既定を `gemini-3.1-flash-lite`＋確認用 `gemini-3.5-flash-lite` に。`gemini-3.5-flash` は廃止で 503 が続き、
  1枚 90〜220 秒かかっていた。評価 275/275・悪条件 456/458（誤読は全て要確認に表示）、1枚 7〜9 秒、1回 入力約1.3万/出力約1,100 トークン。
  Vercel の環境変数に GEMINI_MODEL / OCR_VERIFY_MODEL は無い（2026-11-26 確認）＝コードの既定が使われる
- 次: ①② 済み → プレビュー確認 → ③ main に再マージ（revert の revert）→ ④ 本番で通し確認・cron と keep-alive の動作確認

## 2026-09-25 夕方の中断時点

- **本番は旧版に戻してある**: PR #1 は一度マージ（`e67f518`）したが本番の API が全滅したため revert（GitHub の main = `3c8f4cc`）。
  旧版でデータ API 200 を確認済み。DB（0003〜0005・RLS）は旧版とも互換。**停止防止 cron は本番で未有効のまま**。
  GitHub のリモート名は `github`（`origin` は別物）
- 落ちた原因: `server/_core/context.ts` の `import { decodeJwt } from "jose"`（ESM 専用）→ Vercel で ERR_REQUIRE_ESM。
  修正 `1496860`（JWT の exp を自前で読む）を作業ブランチにプッシュ済み。プレビューの health / golf.rounds.list は 200
- **OCR の 504 対策をプッシュ済み（`6b6081c`）**: 思考量を minimal（`OCR_THINKING`、評価 275/275・1枚 30〜43 秒。low でも 89 秒だった）、
  `vercel.json` の api の `maxDuration` を 300（プロジェクトは Fluid compute で上限 300 秒）。flash-lite 単独は 10〜17 秒だが 271/275
- **次回やること**: ① プレビューで `ocr.analyzeCard` が 200 になるか確認（未確認。`scripts/check/smoke-ocr.ts` は環境変数 E2E_EMAIL / E2E_PASSWORD が必要＝.env には無い）
  ② 問題なければ main に再マージ（revert の revert が必要）→ 本番で通し確認・停止防止 cron の有効化を確認
- プレビューは保護付きなので `vercel curl` で叩く。その際 Vercel に「Protection Bypass for Automation」トークンが自動作成された（不要なら Settings → Deployment Protection で削除）
- 本番/プレビューの確認スクリプトは `scripts/check/`（smoke-ocr.ts = 読み取り API の所要時間、smoke-api.ts = データ API、vercel-local.ts = 関数の単体起動）

## 次にやること

1. ~~Supabase を Restore / 0003〜0005 を適用 / anon の REST が 401 / ローカルで ログイン→撮影→読み取り→保存→分析 の通し確認~~（2026-09-25 済み）
2. PR #1 をマージして本番にデプロイ（停止防止の cron が有効になる）。デプロイ後に本番でも通しで確認
3. 本番の `/api/health` が `{"ok":true,...}`（古い `dbUrlPreview` 付きではない）になっていることを確認
4. GitHub Actions の keep-alive が成功していることを確認（公開リポジトリは60日コミットが無いと自動停止）
5. カード v3 を印刷（実寸 175×105mm になっているか定規で確認）し、実際に記入・撮影して OCR を試す
   （■未検出が続く場合は `lib/ocr-image-core.ts` の `findCornerMarkers`、印の判定は `lib/scorecard/process.ts` の MARK_*/INK_* を調整）
6. 問題がなければプッシュし、ドラフトPRを Ready にする

## 重要な注意

- ローカルでは別アプリが `[::1]:3000` を使っていることがある。その場合ブラウザの `localhost:3000` は別アプリに届く
  （CORS エラーになる）。API を `PORT=3001` で起動し、`.env` の `EXPO_PUBLIC_API_BASE_URL` を一時的に `http://127.0.0.1:3001` にして Metro を `--clear` で再起動する

- `.env` やアクセストークン、DBパスワードなどの秘密情報をログやコミットに出さないこと。
- 本番DBを変更する前に現行スキーマを読み取り確認し、適用後も検証すること。
- リポジトリにはDrizzle migrationを使用する。Supabase CLIのmigration形式へ勝手に移行しないこと。
- 外付けボリュームでは `drizzle/meta/._*`（AppleDouble）があると `drizzle-kit generate` が壊れる。
  `find drizzle -name "._*" -delete` してから実行する。
- `drizzle-kit generate` は `DATABASE_URL` が環境変数に無いと config で落ちる（接続はしない）。
