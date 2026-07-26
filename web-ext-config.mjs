export default {
  sourceDir: "dist",
  artifactsDir: "artifacts/release",
  run: { startUrl: ["https://mail.google.com/"], keepProfileChanges: true },
  lint: { warningsAsErrors: true },
  build: { overwriteDest: true },
};
