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

export function useFileWatcher() {
  const {
    setFileContent,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
    setExternalChangeIndicator,
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

  // Reload an open file, returning true if content actually changed.
  // Never overwrites files the user is currently editing (unsaved changes).
  const reloadOpenFile = useCallback(
    async (filePath: string): Promise<boolean> => {
      const state = useEditorStore.getState();
      const currentContent = state.fileContent[filePath];
      if (currentContent === undefined) return false;

      // Don't touch files with unsaved user changes — the user is still editing.
      const fileTab = state.openFiles.find((f) => f.path === filePath);
      if (fileTab?.unsaved) return false;

      try {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(filePath)}`
        );
        const data = await res.json();
        if (data.content !== undefined && data.content !== currentContent) {
          setFileContent(filePath, data.content);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [setFileContent]
  );

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
    async (files: FileChange[]) => {
      const state = useEditorStore.getState();
      if (!state.activeProject) return;

      const textExts = new Set([
        "tex", "bib", "sty", "cls", "bst", "tikz", "pgf", "csv", "dat", "txt", "md",
      ]);
      const compileExts = new Set(["tex", "bib", "sty", "cls", "bst"]);

      const openPaths = new Set(state.openFiles.map((f) => f.path));
      let hasRealTexChanges = false;
      let hasExternalContentChange = false;

      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        if (openPaths.has(file.path) && textExts.has(ext)) {
          // Reload and check if content actually changed
          const changed = await reloadOpenFile(file.path);
          if (changed && compileExts.has(ext)) {
            hasRealTexChanges = true;
            hasExternalContentChange = true;
          }
        } else if (compileExts.has(ext)) {
          // File not open — assume genuine change
          hasRealTexChanges = true;
        }
      }

      // Show indicator
      const changedNames = files.map((f) => f.name).slice(0, 3);
      const suffix = files.length > 3 ? ` +${files.length - 3} weitere` : "";
      setExternalChangeIndicator(
        `${changedNames.join(", ")}${suffix}`
      );

      // Debounced recompile (3s after last change) — only if actual content changed
      if (hasRealTexChanges && state.autoCompile) {
        if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
        compileTimerRef.current = setTimeout(() => {
          triggerCompile();
        }, 3000);
      }
    },
    [reloadOpenFile, triggerCompile, setExternalChangeIndicator]
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
