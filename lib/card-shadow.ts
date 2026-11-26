// ネイティブアプリらしい柔らかいエレベーション（影）スケール。
import { Platform, type ViewStyle } from "react-native";

function shadow(
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
  color = "#0A1E12",
): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    default: {
      boxShadow: `0px ${y}px ${blur}px rgba(10,30,18,${opacity})`,
    } as ViewStyle,
  }) as ViewStyle;
}

/** 柔らかいカード浮き上がり（枠線レスの白面用） */
export const shadowSm = shadow(2, 10, 0.055, 2);
/** フローティング要素（タブドック等） */
export const shadowMd = shadow(8, 24, 0.12, 8);
/** モーダル・シート */
export const shadowLg = shadow(14, 34, 0.18, 14);
/** 主要CTA・センター＋ボタン */
export const shadowPrimary = shadow(6, 16, 0.28, 6, "#16452A");

/** 後方互換 */
export const cardShadow = shadowSm;
