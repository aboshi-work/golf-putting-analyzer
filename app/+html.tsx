import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Expo Web 静的レンダリング用の HTML ルート。
 * iOS / Android の「ホーム画面に追加」（PWA）でアプリ名・アイコン・テーマカラーが正しく反映されるようにする。
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>パッティング分析</title>
        <meta name="description" content="パッティングカードを撮影して読み取り、ストロークス・ゲインドで弱点と練習メニューを分析するゴルフアプリ" />
        <meta name="theme-color" content="#184228" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="パット分析" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page { size: A4 portrait; margin: 10mm; }
                body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                [data-no-print="true"] { display: none !important; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
