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

export function useFileWatcher() {
  const {
    activeProject,
    openFiles,
    fileContent,
    setFileContent,
    compileStatus,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
    setExternalChangeIndicator,
  } = useEditorStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompilingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    isCompilingRef.current = compileStatus === "compiling";
  }, [compileStatus]);

  const reloadOpenFile = useCallback(
    async (filePath: string) => {
      // Only reload if file is currently open and has content loaded
      if (fileContent[filePath] === undefined) return;

      try {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(filePath)}`
        );
        const data = await res.json();
        if (data.content !== undefined) {
          setFileContent(filePath, data.content);
        }
      } catch {
        // silently fail — file may have been deleted
      }
    },
    [fileContent, setFileContent]
  );

  const triggerCompile = useCallback(async () => {
    if (!activeProject || isCompilingRef.current) return;

    setCompileStatus("compiling");
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: activeProject.path }),
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
      });
      setPdfTimestamp(Date.now());
    } catch {
      setCompileStatus("error");
    }
  }, [activeProject, setCompileStatus, setCompileResult, setPdfTimestamp]);

  const handleChanges = useCallback(
    (files: FileChange[]) => {
      if (!activeProject) return;

      const textExts = new Set([
        "tex", "bib", "sty", "cls", "bst", "tikz", "pgf", "csv", "dat", "txt", "md",
      ]);

      // Reload any open files that changed
      const openPaths = new Set(openFiles.map((f) => f.path));
      let hasTexChanges = false;

      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        if (openPaths.has(file.path) && textExts.has(ext)) {
          reloadOpenFile(file.path);
        }

        // Check if any .tex or .bib files changed (triggers recompile)
        if (["tex", "bib", "sty", "cls", "bst"].includes(ext)) {
          hasTexChanges = true;
        }
      }

      // Show indicator
      const changedNames = files.map((f) => f.name).slice(0, 3);
      const suffix = files.length > 3 ? ` +${files.length - 3} weitere` : "";
      setExternalChangeIndicator(
        `${changedNames.join(", ")}${suffix}`
      );

      // Debounced recompile (3s after last change)
      if (hasTexChanges) {
        if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
        compileTimerRef.current = setTimeout(() => {
          triggerCompile();
        }, 3000);
      }
    },
    [activeProject, openFiles, reloadOpenFile, triggerCompile, setExternalChangeIndicator]
  );

  // Connect/disconnect SSE
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
          handleChanges(data.files);
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
  }, [activeProject, handleChanges]);
}
