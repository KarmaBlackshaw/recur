const { withGradleProperties } = require("expo/config-plugins");

// Drops Fresco's GIF and WebP decoders (~1.4 MB of native libraries across the two ABIs).
// Static WebP still decodes through Android itself; the app shows no GIFs.
// expo-build-properties documents `gifEnabled` / `webpEnabled`, but 57.0.22 doesn't apply them.
const PROPERTIES = { "expo.gif.enabled": "false", "expo.webp.enabled": "false" };

module.exports = function withoutFrescoDecoders(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = cfg.modResults.find((item) => item.type === "property" && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: "property", key, value });
      }
    }
    return cfg;
  });
};
