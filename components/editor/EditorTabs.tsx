"use client";

import { useEditorStore } from "@/store/editorStore";

export default function EditorTabs() {
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
