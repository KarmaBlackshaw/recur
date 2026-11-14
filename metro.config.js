const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as a .wasm asset.
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./global.css" });
