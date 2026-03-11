import { create } from "zustand";
import { Project, FileTab, ParsedError } from "@/types";

interface EditorStore {
  // Projects
  projects: Project[];
  activeProject: Project | null;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;

  // Files
  openFiles: FileTab[];
  activeFile: FileTab | null;
  setActiveFile: (file: FileTab | null) => void;
  openFile: (file: FileTab) => void;
  closeFile: (path: string) => void;
  markFileUnsaved: (path: string) => void;
  markFileSaved: (path: string) => void;

  // Main file (entry point for compilation)
  mainFile: string | null;
  setMainFile: (file: string | null) => void;

  // Content
  fileContent: Record<string, string>;
  setFileContent: (path: string, content: string) => void;

  // Compile
  compileStatus: "idle" | "compiling" | "success" | "error";
  lastCompileTime: number | null;
  compileLog: string;
  parsedErrors: ParsedError[];
  parsedWarnings: ParsedError[];
  compiledPdfPath: string | null;
  setCompileStatus: (status: "idle" | "compiling" | "success" | "error") => void;
  setCompileResult: (result: {
    log: string;
    errors: ParsedError[];
    warnings: ParsedError[];
    duration: number;
    success: boolean;
    pdfPath?: string;
  }) => void;

  // PDF
  pdfTimestamp: number;
  setPdfTimestamp: (t: number) => void;

  // UI
  showFileTree: boolean;
  showLogPanel: boolean;
  showPDF: boolean;
  editorFontSize: number;
  pdfZoom: number;
  currentPDFPage: number;
  totalPDFPages: number;
  toggleFileTree: () => void;
  toggleLogPanel: () => void;
  togglePDF: () => void;
  setEditorFontSize: (size: number) => void;
  setPdfZoom: (zoom: number) => void;
  setCurrentPDFPage: (page: number) => void;
  setTotalPDFPages: (total: number) => void;
  showMinimap: boolean;
  toggleMinimap: () => void;
  wordWrap: boolean;
  toggleWordWrap: () => void;

  // Cursor
  cursorLine: number;
  cursorColumn: number;
  setCursorPosition: (line: number, column: number) => void;

  // File watcher
  externalChangeIndicator: string | null;
  setExternalChangeIndicator: (msg: string | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  // Projects
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (project) =>
    set((state) => {
      if (project?.id === state.activeProject?.id) return { activeProject: project };
      // Clear open files, content, and PDF when switching projects
      return {
        activeProject: project,
        openFiles: [],
        activeFile: null,
        fileContent: {},
        compileStatus: "idle" as const,
        compileLog: "",
        parsedErrors: [],
        parsedWarnings: [],
        mainFile: null,
        compiledPdfPath: null,
      };
    }),

  // Files
  openFiles: [],
  activeFile: null,
  setActiveFile: (file) => set({ activeFile: file }),
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.path === file.path);
      if (exists) {
        return { activeFile: file };
      }
      return { openFiles: [...state.openFiles, file], activeFile: file };
    }),
  closeFile: (path) =>
    set((state) => {
      const filtered = state.openFiles.filter((f) => f.path !== path);
      const newActive =
        state.activeFile?.path === path
          ? filtered[filtered.length - 1] || null
          : state.activeFile;
      const newContent = { ...state.fileContent };
      delete newContent[path];
      return { openFiles: filtered, activeFile: newActive, fileContent: newContent };
    }),
  markFileUnsaved: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, unsaved: true } : f
      ),
    })),
  markFileSaved: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, unsaved: false } : f
      ),
    })),

  // Main file
  mainFile: null,
  setMainFile: (file) => set({ mainFile: file }),

  // Content
  fileContent: {},
  setFileContent: (path, content) =>
    set((state) => ({
      fileContent: { ...state.fileContent, [path]: content },
    })),

  // Compile
  compileStatus: "idle",
  lastCompileTime: null,
  compileLog: "",
  parsedErrors: [],
  parsedWarnings: [],
  compiledPdfPath: null,
  setCompileStatus: (status) => set({ compileStatus: status }),
  setCompileResult: (result) =>
    set({
      compileStatus: result.success ? "success" : "error",
      lastCompileTime: result.duration,
      compileLog: result.log,
      parsedErrors: result.errors,
      parsedWarnings: result.warnings,
      compiledPdfPath: result.pdfPath ?? null,
    }),

  // PDF
  pdfTimestamp: Date.now(),
  setPdfTimestamp: (t) => set({ pdfTimestamp: t }),

  // UI
  showFileTree: true,
  showLogPanel: false,
  showPDF: true,
  editorFontSize: 14,
  pdfZoom: 1,
  currentPDFPage: 1,
  totalPDFPages: 0,
  toggleFileTree: () => set((s) => ({ showFileTree: !s.showFileTree })),
  toggleLogPanel: () => set((s) => ({ showLogPanel: !s.showLogPanel })),
  togglePDF: () => set((s) => ({ showPDF: !s.showPDF })),
  setEditorFontSize: (size) => set({ editorFontSize: size }),
  setPdfZoom: (zoom) => set({ pdfZoom: zoom }),
  setCurrentPDFPage: (page) => set({ currentPDFPage: page }),
  setTotalPDFPages: (total) => set({ totalPDFPages: total }),
  showMinimap: false,
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  wordWrap: true,
  toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),

  // Cursor
  cursorLine: 1,
  cursorColumn: 1,
  setCursorPosition: (line, column) =>
    set({ cursorLine: line, cursorColumn: column }),

  // File watcher
  externalChangeIndicator: null,
  setExternalChangeIndicator: (msg) => set({ externalChangeIndicator: msg }),
}));
