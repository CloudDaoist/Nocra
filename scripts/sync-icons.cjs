const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { appBuilderPath } = require("app-builder-bin");

const projectRoot = path.resolve(__dirname, "..");
const buildDir = path.join(projectRoot, "build");
const sourcePng = path.join(buildDir, "icon.png");

if (!fs.existsSync(sourcePng)) {
  console.error(`Missing source icon: ${sourcePng}`);
  process.exit(1);
}

function generate(format) {
  const result = spawnSync(
    appBuilderPath,
    ["icon", "--input", sourcePng, "--format", format, "--out", buildDir],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Failed to generate ${format}`);
    process.exit(result.status || 1);
  }

  const outputFile = path.join(buildDir, `icon.${format}`);
  if (!fs.existsSync(outputFile)) {
    console.error(`Expected output not found: ${outputFile}`);
    process.exit(1);
  }
}

generate("icns");
generate("ico");

console.log("Synced build/icon.icns and build/icon.ico from build/icon.png");
