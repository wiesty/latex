"use client";

import { useEditorStore } from "@/store/editorStore";
import { ParsedError } from "@/types";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  X,
} from "lucide-react";
import { useState } from "react";

export default function LogPanel() {
  const {
    showLogPanel,
    toggleLogPanel,
    compileLog,
    parsedErrors,
    parsedWarnings,
  } = useEditorStore();
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");
  const [view, setView] = useState<"parsed" | "raw">("parsed");

  if (!showLogPanel) return null;

  const filteredItems: ParsedError[] =
    filter === "errors"
      ? parsedErrors
      : filter === "warnings"
        ? parsedWarnings
        : [...parsedErrors, ...parsedWarnings];

  return (
    <div className="flex max-h-62.5 flex-col border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">
            Output
          </span>
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-900">
            <button
              onClick={() => setView("parsed")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                view === "parsed"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Parsed
            </button>
            <button
              onClick={() => setView("raw")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                view === "raw"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Raw
            </button>
          </div>
          {view === "parsed" && (
            <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5 dark:bg-neutral-900">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
                label="All"
              />
              <FilterButton
                active={filter === "errors"}
                onClick={() => setFilter("errors")}
                label={`Errors (${parsedErrors.length})`}
              />
              <FilterButton
                active={filter === "warnings"}
                onClick={() => setFilter("warnings")}
                label={`Warnings (${parsedWarnings.length})`}
              />
            </div>
          )}
        </div>
        <button
          onClick={toggleLogPanel}
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X className="h-3.5 w-3.5 text-neutral-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {view === "raw" ? (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {compileLog || "No log output yet."}
          </pre>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-center text-xs text-neutral-400">
            <Info className="h-4 w-4" />
            {compileLog ? "No issues found." : "Run a compilation first."}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredItems.map((item, idx) => (
              <LogItem key={idx} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

function LogItem({ item }: { item: ParsedError }) {
  const [expanded, setExpanded] = useState(false);

  const icon =
    item.type === "error" ? (
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
    ) : (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    );

  return (
    <div
      className={`rounded border px-2 py-1.5 ${
        item.type === "error"
          ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        {icon}
        <div className="flex-1 text-xs">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {item.message}
          </span>
          {item.file && (
            <span className="ml-2 text-neutral-500">
              {item.file}
              {item.line !== null && `:${item.line}`}
            </span>
          )}
        </div>
        {item.context &&
          (expanded ? (
            <ChevronUp className="h-3 w-3 shrink-0 text-neutral-400" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
          ))}
      </button>
      {expanded && item.context && (
        <pre className="mt-1.5 rounded bg-neutral-100 p-2 font-mono text-[10px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {item.context}
        </pre>
      )}
    </div>
  );
}
