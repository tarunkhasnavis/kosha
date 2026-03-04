import type { Config } from 'tailwindcss'
import sharedConfig from '@kosha/tailwind-config'

const config: Config = {
  ...sharedConfig,
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}

export default config
