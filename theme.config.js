/** @type {const} */
const themeColors = {
  primary: { light: '#184228', dark: '#63B47B' },
  background: { light: '#F4F1EA', dark: '#0E1711' },
  surface: { light: '#FCFBF8', dark: '#16231A' },
  foreground: { light: '#171C18', dark: '#ECE8DF' },
  muted: { light: '#6B665D', dark: '#9AA89D' },
  border: { light: '#DFD9CE', dark: '#28392D' },
  success: { light: '#256D2B', dark: '#66BB6A' },
  warning: { light: '#C97700', dark: '#FFB74D' },
  error: { light: '#B71C1C', dark: '#EF5350' },
  accent: { light: '#9E7418', dark: '#D4A743' },
  // primary で塗った面の上の文字（ダークの primary は明るい緑なので暗い文字にしてコントラストを確保）
  onPrimary: { light: '#FCFBF8', dark: '#0C1A10' },
};

module.exports = { themeColors };
