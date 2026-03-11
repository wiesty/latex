"use client";

import { FileEntry } from "@/types";
import {
  File,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  Image,
} from "lucide-react";
import { useState } from "react";

export default function FileEntryItem({
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
  const isHidden = entry.name.startsWith(".");

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
      } ${isHidden ? "opacity-50" : ""}`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {isImage ? (
        // eslint-disable-next-line jsx-a11y/alt-text
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
