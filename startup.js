#!/usr/bin/env node
// startup.js — Custom banner wrapper for Next.js standalone server

const originalLog = console.log;

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

  originalLog([
    "",
    "  ✦  Wiesty's LaTeX Editor",
    "",
    `  - Build date:     ${buildDate}`,
    `  - Local:          http://localhost:${port}`,
    `  - Network:        http://${hostname}:${port}`,
    `  - Projects path:  ${projectsDir}`,
    "",
    timing ? `  ✓ Ready in ${timing}` : "  ✓ Ready",
    "",
  ].join("\n"));
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./server.js");
