"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Circle, X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

interface SettingsModalProps {
  onClose: () => void;
}

type TexStatus = {
  base: boolean;
  extra: boolean;
  full: boolean;
  installing?: boolean;
};

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { texInstalling, texInstallLog, texInstallFinished, startTexInstall } =
    useEditorStore();
  const [status, setStatus] = useState<TexStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Load status on open, and refresh it again whenever an install finishes.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tex", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatusError(data.error);
          return;
        }
        setStatus(data);
        setStatusError(null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [texInstallFinished]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [texInstallLog]);

  const runInstall = useCallback(
    (target: "extra" | "full") => {
      if (texInstalling) return;
      startTexInstall(target);
    },
    [texInstalling, startTexInstall]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Settings · TeX packages
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              The image ships with a slim TeX set. Additional packages and fonts
              are downloaded here and kept permanently.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {statusError ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
              {statusError}
            </div>
          ) : (
            <div className="space-y-2">
              <StatusRow label="Base (scheme-basic, German)" installed={status?.base} />
              <StatusRow
                label="Extra packages & fonts (latexextra, fontsextra, TikZ, …)"
                installed={status?.extra}
              />
              <StatusRow label="Full TeX Live (scheme-full)" installed={status?.full} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => runInstall("extra")}
              disabled={texInstalling || status?.extra || status?.full}
              className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {texInstalling && <Loader2 className="h-3 w-3 animate-spin" />}
              Install extra packages
            </button>
            <button
              onClick={() => runInstall("full")}
              disabled={texInstalling || status?.full}
              className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Install full TeX Live (large)
            </button>
          </div>

          <p className="mt-2 text-[11px] text-neutral-400">
            Requires internet and a one-time download. Missing packages are also
            installed automatically during compilation.
          </p>

          {(texInstalling || texInstallLog.length > 0) && (
            <div
              ref={logRef}
              className="mt-3 h-56 overflow-auto rounded-lg border border-neutral-200 bg-neutral-950 p-3 font-mono text-[11px] leading-5 text-neutral-300 dark:border-neutral-700"
            >
              {texInstallLog.length === 0 ? (
                <span className="text-neutral-500">Installing…</span>
              ) : (
                texInstallLog.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {line || " "}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-neutral-200 p-3 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, installed }: { label: string; installed?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
      {installed ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
      )}
      <span>{label}</span>
    </div>
  );
}
