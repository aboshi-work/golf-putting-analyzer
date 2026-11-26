/**
 * 本番またはプレビューで、カード読み取り API（ocr.analyzeCard）の応答と所要時間を測る。
 *   npx tsx scripts/check/smoke-ocr.ts [rectified|raw] [ベースURL]
 * 必要な環境変数: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / E2E_EMAIL / E2E_PASSWORD（テスト用アカウント。.env には書かずその場で渡す）
 * プレビューは保護付きなので、Vercel の Protection Bypass を付けるか vercel curl を使う。
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { decodePng } from "../../tests/helpers/png";
import { encodeJpegBase64 } from "../../server/_core/card-image";
import { processCardPhoto } from "../../lib/scorecard/process";
(async () => {
  const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
  if (error) throw error;
  const token = data.session!.access_token;
  const png = decodePng(readFileSync("tests/fixtures/card-v3-out-pen.png"));
  const mode = process.argv[2] ?? "rectified";
  const img = mode === "raw" ? png : processCardPhoto(png)!.image;
  const base64 = encodeJpegBase64(img, 90);
  const body = JSON.stringify({ "0": { json: { base64, mimeType: "image/jpeg", sideHint: "out" } } });
  const t0 = Date.now();
  const res = await fetch(`${process.argv[3] ?? "https://putting-analyzer-v2.vercel.app"}/api/trpc/ocr.analyzeCard?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });
  const text = await res.text();
  console.log(`mode=${mode} body=${Math.round(body.length / 1024)}KB → HTTP ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(text.slice(0, 300).replace(/"preview":"[^"]+"/, '"preview":"…"'));
})();
