/** @type {const} */
const themeColors = {
  primary: { light: '#16452A', dark: '#57C478' },
  background: { light: '#EFECE6', dark: '#0A120D' },
  surface: { light: '#FFFFFF', dark: '#142119' },
  foreground: { light: '#121814', dark: '#F0F2EF' },
  muted: { light: '#646A66', dark: '#95A59A' },
  border: { light: '#E4E0D8', dark: '#23352A' },
  success: { light: '#1F7A38', dark: '#66CC82' },
  warning: { light: '#D47A00', dark: '#FFB74D' },
  error: { light: '#C62828', dark: '#EF5350' },
  accent: { light: '#B5831B', dark: '#E0B245' },
  // primary で塗った面の上の文字（ダークの primary は明るい緑なので暗い文字にしてコントラストを確保）
  onPrimary: { light: '#FFFFFF', dark: '#08170D' },
};

module.exports = { themeColors };
