/**
 * 本番またはプレビューで、ログイン後のデータ API（golf.rounds.list / golf.userProfile.get）が 200 を返すか確かめる。
 *   BASE=<ベースURL> npx tsx scripts/check/smoke-api.ts
 * 必要な環境変数: smoke-ocr.ts と同じ。
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
(async () => {
  const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
  const token = data.session!.access_token;
  for (const path of ["golf.rounds.list", "golf.userProfile.get"]) {
    const t0 = Date.now();
    const res = await fetch(`${process.env.BASE ?? "https://putting-analyzer-v2.vercel.app"}/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: { json: null } }))}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(path, res.status, ((Date.now() - t0) / 1000).toFixed(1) + "s", (await res.text()).slice(0, 120));
  }
})();
