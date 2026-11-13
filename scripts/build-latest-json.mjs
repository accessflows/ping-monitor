// Assembles the Tauri updater manifest (latest.json) from the downloaded CI artifacts.
//
// Each build job writes an `updater-platform.txt` marker file next to its bundles, which
// maps a build to its updater platform key (e.g. windows-x86_64, darwin-aarch64).
//
// Required env: VERSION, REPOSITORY (owner/name), TAG, OUTPUT (default latest.json)

import fs from "node:fs";
import path from "node:path";

const VERSION = process.env.VERSION;
const REPOSITORY = process.env.REPOSITORY;
const TAG = process.env.TAG;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? "artifacts";
const OUTPUT = process.env.OUTPUT ?? "latest.json";
const NOTES = process.env.NOTES ?? `Ping Monitor ${VERSION}`;

if (!VERSION || !REPOSITORY || !TAG) {
  console.error("VERSION, REPOSITORY and TAG are required");
  process.exit(1);
}

/** Picks the updatable file for a platform and pairs it with its `.sig` file. */
const UPDATER_ASSET = {
  windows: (name) => name.endsWith("-setup.exe"),
  darwin: (name) => name.endsWith(".app.tar.gz"),
  // Tauri v2 signs the AppImage itself; older builds used a tarball.
  linux: (name) => name.endsWith(".AppImage") || name.endsWith(".AppImage.tar.gz"),
};

const PLATFORM_MARKER = "updater-platform.txt";

const findPlatformDirs = () => {
  if (!fs.existsSync(ARTIFACTS_DIR)) return [];
  return fs
    .readdirSync(ARTIFACTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(ARTIFACTS_DIR, entry.name));
};

const downloadUrl = (fileName) =>
  `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(TAG)}/${encodeURIComponent(fileName)}`;

const platforms = {};
const problems = [];

for (const dir of findPlatformDirs()) {
  const markerPath = path.join(dir, PLATFORM_MARKER);
  if (!fs.existsSync(markerPath)) continue;

  const platform = fs.readFileSync(markerPath, "utf8").trim();
  const matcher = UPDATER_ASSET[platform.split("-")[0]];
  if (!matcher) {
    problems.push(`${platform}: unknown updater platform prefix`);
    continue;
  }

  const files = fs.readdirSync(dir);
  const asset = files.find((name) => matcher(name) && !name.endsWith(".sig"));
  if (!asset) {
    problems.push(`${platform}: no updatable bundle found in ${dir} (${files.join(", ") || "empty"})`);
    continue;
  }

  const sigPath = path.join(dir, `${asset}.sig`);
  if (!fs.existsSync(sigPath)) {
    problems.push(`${platform}: missing signature for ${asset} — is TAURI_SIGNING_PRIVATE_KEY set?`);
    continue;
  }

  platforms[platform] = {
    signature: fs.readFileSync(sigPath, "utf8").trim(),
    url: downloadUrl(asset),
  };
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}
if (Object.keys(platforms).length === 0) {
  console.error("::error::No updater artifacts found");
  process.exit(1);
}

const manifest = {
  version: VERSION,
  notes: NOTES,
  pub_date: new Date().toISOString(),
  platforms,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${OUTPUT} for ${VERSION}:`);
console.log(JSON.stringify(platforms, null, 2));
