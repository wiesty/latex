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
import ExternalChangesModal from "./ExternalChangesModal";
import SettingsModal from "./SettingsModal";

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
    closeFile,
    replaceOpenFile,
    setMainFile,
  } = useEditorStore();
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [showReloadModal, setShowReloadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const uiHydrated = mounted;

  // Keep first client render identical to SSR output to avoid hydration mismatches.
  const autoCompileUI = uiHydrated ? autoCompile : true;
  const autoSaveUI = uiHydrated ? autoSave : true;
  const autoScrollUI = uiHydrated ? autoScroll : true;

  const compileProject = useCallback(async () => {
    const state = useEditorStore.getState();
    if (!state.activeProject || state.compileStatus === "compiling") return false;

    setCompileStatus("compiling");
    try {
      const entryFile =
        state.mainFile ??
        (state.activeFile?.name.endsWith(".tex")
          ? state.activeFile.name
          : "main.tex");
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath: state.activeProject.path,
          mainFile: entryFile,
        }),
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
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  ]);

  const saveFile = useCallback(
    async (path: string, content: string) => {
      markInternalWrite(path);
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Save failed");
      }
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

  const acceptExternalChanges = useCallback(async () => {
    try {
      for (const change of pendingExternalChanges) {
        if (change.kind === "deleted") {
          closeFile(change.path);
          if (mainFile === change.name) setMainFile(null);
          continue;
        }

        if (change.kind === "renamed" && change.newPath && change.newName) {
          replaceOpenFile(
            change.path,
            { path: change.newPath, name: change.newName },
            change.externalContent ?? ""
          );
          if (mainFile === change.name) setMainFile(change.newName);
          continue;
        }

        if (change.externalContent !== undefined) {
          setFileContent(change.path, change.externalContent);
          markFileSaved(change.path);
        }
      }
      clearPendingExternalChanges();
      setShowReloadModal(false);
      toast.success("File-system changes accepted");
      await compileProject();
    } catch {
      toast.error("Failed to apply external changes");
    }
  }, [
    pendingExternalChanges,
    closeFile,
    mainFile,
    setMainFile,
    replaceOpenFile,
    setFileContent,
    markFileSaved,
    clearPendingExternalChanges,
    compileProject,
  ]);

  const keepEditorChanges = useCallback(async () => {
    try {
      for (const change of pendingExternalChanges) {
        const content = change.localContent ?? fileContent[change.path];
        if (content === undefined) {
          throw new Error(`Editor content for ${change.name} is not loaded`);
        }
        const targetPath =
          change.kind === "renamed" && change.newPath
            ? change.newPath
            : change.path;
        await saveFile(targetPath, content);

        if (change.kind === "renamed" && change.newName) {
          replaceOpenFile(
            change.path,
            { path: targetPath, name: change.newName },
            content
          );
          if (mainFile === change.name) setMainFile(change.newName);
        } else {
          markFileSaved(change.path);
        }
      }
      clearPendingExternalChanges();
      setShowReloadModal(false);
      toast.success("Editor versions saved");
      await compileProject();
    } catch {
      toast.error("Failed to save editor versions");
    }
  }, [
    pendingExternalChanges,
    fileContent,
    saveFile,
    replaceOpenFile,
    mainFile,
    setMainFile,
    markFileSaved,
    clearPendingExternalChanges,
    compileProject,
  ]);

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
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
          onClick={() => setShowSettings(true)}
          className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Settings"
        >
          <Settings className="h-4 w-4 text-neutral-500" />
        </button>
      </div>

      {showReloadModal && (
        <ExternalChangesModal
          changes={pendingExternalChanges}
          localContent={fileContent}
          onClose={() => setShowReloadModal(false)}
          onKeepEditor={keepEditorChanges}
          onAcceptExternal={acceptExternalChanges}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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
