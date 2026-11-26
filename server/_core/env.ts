export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // OCRに使うGeminiモデル。GEMINI_MODEL で差し替え可能。
  // 既定: gemini-3.1-flash-lite（$0.25/$1.50 per 1M tokens）。2026-11-26 の評価で 275/275・悪条件 456/458（誤読は全て要確認に表示）、1枚 7〜9 秒。
  // gemini-3.5-flash は廃止（3.6-flash へ転送）で 503 が多く、1枚 90〜220 秒かかったため既定から外した。
  // 1回の読み取りは 入力 約1.3万 / 出力 約1,100 トークン（思考 0）。料金の正は https://ai.google.dev/gemini-api/docs/pricing
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  // OCR の二重読み（検証パス）に使う低コストモデル。空文字で無効化。主モデルと同じ名前だと無効。
  // 主モデルと結果が食い違ったフィールドを確認画面で強調表示するために使う。
  ocrVerifyModel: process.env.OCR_VERIFY_MODEL ?? "gemini-3.5-flash-lite",
};
