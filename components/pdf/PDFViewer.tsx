"use client";

import { useEditorStore } from "@/store/editorStore";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function PDFViewer() {
  const {
    activeProject,
    pdfTimestamp,
    pdfZoom,
    setPdfZoom,
    currentPDFPage,
    setCurrentPDFPage,
    totalPDFPages,
    setTotalPDFPages,
  } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState<"width" | "page">("width");

  const pdfUrl = useMemo(() => {
    if (!activeProject) return null;
    const pdfPath = `${activeProject.path}/output/main.pdf`;
    return `/api/pdf?path=${encodeURIComponent(pdfPath)}&t=${pdfTimestamp}`;
  }, [activeProject, pdfTimestamp]);

  const handleZoomIn = useCallback(() => {
    setPdfZoom(Math.min(pdfZoom + 0.25, 3));
  }, [pdfZoom, setPdfZoom]);

  const handleZoomOut = useCallback(() => {
    setPdfZoom(Math.max(pdfZoom - 0.25, 0.25));
  }, [pdfZoom, setPdfZoom]);

  const handleResetZoom = useCallback(() => {
    setPdfZoom(1);
  }, [setPdfZoom]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "main.pdf";
    a.click();
  }, [pdfUrl]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleZoomIn, handleZoomOut]);

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <p className="text-sm text-neutral-400">No project selected</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-neutral-100 dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <span className="min-w-10 text-center text-xs text-neutral-500">
            {Math.round(pdfZoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <button
            onClick={handleResetZoom}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPDFPage(Math.max(1, currentPDFPage - 1))}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <input
            type="number"
            value={currentPDFPage}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) {
                setCurrentPDFPage(Math.min(val, totalPDFPages || 1));
              }
            }}
            className="w-8 rounded border border-neutral-200 bg-white px-1 py-0.5 text-center text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            min={1}
            max={totalPDFPages || 1}
          />
          <span className="text-xs text-neutral-400">
            / {totalPDFPages || "–"}
          </span>
          <button
            onClick={() =>
              setCurrentPDFPage(
                Math.min(currentPDFPage + 1, totalPDFPages || 1)
              )
            }
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFitMode(fitMode === "width" ? "page" : "width")}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title={fitMode === "width" ? "Fit to page" : "Fit to width"}
          >
            <Maximize className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Download PDF"
          >
            <Download className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* PDF embed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
      >
        {pdfUrl ? (
          <div
            className="flex justify-center p-4"
            style={{ transform: `scale(${pdfZoom})`, transformOrigin: "top center" }}
          >
            <iframe
              src={`${pdfUrl}#page=${currentPDFPage}`}
              className="h-[calc(100vh-200px)] w-full max-w-200 border-0 bg-white shadow-lg"
              style={{
                minHeight: fitMode === "page" ? "100%" : "auto",
              }}
              title="PDF Preview"
              onLoad={() => {
                // Try to get page count from iframe if accessible
                // This is a basic approach; page count is estimated
                if (!totalPDFPages) {
                  setTotalPDFPages(1);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-neutral-400">No PDF available</p>
              <p className="mt-1 text-xs text-neutral-300 dark:text-neutral-600">
                Compile to generate a PDF
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
