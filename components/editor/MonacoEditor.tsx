"use client";

import { useEditorStore } from "@/store/editorStore";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { latexLanguageConfig, latexMonarchTokens } from "./latex-language";
import type { editor as MonacoEditorType } from "monaco-editor";
import { toast } from "sonner";

export default function MonacoEditor() {
  const {
    activeFile,
    activeProject,
    fileContent,
    setFileContent,
    markFileUnsaved,
    markFileSaved,
    setCursorPosition,
    editorFontSize,
    showMinimap,
    wordWrap,
    parsedErrors,
    setCompileStatus,
    setCompileResult,
    setPdfTimestamp,
  } = useEditorStore();
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<MonacoEditorType.IStandaloneCodeEditor | null>(null);
  const fetchingRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        toast.error(`${result.errors.length} error(s)`);
      }
    } catch {
      toast.error("Save/compile failed");
      setCompileStatus("error");
    }
  }, [
    activeFile,
    activeProject,
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

      // Cursor position tracking
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition(e.position.lineNumber, e.position.column);
      });
    },
    [handleSaveAndCompile, setCursorPosition]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeFile || value === undefined) return;
      setFileContent(activeFile.path, value);
      markFileUnsaved(activeFile.path);

      // Auto-save debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        handleSaveAndCompile();
      }, 1500);
    },
    [activeFile, setFileContent, markFileUnsaved, handleSaveAndCompile]
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

  // Clean up debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <EditorTabs />
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
          }}
        />
      </div>
    </div>
  );
}

function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useEditorStore();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
      {openFiles.map((file) => (
        <div
          key={file.path}
          className={`group flex items-center gap-1.5 border-r border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-800 ${
            activeFile?.path === file.path
              ? "bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-300"
          }`}
        >
          <button
            onClick={() =>
              setActiveFile({ path: file.path, name: file.name, unsaved: file.unsaved })
            }
            className="flex items-center gap-1.5"
          >
            {file.unsaved && (
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
            <span>{file.name}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file.path);
            }}
            className="ml-1 hidden rounded p-0.5 hover:bg-neutral-200 group-hover:block dark:hover:bg-neutral-700"
          >
            <span className="text-[10px] text-neutral-400">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
}
