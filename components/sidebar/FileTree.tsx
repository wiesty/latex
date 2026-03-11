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
} from "lucide-react";
import { useState, useEffect, useCallback, startTransition } from "react";
import { toast } from "sonner";

export default function FileTree() {
  const { activeProject, activeFile, openFile, showFileTree, toggleFileTree } =
    useEditorStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

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
    <div className="flex h-full w-50 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Files
        </span>
        <div className="flex items-center gap-1">
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
        {files.map((entry) => (
          <FileEntryItem
            key={entry.path}
            entry={entry}
            activeFilePath={activeFile?.path || null}
            onSelect={(entry) =>
              openFile({ path: entry.path, name: entry.name, unsaved: false })
            }
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
      <File className="h-3.5 w-3.5 shrink-0" />
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
