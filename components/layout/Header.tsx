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
  Download,
  Save,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

const emptySubscribe = () => () => {};

export default function Header() {
  const {
    activeProject,
    activeFile,
    mainFile,
    compileStatus,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
    showPDF,
    togglePDF,
    fileContent,
    markFileSaved,
    autoCompile,
    setAutoCompile,
    autoSave,
    setAutoSave,
    autoScroll,
    setAutoScroll,
    pendingExternalChanges,
    clearPendingExternalChanges,
    setFileContent,
    markInternalWrite,
  } = useEditorStore();
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [showReloadModal, setShowReloadModal] = useState(false);
  const uiHydrated = mounted;

  // Keep first client render identical to SSR output to avoid hydration mismatches.
  const autoCompileUI = uiHydrated ? autoCompile : true;
  const autoSaveUI = uiHydrated ? autoSave : true;
  const autoScrollUI = uiHydrated ? autoScroll : true;

  const compileProject = useCallback(async () => {
    if (!activeProject || compileStatus === "compiling") return false;

    setCompileStatus("compiling");
    try {
      const entryFile =
        mainFile ??
        (activeFile?.name.endsWith(".tex") ? activeFile.name : "main.tex");
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: activeProject.path, mainFile: entryFile }),
      });
      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        setCompileStatus("error");
        return false;
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

      if (result.success) {
        toast.success(`Compiled in ${(result.duration / 1000).toFixed(1)}s`);
      } else {
        toast.error(`Compilation failed — ${result.errors.length} error(s)`);
      }
      return result.success;
    } catch {
      setCompileStatus("error");
      toast.error("Compilation failed");
      return false;
    }
  }, [
    activeProject,
    activeFile,
    compileStatus,
    mainFile,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  ]);

  const saveFile = useCallback(
    async (path: string, content: string) => {
      markInternalWrite(path);
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (useEditorStore.getState().fileContent[path] === content) {
        markFileSaved(path);
      }
    },
    [markFileSaved, markInternalWrite]
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeFile) return true;
    const content = fileContent[activeFile.path];
    if (content === undefined) return true;

    try {
      await saveFile(activeFile.path, content);
      toast.success("File saved");
      if (autoCompile) {
        await compileProject();
      }
      return true;
    } catch {
      toast.error("Save failed");
      return false;
    }
  }, [activeFile, fileContent, saveFile, autoCompile, compileProject]);

  const saveUnsavedOpenFiles = useCallback(async () => {
    const state = useEditorStore.getState();
    const unsavedFiles = state.openFiles.filter((f) => f.unsaved);
    if (unsavedFiles.length === 0) return true;

    try {
      for (const file of unsavedFiles) {
        const content = state.fileContent[file.path];
        if (content !== undefined) {
          await saveFile(file.path, content);
        }
      }
      toast.success(`${unsavedFiles.length} file(s) saved`);
      return true;
    } catch {
      toast.error("Failed to save before reload");
      return false;
    }
  }, [saveFile]);

  const reloadPendingFiles = useCallback(async (filesToReload: Array<{ path: string; name: string }>) => {
    if (filesToReload.length === 0) return;

    try {
      for (const file of filesToReload) {
        const res = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`);
        const data = await res.json();
        if (data.content !== undefined) {
          setFileContent(file.path, data.content);
          markFileSaved(file.path);
        }
      }
      clearPendingExternalChanges();
      toast.success("External changes reloaded");
    } catch {
      toast.error("Reload failed");
    }
  }, [clearPendingExternalChanges, setFileContent, markFileSaved]);

  const handleReloadConfirm = useCallback(
    async (saveBeforeReload: boolean) => {
      const filesToReload = [...pendingExternalChanges];

      if (saveBeforeReload) {
        const saved = await saveUnsavedOpenFiles();
        if (!saved) return;
      }

      // Close immediately to avoid rendering an empty modal while async work runs.
      setShowReloadModal(false);

      await reloadPendingFiles(filesToReload);
      await compileProject();
    },
    [pendingExternalChanges, saveUnsavedOpenFiles, reloadPendingFiles, compileProject]
  );

  const handleCompile = useCallback(async () => {
    if (!activeProject || compileStatus === "compiling") return;

    // Save current file first
    if (activeFile) {
      const content = fileContent[activeFile.path];
      if (content !== undefined) {
        try {
          await saveFile(activeFile.path, content);
        } catch {
          toast.error("Failed to save file");
          return;
        }
      }
    }

    await compileProject();
  }, [
    activeProject,
    activeFile,
    compileStatus,
    fileContent,
    saveFile,
    compileProject,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        const target = e.target as HTMLElement | null;
        if (target?.closest(".monaco-editor")) return;
        e.preventDefault();
        saveActiveFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "b") {
        e.preventDefault();
        handleCompile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCompile, saveActiveFile]);

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
        <HeaderTooltip
          label="Auto Compile"
          description="Automatically compiles the project when watched source files change."
        >
          <div className="flex items-center gap-1.5">
            <button
              role="switch"
              aria-checked={autoCompileUI}
              aria-label="Toggle auto compile"
              onClick={() => setAutoCompile(!autoCompile)}
              disabled={!activeProject}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                autoCompileUI ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  autoCompileUI ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-neutral-400">Compile</span>
          </div>
        </HeaderTooltip>
        <HeaderTooltip
          label="Auto Save"
          description="Saves your edits automatically. In manual mode, use Save to persist and compile."
        >
          <div className="flex items-center gap-1.5">
            <button
              role="switch"
              aria-checked={autoSaveUI}
              aria-label="Toggle auto save"
              onClick={() => setAutoSave(!autoSave)}
              disabled={!activeProject}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                autoSaveUI ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  autoSaveUI ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-neutral-400">Save</span>
          </div>
        </HeaderTooltip>
        <HeaderTooltip
          label="Auto Scroll"
          description="Keeps the PDF view synced with your cursor position while editing TeX files."
        >
          <div className="flex items-center gap-1.5">
            <button
              role="switch"
              aria-checked={autoScrollUI}
              aria-label="Toggle auto scroll"
              onClick={() => setAutoScroll(!autoScroll)}
              disabled={!activeProject}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                autoScrollUI ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  autoScrollUI ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-neutral-400">Scroll</span>
          </div>
        </HeaderTooltip>
        {!autoSaveUI && (
          <button
            onClick={saveActiveFile}
            disabled={!activeProject || !activeFile || compileStatus === "compiling"}
            className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            title="Save file"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        )}
        {pendingExternalChanges.length > 0 && (
          <button
            onClick={() => setShowReloadModal(true)}
            disabled={!activeProject}
            className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
            title="Reload external changes"
          >
            <RefreshCw className="h-3 w-3" />
            Reload ({pendingExternalChanges.length})
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            if (!activeProject) return;
            const url = `/api/projects/export?path=${encodeURIComponent(activeProject.path)}`;
            const a = document.createElement("a");
            a.href = url;
            a.download = `${activeProject.name}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }}
          disabled={!activeProject}
          className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Export project as ZIP"
        >
          <Download className="h-4 w-4 text-neutral-500" />
        </button>
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

      {showReloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              External changes detected
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              Changes were detected in {pendingExternalChanges.length} file(s).
              Do you want to save before reload to avoid losing local edits?
            </p>
            <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {pendingExternalChanges.slice(0, 5).map((file) => (
                <div key={file.path} className="truncate">{file.name}</div>
              ))}
              {pendingExternalChanges.length > 5 && (
                <div className="text-neutral-500 dark:text-neutral-400">
                  +{pendingExternalChanges.length - 5} more
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowReloadModal(false)}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReloadConfirm(false)}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/45"
              >
                Reload without saving
              </button>
              <button
                onClick={() => handleReloadConfirm(true)}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Save and reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderTooltip({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-60 -translate-x-1/2 rounded-lg border border-neutral-200/80 bg-white/95 p-2 shadow-lg opacity-0 backdrop-blur-sm transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-neutral-700/80 dark:bg-neutral-900/95">
        <p className="text-[11px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
          {label}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
          {description}
        </p>
      </div>
    </div>
  );
}
