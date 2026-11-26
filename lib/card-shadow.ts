// 控えめな光と影のスケール。大げさな浮き上がりを避け、紙面のような落ち着きを保つ。
import { Platform, type ViewStyle } from "react-native";

function shadow(
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
  color = "#0B2014",
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
      boxShadow: `0px ${y}px ${blur}px rgba(11,32,20,${opacity})`,
    } as ViewStyle,
  }) as ViewStyle;
}

/** ごく控えめ: 通常のパネル */
export const shadowSm = shadow(1, 3, 0.04, 1);
/** 標準: 浮かせたいカード */
export const shadowMd = shadow(4, 12, 0.07, 3);
/** 強め: ログイン等の主パネル */
export const shadowLg = shadow(10, 24, 0.11, 8);
/** 主要CTAの控えめな接地影 */
export const shadowPrimary = shadow(4, 12, 0.18, 4, "#184228");

/** 後方互換 */
export const cardShadow = shadowSm;
