import { alpha, createTheme, type PaletteMode } from '@mui/material/styles'

const SIGNAL = '#d85d32'

export type ThemeMode = PaletteMode

export const createHaulHourTheme = (mode: ThemeMode) => {
  const dark = mode === 'dark'
  const surface = dark ? '#111b20' : '#f8faf9'
  const paper = dark ? '#17242a' : '#fcfdfc'
  const ink = dark ? '#edf3f1' : '#152125'
  const muted = dark ? '#9fb0b3' : '#58696d'
  const divider = dark ? '#304148' : '#d8e1df'

  return createTheme({
    palette: {
      mode,
      primary: { main: SIGNAL, dark: '#a83f1d', contrastText: '#fffaf7' },
      secondary: { main: dark ? '#a7b8bb' : '#465b61' },
      background: { default: surface, paper },
      text: { primary: ink, secondary: muted },
      divider,
      success: { main: dark ? '#6fb894' : '#2d7657' },
      warning: { main: dark ? '#e0a55d' : '#a55c16' },
      error: { main: dark ? '#e47d78' : '#b4443e' },
      info: { main: dark ? '#72a9c1' : '#356f89' },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
      h1: {
        fontFamily: '"Arial Narrow", "Aptos Display", "Segoe UI Variable Display", sans-serif',
        fontWeight: 800,
        letterSpacing: '-0.045em',
      },
      h2: {
        fontFamily: '"Arial Narrow", "Aptos Display", "Segoe UI Variable Display", sans-serif',
        fontWeight: 780,
        letterSpacing: '-0.035em',
      },
      h3: { fontWeight: 760, letterSpacing: '-0.02em' },
      button: { textTransform: 'none', fontWeight: 760, letterSpacing: '-0.01em' },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 10,
            paddingInline: 16,
            transition:
              'transform 180ms cubic-bezier(.16,1,.3,1), background-color 180ms ease, border-color 180ms ease',
            '&:active': { transform: 'scale(.98)' },
          },
          containedPrimary: {
            boxShadow: `0 8px 24px ${alpha(SIGNAL, dark ? 0.24 : 0.2)}`,
            '&:hover': { backgroundColor: dark ? '#e36b40' : '#c84d25' },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${divider}`,
            boxShadow: dark ? '0 32px 90px rgba(1, 7, 10, .56)' : '0 32px 90px rgba(28, 45, 49, .18)',
          },
        },
      },
      MuiTextField: { defaultProps: { variant: 'outlined' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: dark ? '#121e23' : '#fbfcfc',
            transition: 'background-color 180ms ease, box-shadow 180ms ease',
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(SIGNAL, 0.15)}` },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${divider}` },
          indicator: { height: 3, borderRadius: '3px 3px 0 0' },
        },
      },
      MuiTab: { styleOverrides: { root: { minHeight: 54, textTransform: 'none', fontWeight: 720 } } },
      MuiAccordion: {
        styleOverrides: {
          root: {
            border: `1px solid ${divider}`,
            borderRadius: '12px !important',
            '&:before': { display: 'none' },
          },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 700 } } },
      MuiCssBaseline: {
        styleOverrides: {
          ':focus-visible': { outline: `3px solid ${SIGNAL}`, outlineOffset: 3 },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
    },
  })
}
