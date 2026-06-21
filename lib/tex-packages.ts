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

/** In-memory guard so two installs cannot run concurrently. */
let installRunning = false;
export function isInstallRunning(): boolean {
  return installRunning;
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
 * Install collections via tlmgr user-mode, streaming each output line to `onLog`.
 * Resolves to true on success. Runtime installs land in TEXMFHOME (persistent
 * volume), so they survive container/image updates.
 */
export function installPackages(
  packages: string[],
  onLog: (line: string) => void
): Promise<boolean> {
  if (installRunning) {
    onLog("Eine Installation läuft bereits.");
    return Promise.resolve(false);
  }
  installRunning = true;

  return new Promise<boolean>((resolve) => {
    const args = ["--usermode", "install", ...packages];
    onLog(`> tlmgr ${args.join(" ")}`);

    const child = spawn("tlmgr", args, { env: texEnv() });

    let buffer = "";
    const handle = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) onLog(line);
    };

    child.stdout.on("data", handle);
    child.stderr.on("data", handle);

    child.on("error", (err) => {
      onLog(`Fehler: ${err.message}`);
      installRunning = false;
      resolve(false);
    });

    child.on("close", async (code) => {
      if (buffer.trim()) onLog(buffer);
      if (code === 0) {
        // Refresh font maps / filename db in the user tree (best effort)
        onLog("> updmap-user (Fonts aktualisieren)");
        try {
          await execAsync("updmap-user", { env: texEnv(), timeout: 120000 });
        } catch {
          onLog("Hinweis: updmap-user übersprungen.");
        }
        onLog("✓ Fertig.");
      } else {
        onLog(`✗ tlmgr beendet mit Code ${code}.`);
      }
      installRunning = false;
      resolve(code === 0);
    });
  });
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
  if (packages.length === 0 || installRunning) return false;
  installRunning = true;
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
    installRunning = false;
  }
}
