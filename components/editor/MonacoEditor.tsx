"use client";

import { useEditorStore } from "@/store/editorStore";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { latexLanguageConfig, latexMonarchTokens } from "./latex-language";
import type { editor as MonacoEditorType } from "monaco-editor";
import { toast } from "sonner";
import EditorTabs from "./EditorTabs";
import FilePreview, { isPreviewable, isReadOnlyFile } from "./FilePreview";

export default function MonacoEditor() {
  const {
    activeFile,
    activeProject,
    mainFile,
    fileContent,
    setFileContent,
    markFileUnsaved,
    markFileSaved,
    setCursorPosition,
    setCurrentPDFPage,
    autoScroll,
    editorFontSize,
    showMinimap,
    wordWrap,
    parsedErrors,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  } = useEditorStore();

  const readOnly = !!(activeFile && isReadOnlyFile(activeFile.name));
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<MonacoEditorType.IStandaloneCodeEditor | null>(null);
  const fetchingRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncScrollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeProjectRef = useRef(activeProject);
  const activeFileRef = useRef(activeFile);
  const mainFileRef = useRef(mainFile);
  const autoScrollRef = useRef(autoScroll);

  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { mainFileRef.current = mainFile; }, [mainFile]);
  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);

  const isLoading = !!(activeFile && fileContent[activeFile.path] === undefined);

  // Load file content when active file changes
  useEffect(() => {
    if (!activeFile) return;
    if (fileContent[activeFile.path] !== undefined) return;
    if (fetchingRef.current === activeFile.path) return;

    fetchingRef.current = activeFile.path;
    let cancelled = false;

    fetch(`/api/files?path=${encodeURIComponent(activeFile.path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.content !== undefined) {
          setFileContent(activeFile.path, data.content);
        }
      })
      .catch(() => { if (!cancelled) toast.error("Failed to load file"); })
      .finally(() => { if (!cancelled) fetchingRef.current = null; });

    return () => { cancelled = true; };
  }, [activeFile, fileContent, setFileContent]);

  const handleSaveAndCompile = useCallback(async () => {
    if (!activeFile || !activeProject) return;

    const content = fileContent[activeFile.path];
    if (content === undefined) return;

    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFile.path, content }),
      });
      markFileSaved(activeFile.path);

      // Trigger compile
      setCompileStatus("compiling");
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath: activeProject.path,
          mainFile: mainFile ?? (activeFile.name.endsWith(".tex") ? activeFile.name : undefined),
        }),
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
        pdfPath: result.pdfPath,
      });
      setPdfTimestamp(Date.now());

      if (result.success) {
        toast.success(`Compiled in ${(result.duration / 1000).toFixed(1)}s`);
      } else {
        toast.error(`${result.errors.length} error(s)`);
      }
    } catch {
      toast.error("Save/compile failed");
      setCompileStatus("error");
    }
  }, [
    activeFile,
    activeProject,
    mainFile,
    fileContent,
    markFileSaved,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  ]);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Register LaTeX language
      if (
        !monaco.languages
          .getLanguages()
          .some((lang: { id: string }) => lang.id === "latex")
      ) {
        monaco.languages.register({ id: "latex", extensions: [".tex"] });
        monaco.languages.setLanguageConfiguration(
          "latex",
          latexLanguageConfig
        );
        monaco.languages.setMonarchTokensProvider(
          "latex",
          latexMonarchTokens
        );
      }

      // Register BibTeX language (basic)
      if (
        !monaco.languages
          .getLanguages()
          .some((lang: { id: string }) => lang.id === "bibtex")
      ) {
        monaco.languages.register({ id: "bibtex", extensions: [".bib"] });
      }

      // Cmd+S shortcut
      editor.addAction({
        id: "save-and-compile",
        label: "Save and Compile",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          handleSaveAndCompile();
        },
      });

      // Cursor position tracking + debounced SyncTeX scroll
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition(e.position.lineNumber, e.position.column);

        const proj = activeProjectRef.current;
        const file = activeFileRef.current;
        if (!proj || !file?.name.endsWith(".tex") || !autoScrollRef.current) return;

        if (syncScrollRef.current) clearTimeout(syncScrollRef.current);
        syncScrollRef.current = setTimeout(async () => {
          const mf = mainFileRef.current ?? "main.tex";
          try {
            const res = await fetch(
              `/api/synctex?projectPath=${encodeURIComponent(proj.path)}&mainFile=${encodeURIComponent(mf)}&texFile=${encodeURIComponent(file.name)}&line=${e.position.lineNumber}`
            );
            const data = await res.json();
            if (data.page) setCurrentPDFPage(data.page);
          } catch {
            // silently ignore synctex errors
          }
        }, 400);
      });
    },
    [handleSaveAndCompile, setCursorPosition, setCurrentPDFPage]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeFile || value === undefined || readOnly) return;
      setFileContent(activeFile.path, value);
      markFileUnsaved(activeFile.path);

      // Auto-save debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        handleSaveAndCompile();
      }, 1500);
    },
    [activeFile, readOnly, setFileContent, markFileUnsaved, handleSaveAndCompile]
  );

  // Update error markers
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const monaco = (window as unknown as Record<string, unknown>).monaco as typeof import("monaco-editor") | undefined;
    if (!monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const markers = parsedErrors
      .filter((e) => e.line !== null)
      .map((e) => ({
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: e.line!,
        startColumn: 1,
        endLineNumber: e.line!,
        endColumn: model.getLineMaxColumn(e.line!),
      }));

    monaco.editor.setModelMarkers(model, "latex", markers);
  }, [parsedErrors, activeFile]);

  // Clean up debounces
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (syncScrollRef.current) clearTimeout(syncScrollRef.current);
    };
  }, []);

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-sm text-neutral-400">No file open</p>
          <p className="mt-1 text-xs text-neutral-300 dark:text-neutral-600">
            Select a file from the sidebar
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-neutral-950">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  const language = activeFile.name.endsWith(".bib") ? "bibtex" : "latex";

  // Preview for binary/previewable files
  if (isPreviewable(activeFile.name)) {
    return (
      <div className="flex h-full flex-col">
        <EditorTabs />
        <FilePreview path={activeFile.path} name={activeFile.name} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <EditorTabs />
      {/* Read-only banner */}
      {readOnly && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <span className="font-medium">Read-only</span>
          <span className="text-amber-500 dark:text-amber-600">—</span>
          <span>This file is generated and cannot be edited.</span>
        </div>
      )}
      {/* Editor */}
      <div className="flex-1">
        <Editor
          language={language}
          value={fileContent[activeFile.path] ?? ""}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          options={{
            fontSize: editorFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
            fontLigatures: true,
            minimap: { enabled: showMinimap },
            wordWrap: wordWrap ? "on" : "off",
            lineNumbers: "on",
            renderLineHighlight: "line",
            scrollBeyondLastLine: false,
            padding: { top: 8, bottom: 8 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            tabSize: 2,
            readOnly,
            readOnlyMessage: { value: "This file is generated and cannot be edited." },
          }}
        />
      </div>
    </div>
  );
}
