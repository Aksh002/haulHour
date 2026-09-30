import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#0b5d65', dark: '#073d44' },
    secondary: { main: '#e06b48' },
    background: { default: '#f4f7f6', paper: '#ffffff' },
    text: { primary: '#142b2e', secondary: '#53686b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.04em' },
    h2: { fontWeight: 750, letterSpacing: '-0.025em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 44 } } },
    MuiCssBaseline: {
      styleOverrides: {
        ':focus-visible': { outline: '3px solid #e06b48', outlineOffset: 3 },
        '@media (prefers-reduced-motion: reduce)': {
          '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
        },
      },
    },
  },
})
