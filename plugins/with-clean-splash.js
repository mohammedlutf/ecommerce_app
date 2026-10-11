const fs = require("fs");
const path = require("path");
const { withFinalizedMod } = require("@expo/config-plugins");

const ANIMATED_ICON_ITEM = /<item name="windowSplashScreenAnimatedIcon">[^<]*<\/item>\s*/;

module.exports = function withCleanSplash(config) {
  return withFinalizedMod(config, [
    "android",
    async (config) => {
      const stylesPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/values/styles.xml"
      );
      if (!fs.existsSync(stylesPath)) return config;
      const contents = fs.readFileSync(stylesPath, "utf8");
      if (ANIMATED_ICON_ITEM.test(contents)) {
        fs.writeFileSync(stylesPath, contents.replace(ANIMATED_ICON_ITEM, ""));
      }
      return config;
    },
  ]);
};