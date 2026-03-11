"use client";

import { useEditorStore } from "@/store/editorStore";
import {
  Play,
  Sun,
  Moon,
  Settings,
  PanelRight,
  PanelRightClose,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

const emptySubscribe = () => () => {};

export default function Header() {
  const {
    activeProject,
    activeFile,
    compileStatus,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
    showPDF,
    togglePDF,
    fileContent,
    markFileSaved,
  } = useEditorStore();
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const handleCompile = useCallback(async () => {
    if (!activeProject || compileStatus === "compiling") return;

    // Save current file first
    if (activeFile) {
      const content = fileContent[activeFile.path];
      if (content !== undefined) {
        try {
          await fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: activeFile.path, content }),
          });
          markFileSaved(activeFile.path);
        } catch {
          toast.error("Failed to save file");
          return;
        }
      }
    }

    setCompileStatus("compiling");

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: activeProject.path }),
      });
      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
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

      if (result.success) {
        toast.success(`Compiled in ${(result.duration / 1000).toFixed(1)}s`);
      } else {
        toast.error(
          `Compilation failed — ${result.errors.length} error(s)`
        );
      }
    } catch {
      setCompileStatus("error");
      toast.error("Compilation failed");
    }
  }, [
    activeProject,
    activeFile,
    compileStatus,
    fileContent,
    markFileSaved,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleCompile();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "b") {
        e.preventDefault();
        handleCompile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCompile]);

  return (
    <div className="flex h-10 items-center justify-between border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Wiesty&apos;s LaTeX Editor
        </span>
        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        {activeProject ? (
          <span className="text-xs font-medium text-neutral-500">
            {activeProject.name}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">No project selected</span>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCompile}
          disabled={!activeProject || compileStatus === "compiling"}
          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {compileStatus === "compiling" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {compileStatus === "compiling" ? "Compiling..." : "Compile"}
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePDF}
          className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title={showPDF ? "Hide PDF" : "Show PDF"}
        >
          {showPDF ? (
            <PanelRightClose className="h-4 w-4 text-neutral-500" />
          ) : (
            <PanelRight className="h-4 w-4 text-neutral-500" />
          )}
        </button>
        <button
          onClick={() =>
            setTheme(
              resolvedTheme === "dark" ? "light" : "dark"
            )
          }
          className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Toggle theme"
        >
          {mounted &&
            (resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4 text-neutral-500" />
            ) : (
              <Moon className="h-4 w-4 text-neutral-500" />
            ))}
        </button>
        <button
          className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Settings"
        >
          <Settings className="h-4 w-4 text-neutral-500" />
        </button>
      </div>
    </div>
  );
}
