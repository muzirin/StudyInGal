import { createTheme, type Theme } from '@mui/material/styles'

export interface PaletteSeed {
  id: string
  name: string
  seed: string
  secondary: string
  tertiary: string
  neutral: string
}

export const PALETTES: PaletteSeed[] = [
  { id: 'sakura', name: '樱花粉（默认）', seed: '#E85C97', secondary: '#A76FBF', tertiary: '#F29B7A', neutral: '#FFF7FA' },
  { id: 'lavender', name: '薰衣草', seed: '#8C6FE6', secondary: '#C77DDE', tertiary: '#7BA7F0', neutral: '#F8F6FF' },
  { id: 'mint', name: '薄荷', seed: '#1F9D8B', secondary: '#4FB69E', tertiary: '#7CC96F', neutral: '#F4FBF9' },
  { id: 'sky', name: '晴空', seed: '#2C7BE5', secondary: '#4FA3F7', tertiary: '#63C6E8', neutral: '#F4F8FF' },
  { id: 'amber', name: '琥珀', seed: '#C97A16', secondary: '#E0A03C', tertiary: '#B75D3F', neutral: '#FFF9F1' },
  { id: 'matcha', name: '抹茶', seed: '#6A8F3C', secondary: '#93AD5B', tertiary: '#C0A250', neutral: '#F8FBF3' },
  { id: 'graphite', name: '石墨', seed: '#5A6472', secondary: '#7C8798', tertiary: '#9AA6B8', neutral: '#F7F8FA' },
  { id: 'cyber', name: '赛博霓虹', seed: '#25D0C0', secondary: '#F45BC0', tertiary: '#F2C14E', neutral: '#0E1418' }
]

export const paletteById = (id: string): PaletteSeed => PALETTES.find((item) => item.id === id) ?? PALETTES[0]

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim()
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6)
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`
}

export function mix(a: string, b: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex([r1 + (r2 - r1) * weight, g1 + (g2 - g1) * weight, b1 + (b2 - b1) * weight])
}

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const onColor = (hex: string): string => (luminance(hex) > 0.55 ? '#1B1B1F' : '#FFFFFF')

export interface ThemeOptions {
  paletteId: string
  mode: 'light' | 'dark'
  radius: number
  touchOptimized: boolean
  compact: boolean
}

export function buildTheme({ paletteId, mode, radius, touchOptimized, compact }: ThemeOptions): Theme {
  const palette = paletteById(paletteId)
  const dark = mode === 'dark'
  const neutral = dark ? '#121014' : palette.neutral

  const primary = dark ? mix(palette.seed, '#FFFFFF', 0.32) : mix(palette.seed, '#000000', 0.06)
  const secondary = dark ? mix(palette.secondary, '#FFFFFF', 0.3) : palette.secondary
  const tertiary = dark ? mix(palette.tertiary, '#FFFFFF', 0.3) : palette.tertiary

  const surface = dark ? mix(palette.seed, '#0F0D12', 0.88) : mix(palette.seed, neutral, 0.94)
  const surfaceVariant = dark ? mix(palette.seed, '#1C1A21', 0.8) : mix(palette.seed, '#FFFFFF', 0.86)

  const fontFamily = [
    'Roboto',
    '"Noto Sans SC"',
    '"Microsoft YaHei"',
    '"PingFang SC"',
    'system-ui',
    '-apple-system',
    'sans-serif'
  ].join(',')

  const theme = createTheme({
    cssVariables: { cssVarPrefix: 'sig' },
    palette: {
      mode,
      primary: {
        main: primary,
        light: dark ? mix(primary, '#FFFFFF', 0.24) : mix(primary, '#FFFFFF', 0.32),
        dark: mix(primary, '#000000', 0.24),
        contrastText: onColor(primary)
      },
      secondary: {
        main: secondary,
        light: mix(secondary, '#FFFFFF', 0.32),
        dark: mix(secondary, '#000000', 0.24),
        contrastText: onColor(secondary)
      },
      info: { main: tertiary, contrastText: onColor(tertiary) },
      background: { default: surface, paper: dark ? mix(surface, '#FFFFFF', 0.04) : '#FFFFFF' },
      divider: mix(primary, dark ? '#FFFFFF' : '#000000', dark ? 0.78 : 0.82),
      text: {
        primary: dark ? '#EFEAF2' : mix(primary, '#101014', 0.86),
        secondary: dark ? '#C2BAC8' : mix(primary, '#3A3540', 0.62)
      }
    },
    shape: { borderRadius: radius },
    typography: {
      fontFamily,
      h1: { fontWeight: 600, letterSpacing: '-0.02em' },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.2 }
    },
    spacing: compact ? 6 : 8
  })

  return createTheme(theme, {
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--sig-surface-variant': surfaceVariant,
            '--sig-nav-width': '264px',
            '--sig-rail-width': '76px',
            '--sig-titlebar-height': '44px',
            '--sig-mask-a': mix(primary, dark ? '#000000' : '#FFFFFF', 0.22),
            '--sig-mask-b': mix(secondary, primary, 0.55)
          },
          body: {
            backgroundImage:
              mode === 'dark'
                ? `radial-gradient(circle at 12% 12%, ${mix(primary, '#000000', 0.72)} 0%, transparent 42%), radial-gradient(circle at 88% 8%, ${mix(secondary, '#000000', 0.76)} 0%, transparent 38%)`
                : `radial-gradient(circle at 10% 0%, ${mix(primary, '#FFFFFF', 0.88)} 0%, transparent 45%), radial-gradient(circle at 92% 6%, ${mix(secondary, '#FFFFFF', 0.9)} 0%, transparent 40%)`,
            backgroundAttachment: 'fixed'
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: mix(primary, mode === 'dark' ? '#000000' : '#FFFFFF', 0.55),
            borderRadius: 999
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' }
        }
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 999,
            minHeight: touchOptimized ? 48 : 38,
            paddingInline: touchOptimized ? 22 : 16
          }
        }
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: touchOptimized ? 48 : 36, minHeight: touchOptimized ? 48 : 36 } }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            marginInline: 8,
            minHeight: touchOptimized ? 52 : 42,
            '&.Mui-selected': {
              backgroundColor: dark ? mix(primary, '#000000', 0.68) : mix(primary, '#FFFFFF', 0.78),
              color: dark ? mix(primary, '#FFFFFF', 0.6) : mix(primary, '#000000', 0.35)
            }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radius + 4,
            border: `1px solid ${mix(primary, mode === 'dark' ? '#FFFFFF' : '#000000', 0.86)}`
          }
        }
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiTooltip: { defaultProps: { arrow: true } },
      MuiTextField: { defaultProps: { size: compact ? 'small' : 'medium' } }
    }
  })
}
