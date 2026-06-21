import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * PATH that locates the TeX Live binaries (tlmgr, pdflatex, ...) both inside the
 * Docker image (symlinked into /usr/local/bin) and in local macOS dev (MacTeX).
 * Shared by lib/compile.ts so there is a single source of truth.
 */
export function getTexPath(): string {
  const extra = [
    "/usr/local/bin", // TeX Live binaries symlinked here in the Docker image
    "/Library/TeX/texbin", // macOS (MacTeX), local dev
    "/usr/local/texlive/bin/x86_64-linux", // fallback if symlink missing
  ];
  return [...extra, process.env.PATH].filter(Boolean).join(":");
}

function texEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: getTexPath() };
}

/** Curated set of collections covering the vast majority of real documents. */
export const EXTRA_COLLECTIONS = [
  "collection-latexrecommended",
  "collection-latexextra",
  "collection-fontsrecommended",
  "collection-fontsextra",
  "collection-pictures",
  "collection-bibtexextra",
  "collection-mathscience",
];

/** Everything TeX Live has to offer. */
export const FULL_SCHEME = ["scheme-full"];

export type TexStatus = {
  base: boolean;
  extra: boolean;
  full: boolean;
};

/**
 * Server-side state for the current/last UI-triggered install. Kept in memory so
 * a reloaded browser can fetch the live log and progress (instead of losing it).
 */
export type InstallState = {
  running: boolean;
  target: "extra" | "full" | null;
  log: string[];
  finished: boolean;
  success: boolean;
};

let installState: InstallState = {
  running: false,
  target: null,
  log: [],
  finished: false,
  success: false,
};
/** Separate lock for the silent auto-install-on-compile path. */
let quietRunning = false;

export function getInstallState(): InstallState {
  return installState;
}
export function isInstallRunning(): boolean {
  return installState.running || quietRunning;
}

/**
 * Start a UI install of the given target in the background. Output is buffered
 * into `installState` so any client can read it via GET. Returns false if an
 * install is already in progress. Runtime installs land in TEXMFHOME (persistent
 * volume), so they survive container/image updates.
 */
export function startInstall(target: "extra" | "full"): boolean {
  if (isInstallRunning()) return false;

  const packages = target === "full" ? FULL_SCHEME : EXTRA_COLLECTIONS;
  installState = {
    running: true,
    target,
    log: [`> tlmgr --usermode install ${packages.join(" ")}`],
    finished: false,
    success: false,
  };
  const append = (line: string) => installState.log.push(line);

  const child = spawn("tlmgr", ["--usermode", "install", ...packages], {
    env: texEnv(),
  });

  let buffer = "";
  const handle = (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) append(line);
  };
  child.stdout.on("data", handle);
  child.stderr.on("data", handle);

  child.on("error", (err) => {
    append(`Error: ${err.message}`);
    installState.running = false;
    installState.finished = true;
    installState.success = false;
  });

  child.on("close", async (code) => {
    if (buffer.trim()) append(buffer);
    if (code === 0) {
      append("> updmap-user (refreshing fonts)");
      try {
        await execAsync("updmap-user", { env: texEnv(), timeout: 120000 });
      } catch {
        append("Note: updmap-user skipped.");
      }
      append("✓ Done.");
      installState.success = true;
    } else {
      append(`✗ tlmgr exited with code ${code}.`);
      installState.success = false;
    }
    installState.running = false;
    installState.finished = true;
  });

  return true;
}

/** Names of all currently installed TeX Live packages (system + user tree). */
async function installedPackageNames(): Promise<Set<string>> {
  const { stdout } = await execAsync(
    "tlmgr info --only-installed --data name",
    { env: texEnv(), timeout: 60000, maxBuffer: 1024 * 1024 * 16 }
  );
  return new Set(
    stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  );
}

export async function getInstalledStatus(): Promise<TexStatus> {
  try {
    const installed = await installedPackageNames();
    return {
      base: true,
      // "extra" is considered present once the big common pool is there
      extra: installed.has("collection-latexextra"),
      full: installed.has("scheme-full"),
    };
  } catch {
    return { base: false, extra: false, full: false };
  }
}

/**
 * Inspect a failed compile log, map missing files (.sty/.cls/.fd) to TeX Live
 * packages via `tlmgr search`, and return the package names to install.
 */
export async function resolveMissingPackages(log: string): Promise<string[]> {
  const files = new Set<string>();
  const fileRe = /File `([^']+\.(?:sty|cls|fd|def))' not found/g;
  let m: RegExpExecArray | null;
  while ((m = fileRe.exec(log)) !== null) files.add(m[1]);

  if (files.size === 0) return [];

  const packages = new Set<string>();
  for (const file of files) {
    try {
      const { stdout } = await execAsync(
        `tlmgr search --global --file "/${file}"`,
        { env: texEnv(), timeout: 60000, maxBuffer: 1024 * 1024 * 8 }
      );
      for (const line of stdout.split("\n")) {
        const pkg = line.match(/^([\w@-]+):\s*$/);
        if (pkg) packages.add(pkg[1]);
      }
    } catch {
      // search failed (offline / not found) — ignore this file
    }
  }
  return [...packages];
}

/** Quiet install used by the auto-install-on-compile path. */
export async function installPackagesQuiet(packages: string[]): Promise<boolean> {
  if (packages.length === 0 || isInstallRunning()) return false;
  quietRunning = true;
  try {
    await execAsync(`tlmgr --usermode install ${packages.join(" ")}`, {
      env: texEnv(),
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 16,
    });
    try {
      await execAsync("updmap-user", { env: texEnv(), timeout: 120000 });
    } catch {
      // best effort
    }
    return true;
  } catch {
    return false;
  } finally {
    quietRunning = false;
  }
}
