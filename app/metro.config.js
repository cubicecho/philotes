const path = require('node:path');
const Module = require('node:module');

const localModules = path.resolve(__dirname, 'node_modules');
const nodePaths = process.env.NODE_PATH?.split(path.delimiter) ?? [];
const isUnlisted = nodePaths.includes(localModules) === false;
if (isUnlisted) {
  process.env.NODE_PATH = [localModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}

const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [localModules, path.resolve(workspaceRoot, 'node_modules')];

/** TypeScript sources import each other by the `.js` name, which Metro has to map back to the source. */
const JS_EXTENSION = '.js';

const nativeWindConfig = withNativewind(config);

const nwResolveRequest = nativeWindConfig.resolver?.resolveRequest ?? null;
nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = nwResolveRequest ?? context.resolveRequest;
  if (moduleName.endsWith(JS_EXTENSION)) {
    const base = moduleName.slice(0, -JS_EXTENSION.length);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return resolve(context, `${base}${ext}`, platform);
      } catch {
        // try next
      }
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = nativeWindConfig;
