import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isLatexBuildArtifact, isTemporaryFile } from "@/lib/latex-artifacts";

const WATCH_EXTENSIONS = new Set([
  ".tex", ".bib", ".sty", ".cls", ".bst",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps",
  ".tikz", ".pgf", ".csv", ".dat", ".txt", ".md",
]);

export const dynamic = "force-dynamic";

function shouldWatchFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return (
    WATCH_EXTENSIONS.has(ext) &&
    !isLatexBuildArtifact(fileName) &&
    !isTemporaryFile(fileName)
  );
}

function fingerprint(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const hash = crypto
      .createHash("sha1")
      .update(fs.readFileSync(filePath))
      .digest("hex");
    return `${stat.size}:${hash}`;
  } catch {
    return null;
  }
}

function collectFingerprints(
  dirPath: string,
  result = new Map<string, string | null>()
) {
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        collectFingerprints(fullPath, result);
      } else if (entry.isFile() && shouldWatchFile(entry.name)) {
        result.set(fullPath, fingerprint(fullPath));
      }
    }
  } catch {
    // A directory may disappear while the initial snapshot is being created.
  }
  return result;
}

export async function GET(request: NextRequest) {
  const projectPath = request.nextUrl.searchParams.get("path");

  if (!projectPath) {
    return new Response("path is required", { status: 400 });
  }

  // Validate directory exists
  try {
    const stat = fs.statSync(projectPath);
    if (!stat.isDirectory()) {
      return new Response("path is not a directory", { status: 400 });
    }
  } catch {
    return new Response("path does not exist", { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      // Send initial connected event
      send({ type: "connected", path: projectPath });

      // Debounce: collect changes and batch them
      let pendingChanges = new Map<string, string>();
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const fingerprints = collectFingerprints(projectPath);

      const flushChanges = () => {
        if (pendingChanges.size === 0) return;
        const rawChanges = Array.from(pendingChanges.entries()).flatMap(
          ([filePath, eventType]) => {
            const hadPreviousFingerprint = fingerprints.has(filePath);
            const previousFingerprint = fingerprints.get(filePath);
            const nextFingerprint = fingerprint(filePath);

            if (previousFingerprint === nextFingerprint) return [];

            if (nextFingerprint === null) {
              fingerprints.delete(filePath);
            } else {
              fingerprints.set(filePath, nextFingerprint);
            }

            return [
              {
                path: filePath,
                name: path.basename(filePath),
                event: eventType,
                kind:
                  nextFingerprint === null
                    ? "deleted"
                    : hadPreviousFingerprint
                      ? "modified"
                      : "created",
                previousFingerprint,
                fingerprint: nextFingerprint,
              },
            ];
          }
        );
        pendingChanges = new Map();

        const deleted = rawChanges.filter((change) => change.kind === "deleted");
        const created = rawChanges.filter((change) => change.kind === "created");
        const pairedCreatedPaths = new Set<string>();
        const pairedDeletedPaths = new Set<string>();
        const renamed = deleted.flatMap((removed) => {
          const added = created.find(
            (candidate) =>
              !pairedCreatedPaths.has(candidate.path) &&
              removed.previousFingerprint &&
              candidate.fingerprint === removed.previousFingerprint
          );
          if (!added) return [];
          pairedDeletedPaths.add(removed.path);
          pairedCreatedPaths.add(added.path);
          return [
            {
              path: removed.path,
              name: removed.name,
              newPath: added.path,
              newName: added.name,
              event: "rename",
              kind: "renamed",
            },
          ];
        });
        const changes = [
          ...renamed,
          ...rawChanges
            .filter(
              (change) =>
                !pairedDeletedPaths.has(change.path) &&
                !pairedCreatedPaths.has(change.path)
            )
            .map(({ previousFingerprint, fingerprint: nextFingerprint, ...change }) => {
              void previousFingerprint;
              void nextFingerprint;
              return change;
            }),
        ];

        if (changes.length > 0) {
          send({ type: "changes", files: changes, timestamp: Date.now() });
        }
      };

      const handleChange = (eventType: string, filename: string | null) => {
        if (!filename || closed) return;
        if (!shouldWatchFile(filename)) return;

        const fullPath = path.join(projectPath, filename);
        pendingChanges.set(fullPath, eventType);

        // Debounce: wait 500ms for more changes before sending
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushChanges, 500);
      };

      let watcher: fs.FSWatcher;
      try {
        watcher = fs.watch(projectPath, { recursive: true }, handleChange);
      } catch {
        send({ type: "error", message: "Failed to watch directory" });
        controller.close();
        return;
      }

      watcher.on("error", () => {
        if (!closed) {
          send({ type: "error", message: "Watcher error" });
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat" });
      }, 30000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        clearInterval(heartbeat);
        watcher.close();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
