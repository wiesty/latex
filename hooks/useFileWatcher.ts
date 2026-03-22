"use client";

import { useEditorStore } from "@/store/editorStore";
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface FileChange {
  path: string;
  name: string;
  event: string;
}

interface WatchEvent {
  type: "connected" | "changes" | "heartbeat" | "error";
  files?: FileChange[];
  message?: string;
}

const COMPILE_COOLDOWN_MS = 5000; // Minimum 5s between auto-compiles
const INTERNAL_WRITE_IGNORE_MS = 2500;

export function useFileWatcher() {
  const {
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
    setExternalChangeIndicator,
    setPendingExternalChanges,
  } = useEditorStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompilingRef = useRef(false);
  const lastCompileEndRef = useRef(0);
  const handleChangesRef = useRef<(files: FileChange[]) => void>(() => {});

  // Keep compiling ref in sync
  const compileStatus = useEditorStore((s) => s.compileStatus);
  const activeProject = useEditorStore((s) => s.activeProject);
  useEffect(() => {
    isCompilingRef.current = compileStatus === "compiling";
  }, [compileStatus]);

  const triggerCompile = useCallback(async () => {
    const state = useEditorStore.getState();
    if (!state.activeProject || isCompilingRef.current) return;

    // Cooldown: don't auto-compile too frequently
    const now = Date.now();
    if (now - lastCompileEndRef.current < COMPILE_COOLDOWN_MS) return;

    setCompileStatus("compiling");
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath: state.activeProject.path,
          mainFile: state.mainFile ?? undefined,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setCompileStatus("error");
        return;
      }

      setCompileResult({
        log: result.log,
        errors: result.errors,
        warnings: result.warnings,
        duration: result.duration,
        success: result.success,
        pdfPath: result.pdfPath,
      });
      setPdfTimestamp(Date.now());
    } catch {
      setCompileStatus("error");
    } finally {
      lastCompileEndRef.current = Date.now();
    }
  }, [setCompileStatus, setCompileResult, setPdfTimestamp]);

  // handleChanges reads latest state directly from store to avoid stale closures
  const handleChanges = useCallback(
    (files: FileChange[]) => {
      const state = useEditorStore.getState();
      if (!state.activeProject) return;

      const textExts = new Set([
        "tex", "bib", "sty", "cls", "bst", "tikz", "pgf", "csv", "dat", "txt", "md",
      ]);
      const compileExts = new Set(["tex", "bib", "sty", "cls", "bst"]);

      const openPaths = new Set(state.openFiles.map((f) => f.path));
      const pendingReloadFiles: Array<{ path: string; name: string }> = [];
      let hasRealTexChanges = false;
      const now = Date.now();

      for (const file of files) {
        const lastInternalWrite = state.internalWriteTimestamps[file.path] ?? 0;
        if (now - lastInternalWrite < INTERNAL_WRITE_IGNORE_MS) {
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        if (openPaths.has(file.path) && textExts.has(ext)) {
          pendingReloadFiles.push({ path: file.path, name: file.name });
          if (compileExts.has(ext)) hasRealTexChanges = true;
        } else if (compileExts.has(ext)) {
          // File not open — assume genuine change
          hasRealTexChanges = true;
        }
      }

      if (pendingReloadFiles.length > 0) {
        setPendingExternalChanges(pendingReloadFiles);
      }

      if (pendingReloadFiles.length === 0 && !hasRealTexChanges) return;

      // Show indicator
      const changedNames = files.map((f) => f.name).slice(0, 3);
      const suffix = files.length > 3 ? ` +${files.length - 3} weitere` : "";
      setExternalChangeIndicator(`${changedNames.join(", ")}${suffix}`);

      // Debounced recompile (3s after last change) — only if actual content changed
      if (hasRealTexChanges && state.autoCompile) {
        if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
        compileTimerRef.current = setTimeout(() => {
          triggerCompile();
        }, 3000);
      }
    },
    [triggerCompile, setExternalChangeIndicator, setPendingExternalChanges]
  );

  // Keep ref in sync for SSE handler
  useEffect(() => {
    handleChangesRef.current = handleChanges;
  }, [handleChanges]);

  // Connect/disconnect SSE — only depends on activeProject
  useEffect(() => {
    if (!activeProject) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Close previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/watch?path=${encodeURIComponent(activeProject.path)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        if (data.type === "changes" && data.files) {
          handleChangesRef.current(data.files);
        } else if (data.type === "error") {
          toast.error(`File watcher: ${data.message}`);
        }
      } catch {
        // invalid JSON
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects, nothing to do
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
    };
  }, [activeProject]);
}
