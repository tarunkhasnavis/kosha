import type { Config } from 'tailwindcss'
import sharedConfig from '@kosha/tailwind-config'

const config: Config = {
  ...sharedConfig,
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}

export default config
