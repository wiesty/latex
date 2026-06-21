"use client";

import { ExternalChange } from "@/types";
import { useMemo, useState } from "react";

interface ExternalChangesModalProps {
  changes: ExternalChange[];
  localContent: Record<string, string>;
  onAcceptExternal: () => void;
  onKeepEditor: () => void;
  onClose: () => void;
}

function changeLabel(change: ExternalChange) {
  if (change.kind === "renamed") {
    return `${change.name} → ${change.newName}`;
  }
  if (change.kind === "deleted") {
    return `${change.name} (deleted)`;
  }
  return `${change.name} (modified)`;
}

function DiffColumn({
  title,
  content,
  comparedWith,
  emptyMessage,
}: {
  title: string;
  content?: string;
  comparedWith?: string;
  emptyMessage: string;
}) {
  const lines = content?.split("\n") ?? [];
  const otherLines = comparedWith?.split("\n") ?? [];

  return (
    <div className="min-w-0 flex-1">
      <div className="border-b border-neutral-200 bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {title}
      </div>
      <div className="h-72 overflow-auto bg-white font-mono text-[11px] leading-5 dark:bg-neutral-950">
        {content === undefined ? (
          <div className="p-4 text-center font-sans text-neutral-400">
            {emptyMessage}
          </div>
        ) : (
          lines.map((line, index) => {
            const changed = line !== otherLines[index];
            return (
              <div
                key={`${index}-${line}`}
                className={`flex min-w-max ${
                  changed
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : "bg-transparent"
                }`}
              >
                <span className="w-10 shrink-0 select-none border-r border-neutral-100 px-2 text-right text-neutral-400 dark:border-neutral-800">
                  {index + 1}
                </span>
                <span className="whitespace-pre px-2 text-neutral-700 dark:text-neutral-300">
                  {line || " "}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ExternalChangesModal({
  changes,
  localContent,
  onAcceptExternal,
  onKeepEditor,
  onClose,
}: ExternalChangesModalProps) {
  const [selectedPath, setSelectedPath] = useState(changes[0]?.path ?? "");
  const selected = useMemo(
    () => changes.find((change) => change.path === selectedPath) ?? changes[0],
    [changes, selectedPath]
  );

  if (!selected) return null;

  const local = selected.localContent ?? localContent[selected.path];
  const external =
    selected.kind === "deleted" ? undefined : selected.externalContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            External changes detected
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Compare the editor version with the file-system version, then choose
            which side to keep.
          </p>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-56 shrink-0 overflow-auto border-r border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-950">
            {changes.map((change) => (
              <button
                key={change.path}
                onClick={() => setSelectedPath(change.path)}
                className={`mb-1 w-full rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  selected.path === change.path
                    ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                }`}
              >
                <span className="block truncate">{changeLabel(change)}</span>
              </button>
            ))}
          </aside>

          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {changeLabel(selected)}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
              <DiffColumn
                title="Editor"
                content={local}
                comparedWith={external}
                emptyMessage="No editor content available"
              />
              <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
              <DiffColumn
                title={
                  selected.kind === "renamed"
                    ? `File system · ${selected.newName}`
                    : "File system"
                }
                content={external}
                comparedWith={local}
                emptyMessage={
                  selected.kind === "deleted"
                    ? "File was deleted externally"
                    : "File content is unavailable"
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Decide later
          </button>
          <button
            onClick={onKeepEditor}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          >
            Keep editor versions
          </button>
          <button
            onClick={onAcceptExternal}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Accept file-system changes
          </button>
        </div>
      </div>
    </div>
  );
}
