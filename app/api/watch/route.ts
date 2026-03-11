import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const WATCH_EXTENSIONS = new Set([
  ".tex", ".bib", ".sty", ".cls", ".bst",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps",
  ".tikz", ".pgf", ".csv", ".dat", ".txt", ".md",
]);

// LaTeX build artifacts to ignore
const IGNORE_EXTENSIONS = new Set([
  ".aux", ".log", ".out", ".toc", ".lof", ".lot",
  ".fls", ".fdb_latexmk", ".synctex.gz", ".synctex",
  ".bbl", ".blg", ".bcf", ".run.xml",
  ".nav", ".snm", ".vrb", ".idx", ".ind", ".ilg",
  ".glg", ".glo", ".gls", ".ist",
]);

export const dynamic = "force-dynamic";

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

      const flushChanges = () => {
        if (pendingChanges.size === 0) return;
        const changes = Array.from(pendingChanges.entries()).map(
          ([filePath, eventType]) => ({
            path: filePath,
            name: path.basename(filePath),
            event: eventType,
          })
        );
        send({ type: "changes", files: changes, timestamp: Date.now() });
        pendingChanges = new Map();
      };

      const handleChange = (eventType: string, filename: string | null) => {
        if (!filename || closed) return;
        const ext = path.extname(filename).toLowerCase();

        // Ignore build artifacts
        if (IGNORE_EXTENSIONS.has(ext)) return;

        // Only watch known extensions
        if (!WATCH_EXTENSIONS.has(ext)) return;

        // Ignore hidden files
        if (filename.startsWith(".")) return;

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
