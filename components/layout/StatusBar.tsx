"use client";

import { useEditorStore } from "@/store/editorStore";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Terminal,
  Eye,
  RefreshCw,
  ArrowUpCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  repositoryUrl: string;
}

export default function StatusBar() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const {
    activeFile,
    activeProject,
    cursorLine,
    cursorColumn,
    compileStatus,
    lastCompileTime,
    parsedErrors,
    parsedWarnings,
    toggleLogPanel,
    showLogPanel,
    externalChangeIndicator,
  } = useEditorStore();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/version", { signal: controller.signal })
      .then((response) => response.json())
      .then(setVersionInfo)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="flex h-7 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 text-[11px] dark:border-neutral-800 dark:bg-neutral-950">
      {/* Left */}
      <div className="flex items-center gap-3 text-neutral-500">
        {activeFile && (
          <>
            <span className="font-medium">{activeFile.name}</span>
            <span>
              Ln {cursorLine}, Col {cursorColumn}
            </span>
            <span>UTF-8</span>
          </>
        )}
      </div>

      {/* Center */}
      <button
        onClick={toggleLogPanel}
        className="flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        <CompileStatusIndicator
          status={compileStatus}
          lastTime={lastCompileTime}
          errorCount={parsedErrors.length}
          warningCount={parsedWarnings.length}
        />
      </button>

      {/* Right */}
      <div className="flex items-center gap-2 text-neutral-500">
        {versionInfo && (
          <a
            href={versionInfo.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
              versionInfo.updateAvailable
                ? "font-medium text-blue-500"
                : "text-neutral-400"
            }`}
            title={
              versionInfo.updateAvailable
                ? `Version ${versionInfo.latestVersion} is available`
                : `Wiesty's LaTeX Editor v${versionInfo.currentVersion}`
            }
          >
            {versionInfo.updateAvailable && <ArrowUpCircle className="h-3 w-3" />}
            {versionInfo.updateAvailable
              ? `Update v${versionInfo.latestVersion}`
              : `v${versionInfo.currentVersion}`}
          </a>
        )}
        {/* External change indicator */}
        {externalChangeIndicator && (
          <span className="flex items-center gap-1 text-[10px] text-amber-500 animate-in fade-in">
            <RefreshCw className="h-3 w-3" />
            {externalChangeIndicator}
          </span>
        )}
        {/* Watching indicator */}
        {activeProject && (
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Eye className="h-3 w-3" />
            Watching
          </span>
        )}
        <button
          onClick={toggleLogPanel}
          className={`rounded p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
            showLogPanel ? "text-blue-500" : ""
          }`}
          title="Toggle log panel"
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CompileStatusIndicator({
  status,
  lastTime,
  errorCount,
  warningCount,
}: {
  status: "idle" | "compiling" | "success" | "error";
  lastTime: number | null;
  errorCount: number;
  warningCount: number;
}) {
  switch (status) {
    case "idle":
      return (
        <span className="flex items-center gap-1 text-neutral-400">
          <Circle className="h-3 w-3" />
          Idle
        </span>
      );
    case "compiling":
      return (
        <span className="flex items-center gap-1 text-amber-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Compiling...
        </span>
      );
    case "success":
      return (
        <span className="flex items-center gap-1 text-emerald-500">
          <CheckCircle2 className="h-3 w-3" />
          Compiled {lastTime ? `in ${(lastTime / 1000).toFixed(1)}s` : ""}
          {warningCount > 0 && (
            <span className="ml-1 flex items-center gap-0.5 text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {warningCount}
            </span>
          )}
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-red-500">
          <AlertCircle className="h-3 w-3" />
          {errorCount} error{errorCount !== 1 ? "s" : ""}
          {warningCount > 0 && (
            <span className="ml-1 flex items-center gap-0.5 text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {warningCount}
            </span>
          )}
        </span>
      );
  }
}
