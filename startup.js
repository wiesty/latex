#!/usr/bin/env node
// startup.js — Custom banner wrapper for Next.js standalone server

const originalLog = console.log;

// Ensure a tlmgr user tree exists in TEXMFHOME (persistent volume) so the
// non-root user can install additional TeX packages/fonts at runtime. Runs once
// on first start (and after a fresh volume); idempotent and best-effort.
function ensureTexUserTree() {
  const texmfHome = process.env.TEXMFHOME;
  if (!texmfHome) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require("child_process");

    // Ensure the writable user TEXMF trees exist on the volume (needed so
    // updmap/format postactions succeed for Type1 font packages).
    for (const dir of [process.env.TEXMFVAR, process.env.TEXMFCONFIG]) {
      if (dir) fs.mkdirSync(dir, { recursive: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (fs.existsSync(require("path").join(texmfHome, "web2c"))) return;
    execFileSync("tlmgr", ["init-usertree"], { stdio: "ignore" });
  } catch {
    // tlmgr unavailable (e.g. local dev) — ignore
  }
}

ensureTexUserTree();

// Next.js default startup lines we want to suppress
const SUPPRESS_PATTERNS = [
  /▲ Next\.js/,
  /^\s*- Local:/,
  /^\s*- Network:/,
  /✓ Starting/,
  /✓ Ready in/,
];

let bannerShown = false;

console.log = (...args) => {
  const msg = args.map(String).join(" ");

  // Suppress empty lines that are part of the Next.js banner block
  // (only while banner hasn't been shown yet)
  if (!bannerShown && msg.trim() === "") {
    return;
  }

  if (SUPPRESS_PATTERNS.some((p) => p.test(msg))) {
    // On the "Ready" line, swap in our banner
    if (/✓ Ready in/.test(msg) && !bannerShown) {
      bannerShown = true;
      const match = msg.match(/Ready in (.+)/);
      const timing = match ? match[1] : "";
      printBanner(timing);
    }
    return;
  }

  originalLog(...args);
};

function printBanner(timing) {
  const projectsDir = process.env.LATEX_PROJECTS_DIR || "/projects";
  const buildDate   = process.env.BUILD_DATE || "dev";
  const port        = process.env.PORT || "3107";
  const hostname    = process.env.HOSTNAME || "0.0.0.0";
  const texHome     = process.env.TEXMFHOME;

  originalLog([
    "",
    "  ✦  Wiesty's LaTeX Editor",
    "",
    `  - Build date:     ${buildDate}`,
    `  - Local:          http://localhost:${port}`,
    `  - Network:        http://${hostname}:${port}`,
    `  - Projects path:  ${projectsDir}`,
    ...(texHome ? [`  - TeX packages:   ${texHome}`] : []),
    "",
    timing ? `  ✓ Ready in ${timing}` : "  ✓ Ready",
    "",
  ].join("\n"));
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./server.js");
