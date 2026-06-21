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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  repositoryUrl: string;
  checkFailed?: boolean;
}

export default function StatusBar() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
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

  const checkVersion = useCallback(async (manual: boolean) => {
    if (manual) setChecking(true);
    try {
      const response = await fetch(`/api/version${manual ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });
      const data: VersionInfo = await response.json();
      setVersionInfo(data);
      if (manual) {
        if (data.checkFailed) {
          toast.error("Could not reach GitHub for the version check");
        } else if (data.updateAvailable) {
          toast.success(`Update available: v${data.latestVersion}`, {
            action: {
              label: "Open",
              onClick: () => window.open(data.repositoryUrl, "_blank"),
            },
          });
        } else {
          toast.success(`You're on the latest version (v${data.currentVersion})`);
        }
      }
    } catch {
      if (manual) toast.error("Version check failed");
    } finally {
      if (manual) setChecking(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkVersion(false);
  }, [checkVersion]);

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
          <button
            onClick={() => checkVersion(true)}
            disabled={checking}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-neutral-200 disabled:opacity-60 dark:hover:bg-neutral-800 ${
              versionInfo.updateAvailable
                ? "font-medium text-blue-500"
                : "text-neutral-400"
            }`}
            title={
              versionInfo.updateAvailable
                ? `Version ${versionInfo.latestVersion} is available — click to re-check`
                : `Wiesty's LaTeX Editor v${versionInfo.currentVersion} — click to check for updates`
            }
          >
            {checking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              versionInfo.updateAvailable && <ArrowUpCircle className="h-3 w-3" />
            )}
            {checking
              ? "Checking…"
              : versionInfo.updateAvailable
                ? `Update v${versionInfo.latestVersion}`
                : `v${versionInfo.currentVersion}`}
          </button>
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
