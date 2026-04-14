const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Required for pnpm monorepos — follow symlinks and resolve from root
config.watchFolders = [monorepoRoot]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Enable symlink resolution for pnpm
config.resolver.unstable_enableSymlinks = true
config.resolver.unstable_enablePackageExports = true

// Ensure pnpm's .pnpm directory is not excluded
config.resolver.disableHierarchicalLookup = true

module.exports = config
