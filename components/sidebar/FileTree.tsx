"use client";

import { useEditorStore } from "@/store/editorStore";
import { FileEntry } from "@/types";
import {
  File,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Upload,
  Image,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { toast } from "sonner";

export default function FileTree() {
  const { activeProject, activeFile, openFile, showFileTree, toggleFileTree } =
    useEditorStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const refreshFiles = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!activeProject) {
      startTransition(() => setFiles([]));
      return;
    }
    let cancelled = false;
    fetch(`/api/projects?id=files&path=${encodeURIComponent(activeProject.path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.files) setFiles(data.files);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load files");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, refreshTick]);

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !activeProject) return;

    let fileName = newFileName.trim();
    if (!fileName.endsWith(".tex") && !fileName.endsWith(".bib")) {
      fileName += ".tex";
    }

    const filePath = `${activeProject.path}/${fileName}`;

    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: "" }),
      });
      setNewFileName("");
      setShowNewFile(false);
      refreshFiles();
      toast.success(`File "${fileName}" created`);
    } catch {
      toast.error("Failed to create file");
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, filePath: string, fileName: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${fileName}"?`)) return;

    try {
      await fetch(`/api/files?path=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
      });
      refreshFiles();
      toast.success(`File "${fileName}" deleted`);
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const uploadFiles = async (fileList: FileList | File[], force = false) => {
    if (!activeProject) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("projectPath", activeProject.path);
      if (force) formData.append("force", "true");
      for (const file of files) {
        formData.append("files", file);
      }
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Check for compiled PDF conflicts
      const conflicts = data.results?.filter(
        (r: { success: boolean; error?: string }) => !r.success && r.error === "COMPILED_PDF_CONFLICT"
      ) || [];
      const otherFailed = data.results?.filter(
        (r: { success: boolean; error?: string }) => !r.success && r.error !== "COMPILED_PDF_CONFLICT"
      ) || [];

      for (const f of otherFailed) {
        toast.error(`${f.name}: ${f.error}`);
      }

      if (conflicts.length > 0 && !force) {
        const names = conflicts.map((c: { name: string }) => c.name).join(", ");
        toast.warning(
          `${names}: Would overwrite compiled PDF.`,
          {
            duration: 10000,
            action: {
              label: "Upload anyway",
              onClick: () => {
                const conflictFiles = files.filter((f) =>
                  conflicts.some((c: { name: string }) => c.name === f.name)
                );
                uploadFiles(conflictFiles, true);
              },
            },
          }
        );
      }

      if (data.successCount > 0) {
        toast.success(`${data.successCount} file(s) uploaded`);
      }
      refreshFiles();
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  if (!showFileTree) {
    return (
      <button
        onClick={toggleFileTree}
        className="flex h-full w-8 items-start justify-center border-r border-neutral-200 bg-white pt-2 dark:border-neutral-800 dark:bg-neutral-950"
        title="Show file tree"
      >
        <PanelLeft className="h-3.5 w-3.5 text-neutral-400" />
      </button>
    );
  }

  return (
    <div
      className={`flex h-full w-50 flex-col border-r border-neutral-200 bg-white transition-colors dark:border-neutral-800 dark:bg-neutral-950 ${
        isDragging ? "ring-2 ring-inset ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        accept=".tex,.bib,.sty,.cls,.bst,.png,.jpg,.jpeg,.gif,.svg,.eps,.pdf,.tikz,.pgf,.csv,.dat,.txt,.md"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => activeProject && fileInputRef.current?.click()}
            disabled={!activeProject || isUploading}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
            title={activeProject ? "Upload files" : "Select a project first"}
          >
            <Upload className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <button
            onClick={() => activeProject && setShowNewFile(true)}
            disabled={!activeProject}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
            title={activeProject ? "New file" : "Select a project first"}
          >
            <Plus className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <button
            onClick={toggleFileTree}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Hide file tree"
          >
            <PanelLeftClose className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* New file input */}
      {showNewFile && (
        <div className="border-b border-neutral-200 p-2 dark:border-neutral-800">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFile();
              if (e.key === "Escape") {
                setShowNewFile(false);
                setNewFileName("");
              }
            }}
            placeholder="filename.tex"
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            autoFocus
          />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {!activeProject && (
          <div className="px-3 py-4 text-center text-xs text-neutral-400">
            Select a project
          </div>
        )}
        {isDragging && activeProject && (
          <div className="mx-2 my-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/50 py-6 dark:border-blue-600 dark:bg-blue-950/20">
            <Upload className="mb-1 h-5 w-5 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
              Drop files here
            </span>
          </div>
        )}
        {isUploading && (
          <div className="px-3 py-2 text-center text-[10px] text-neutral-400">
            Uploading...
          </div>
        )}
        {files.map((entry) => (
          <FileEntryItem
            key={entry.path}
            entry={entry}
            activeFilePath={activeFile?.path || null}
            onSelect={(entry) => {
              openFile({ path: entry.path, name: entry.name, unsaved: false });
            }}
            onDelete={handleDeleteFile}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

function FileEntryItem({
  entry,
  activeFilePath,
  onSelect,
  onDelete,
  depth,
}: {
  entry: FileEntry;
  activeFilePath: string | null;
  onSelect: (entry: FileEntry) => void;
  onDelete: (e: React.MouseEvent, path: string, name: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);

  if (entry.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span className="truncate font-medium">{entry.name}</span>
        </button>
        {expanded &&
          entry.children?.map((child) => (
            <FileEntryItem
              key={child.path}
              entry={child}
              activeFilePath={activeFilePath}
              onSelect={onSelect}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  const isActive = activeFilePath === entry.path;
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "svg", "eps"].includes(ext);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(entry);
      }}
      className={`group flex w-full cursor-pointer items-center gap-1.5 py-1 pr-2 text-left text-xs transition-colors ${
        isActive
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {isImage ? (
        <Image className="h-3.5 w-3.5 shrink-0 text-green-500" />
      ) : (
        <File className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="flex-1 truncate">{entry.name}</span>
      <button
        onClick={(e) => onDelete(e, entry.path, entry.name)}
        className="hidden rounded p-0.5 hover:bg-neutral-300 group-hover:block dark:hover:bg-neutral-700"
        title="Delete file"
      >
        <Trash2 className="h-2.5 w-2.5 text-neutral-400" />
      </button>
    </div>
  );
}
