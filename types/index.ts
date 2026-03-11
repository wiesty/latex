export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
}

export interface FileTab {
  path: string;
  name: string;
  unsaved: boolean;
}

export interface ParsedError {
  type: "error" | "warning" | "info";
  file: string;
  line: number | null;
  message: string;
  context?: string;
}

export interface CompileResult {
  success: boolean;
  duration: number;
  pdfPath: string;
  log: string;
  errors: ParsedError[];
  warnings: ParsedError[];
}
