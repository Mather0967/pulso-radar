import { createTheme, type MantineColorsTuple } from '@mantine/core'

const mandarin: MantineColorsTuple = [
  '#fff4ed',
  '#ffe6d5',
  '#ffcaa9',
  '#ffa673',
  '#ff8a4c',
  '#ff762e',
  '#e6621b',
  '#bf4c12',
  '#983d14',
  '#7a3414',
]

// Derived from Medianoche #11222C.
const medianoche: MantineColorsTuple = [
  '#F7F5EF',
  '#c4d2da',
  '#8aa2b0',
  '#405C6B',
  '#2a4a5b',
  '#1e3846',
  '#172d39',
  '#11222c',
  '#0a151c',
  '#060d12',
]

const plusJakarta = '"Plus Jakarta Sans", system-ui, sans-serif'

export const rivectTheme = createTheme({
  colors: {
    mandarin,
    dark: medianoche,
  },
  primaryColor: 'mandarin',
  primaryShade: 5,
  fontFamily: plusJakarta,
  fontFamilyMonospace: '"JetBrains Mono", monospace',
  headings: {
    fontFamily: plusJakarta,
    fontWeight: '700',
  },
  defaultRadius: 'md',
})
