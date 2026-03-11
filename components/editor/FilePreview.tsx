"use client";

import { FileText, Image as ImageIcon, FileVideo, File } from "lucide-react";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "svg"]);
const PDF_EXTS = new Set(["pdf"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

// LaTeX compilation output files — should not be edited
const LATEX_OUTPUT_EXTS = new Set([
  "aux", "log", "out", "toc", "lof", "lot",
  "fls", "fdb_latexmk", "synctex", "gz",
  "bbl", "blg", "idx", "ind", "ilg",
  "glo", "gls", "glg", "acn", "acr", "alg",
  "nav", "snm", "vrb", "bcf", "run.xml",
]);

export function isReadOnlyFile(name: string): boolean {
  if (name.startsWith(".")) return true;
  const ext = getFileExt(name);
  if (LATEX_OUTPUT_EXTS.has(ext)) return true;
  // e.g. "main.synctex.gz" — check double extension
  if (name.endsWith(".synctex.gz")) return true;
  return false;
}

function getFileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function isPreviewable(name: string): boolean {
  const ext = getFileExt(name);
  return IMAGE_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}

export default function FilePreview({ path, name }: { path: string; name: string }) {
  const ext = getFileExt(name);
  const previewUrl = `/api/files/preview?path=${encodeURIComponent(path)}`;

  if (IMAGE_EXTS.has(ext)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-neutral-100 p-8 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2 text-neutral-500">
          <ImageIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{name}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={name}
          className="max-h-full max-w-full rounded-lg border border-neutral-200 object-contain shadow-sm dark:border-neutral-700"
        />
      </div>
    );
  }

  if (PDF_EXTS.has(ext)) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-900">
        <div className="flex items-center gap-2 px-4 py-2 text-neutral-500">
          <FileText className="h-4 w-4" />
          <span className="text-xs font-medium">{name}</span>
        </div>
        <iframe
          src={previewUrl}
          className="flex-1 border-0"
          title={name}
        />
      </div>
    );
  }

  if (VIDEO_EXTS.has(ext)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-neutral-100 p-8 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2 text-neutral-500">
          <FileVideo className="h-4 w-4" />
          <span className="text-xs font-medium">{name}</span>
        </div>
        <video
          src={previewUrl}
          controls
          className="max-h-full max-w-full rounded-lg border border-neutral-200 shadow-sm dark:border-neutral-700"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white dark:bg-neutral-950">
      <div className="text-center">
        <File className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
        <p className="text-sm text-neutral-400">
          Preview not available for this file type
        </p>
        <p className="mt-1 text-xs text-neutral-300 dark:text-neutral-600">
          {name}
        </p>
      </div>
    </div>
  );
}
