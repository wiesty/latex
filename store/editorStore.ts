import { create } from "zustand";
import { toast } from "sonner";
import { Project, FileTab, ParsedError, ExternalChange } from "@/types";

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
  replaceOpenFile: (
    oldPath: string,
    file: { path: string; name: string },
    content: string
  ) => void;
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
  restoreCompiledPdf: (path: string, timestamp: number) => void;
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

  // TeX package installation (kept in the store so the log survives the
  // settings modal being closed and reopened)
  texInstalling: boolean;
  texInstallTarget: "extra" | "full" | null;
  texInstallLog: string[];
  texInstallFinished: boolean;
  startTexInstall: (target: "extra" | "full") => Promise<boolean>;
  syncTexInstall: () => void;

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
  autoCompile: boolean;
  setAutoCompile: (v: boolean) => void;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Cursor
  cursorLine: number;
  cursorColumn: number;
  setCursorPosition: (line: number, column: number) => void;

  // File watcher
  externalChangeIndicator: string | null;
  setExternalChangeIndicator: (msg: string | null) => void;
  pendingExternalChanges: ExternalChange[];
  setPendingExternalChanges: (files: ExternalChange[]) => void;
  clearPendingExternalChanges: () => void;
  internalWriteTimestamps: Record<string, number>;
  markInternalWrite: (path: string) => void;
  fileTreeRevision: number;
  bumpFileTreeRevision: () => void;
}

// --- TeX install polling (module-scoped so it persists across renders) ---
let texPollTimer: ReturnType<typeof setTimeout> | null = null;
let texPolling = false;
let texPrevRunning = false;

async function texPoll(): Promise<void> {
  texPolling = true;
  let running = false;
  try {
    const res = await fetch("/api/tex");
    const data = await res.json();
    if (res.ok && !data.error) {
      running = !!data.installing;
      const state = useEditorStore.getState();
      useEditorStore.setState({
        texInstalling: running,
        texInstallLog: Array.isArray(data.log) ? data.log : state.texInstallLog,
        texInstallTarget: data.target ?? state.texInstallTarget,
      });
      if (texPrevRunning && !running) {
        useEditorStore.setState({ texInstallFinished: true });
        if (data.success) toast.success("TeX packages installed");
        else toast.error("Installation failed");
      }
      texPrevRunning = running;
    }
  } catch {
    running = false;
  }
  if (running) {
    texPollTimer = setTimeout(texPoll, 1500);
  } else {
    texPolling = false;
    texPollTimer = null;
  }
}

function ensureTexPoll(): void {
  if (texPolling) return;
  if (texPollTimer) clearTimeout(texPollTimer);
  texPoll();
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Projects
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (project) =>
    set((state) => {
      if (project?.id === state.activeProject?.id) return { activeProject: project };
      if (typeof window !== "undefined") {
        if (project) {
          localStorage.setItem("activeProjectId", project.id);
        } else {
          localStorage.removeItem("activeProjectId");
        }
      }
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
        mainFile:
          project && typeof window !== "undefined"
            ? localStorage.getItem(`mainFile:${project.id}`)
            : null,
        compiledPdfPath: null,
        currentPDFPage: 1,
        totalPDFPages: 0,
        pendingExternalChanges: [],
        externalChangeIndicator: null,
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
  replaceOpenFile: (oldPath, file, content) =>
    set((state) => {
      const replacement: FileTab = { ...file, unsaved: false };
      const openFiles = state.openFiles.map((openFile) =>
        openFile.path === oldPath ? replacement : openFile
      );
      const fileContent = { ...state.fileContent };
      delete fileContent[oldPath];
      fileContent[file.path] = content;
      return {
        openFiles,
        activeFile:
          state.activeFile?.path === oldPath ? replacement : state.activeFile,
        fileContent,
      };
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
  setMainFile: (file) => {
    const project = get().activeProject;
    if (project && typeof window !== "undefined") {
      if (file) {
        localStorage.setItem(`mainFile:${project.id}`, file);
      } else {
        localStorage.removeItem(`mainFile:${project.id}`);
      }
    }
    set({ mainFile: file });
  },

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
  restoreCompiledPdf: (pdfPath, timestamp) =>
    set({
      compiledPdfPath: pdfPath,
      pdfTimestamp: timestamp,
      compileStatus: "success",
    }),
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

  // TeX package installation — the install runs server-side; we poll the API so
  // the log/progress survive a page reload (the server keeps the buffer).
  texInstalling: false,
  texInstallTarget: null,
  texInstallLog: [],
  texInstallFinished: false,
  startTexInstall: async (target) => {
    if (get().texInstalling) return false;
    set({
      texInstalling: true,
      texInstallTarget: target,
      texInstallLog: [],
      texInstallFinished: false,
    });
    try {
      const res = await fetch("/api/tex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      // 409 = already running; that's fine, we just poll the existing job.
      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Installation failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Installation failed";
      toast.error(message);
      set({ texInstalling: false, texInstallFinished: true });
      return false;
    }
    texPrevRunning = true;
    ensureTexPoll();
    return true;
  },
  syncTexInstall: () => {
    ensureTexPoll();
  },

  // UI (all persisted to localStorage)
  showFileTree: typeof window !== "undefined"
    ? localStorage.getItem("showFileTree") !== "false"
    : true,
  showLogPanel: typeof window !== "undefined"
    ? localStorage.getItem("showLogPanel") === "true"
    : false,
  showPDF: typeof window !== "undefined"
    ? localStorage.getItem("showPDF") !== "false"
    : true,
  editorFontSize: typeof window !== "undefined"
    ? parseInt(localStorage.getItem("editorFontSize") || "14", 10)
    : 14,
  pdfZoom: typeof window !== "undefined"
    ? parseFloat(localStorage.getItem("pdfZoom") || "1")
    : 1,
  currentPDFPage: 1,
  totalPDFPages: 0,
  toggleFileTree: () => set((s) => {
    const v = !s.showFileTree;
    if (typeof window !== "undefined") localStorage.setItem("showFileTree", String(v));
    return { showFileTree: v };
  }),
  toggleLogPanel: () => set((s) => {
    const v = !s.showLogPanel;
    if (typeof window !== "undefined") localStorage.setItem("showLogPanel", String(v));
    return { showLogPanel: v };
  }),
  togglePDF: () => set((s) => {
    const v = !s.showPDF;
    if (typeof window !== "undefined") localStorage.setItem("showPDF", String(v));
    return { showPDF: v };
  }),
  setEditorFontSize: (size) => {
    if (typeof window !== "undefined") localStorage.setItem("editorFontSize", String(size));
    set({ editorFontSize: size });
  },
  setPdfZoom: (zoom) => {
    if (typeof window !== "undefined") localStorage.setItem("pdfZoom", String(zoom));
    set({ pdfZoom: zoom });
  },
  setCurrentPDFPage: (page) => set({ currentPDFPage: page }),
  setTotalPDFPages: (total) => set({ totalPDFPages: total }),
  showMinimap: typeof window !== "undefined"
    ? localStorage.getItem("showMinimap") === "true"
    : false,
  toggleMinimap: () => set((s) => {
    const v = !s.showMinimap;
    if (typeof window !== "undefined") localStorage.setItem("showMinimap", String(v));
    return { showMinimap: v };
  }),
  wordWrap: typeof window !== "undefined"
    ? localStorage.getItem("wordWrap") !== "false"
    : true,
  toggleWordWrap: () => set((s) => {
    const v = !s.wordWrap;
    if (typeof window !== "undefined") localStorage.setItem("wordWrap", String(v));
    return { wordWrap: v };
  }),
  autoCompile: typeof window !== "undefined"
    ? localStorage.getItem("autoCompile") !== "false"
    : true,
  setAutoCompile: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("autoCompile", String(v));
    set({ autoCompile: v });
  },
  autoSave: typeof window !== "undefined"
    ? localStorage.getItem("autoSave") !== "false"
    : true,
  setAutoSave: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("autoSave", String(v));
    set({ autoSave: v });
  },
  autoScroll: typeof window !== "undefined"
    ? localStorage.getItem("autoScroll") !== "false"
    : true,
  setAutoScroll: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("autoScroll", String(v));
    set({ autoScroll: v });
  },
  showHidden: typeof window !== "undefined"
    ? localStorage.getItem("showHidden") === "true"
    : false,
  setShowHidden: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("showHidden", String(v));
    set({ showHidden: v });
  },
  sidebarCollapsed: typeof window !== "undefined"
    ? localStorage.getItem("sidebarCollapsed") === "true"
    : false,
  setSidebarCollapsed: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("sidebarCollapsed", String(v));
    set({ sidebarCollapsed: v });
  },

  // Cursor
  cursorLine: 1,
  cursorColumn: 1,
  setCursorPosition: (line, column) =>
    set({ cursorLine: line, cursorColumn: column }),

  // File watcher
  externalChangeIndicator: null,
  setExternalChangeIndicator: (msg) => set({ externalChangeIndicator: msg }),
  pendingExternalChanges: [],
  setPendingExternalChanges: (files) =>
    set((state) => {
      const merged = new Map<string, ExternalChange>();
      for (const file of state.pendingExternalChanges) {
        merged.set(file.path, file);
      }
      for (const file of files) {
        merged.set(file.path, file);
      }
      return { pendingExternalChanges: Array.from(merged.values()) };
    }),
  clearPendingExternalChanges: () =>
    set({ pendingExternalChanges: [], externalChangeIndicator: null }),
  internalWriteTimestamps: {},
  markInternalWrite: (path) =>
    set((state) => {
      const now = Date.now();
      const pruned: Record<string, number> = {};
      for (const [key, ts] of Object.entries(state.internalWriteTimestamps)) {
        if (now - ts < 15000) {
          pruned[key] = ts;
        }
      }
      pruned[path] = now;
      return { internalWriteTimestamps: pruned };
    }),
  fileTreeRevision: 0,
  bumpFileTreeRevision: () =>
    set((state) => ({ fileTreeRevision: state.fileTreeRevision + 1 })),
}));
