"use client";

import { useEditorStore } from "@/store/editorStore";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer() {
  const {
    activeProject,
    compiledPdfPath,
    pdfTimestamp,
    pdfZoom,
    setPdfZoom,
    currentPDFPage,
    setCurrentPDFPage,
    totalPDFPages,
    setTotalPDFPages,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const pdfUrl = useMemo(() => {
    if (!activeProject || !compiledPdfPath) return null;
    return `/api/pdf?path=${encodeURIComponent(compiledPdfPath)}&t=${pdfTimestamp}`;
  }, [activeProject, compiledPdfPath, pdfTimestamp]);

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
    const pdfName = compiledPdfPath
      ? compiledPdfPath.split("/").pop() ?? "output.pdf"
      : "output.pdf";
    a.download = pdfName;
    a.click();
  }, [pdfUrl, compiledPdfPath]);

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

  // Reset page count when a new compile starts so onLoadSuccess always triggers a state change
  useEffect(() => {
    setTotalPDFPages(0);
  }, [pdfTimestamp, setTotalPDFPages]);

  // Track which pages have rendered their canvas (heights are stable)
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const pendingScrollRef = useRef<number | null>(null);

  // Reset rendered tracking when a new PDF loads
  useEffect(() => {
    renderedPagesRef.current = new Set();
  }, [pdfTimestamp]);

  const tryScroll = useCallback((target: number) => {
    // Only scroll once all pages BEFORE the target have rendered
    // (their heights affect the scroll offset of the target page)
    for (let p = 1; p < target; p++) {
      if (!renderedPagesRef.current.has(p)) return;
    }
    if (!renderedPagesRef.current.has(target)) return;
    const el = pageRefs.current.get(target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingScrollRef.current = null;
    }
  }, []);

  // When the target page changes, mark it pending and attempt scroll
  useEffect(() => {
    if (!totalPDFPages) return;
    pendingScrollRef.current = currentPDFPage;
    tryScroll(currentPDFPage);
  }, [currentPDFPage, totalPDFPages, tryScroll]);

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
            onClick={handleDownload}
            className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Download PDF"
          >
            <Download className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* PDF pages */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {pdfUrl ? (
          <Document
            key={pdfTimestamp}
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => {
              setTotalPDFPages(numPages);
              // Clamp current page to valid range after reload
              setCurrentPDFPage(Math.min(Math.max(1, currentPDFPage), numPages));
            }}
            onLoadError={() => setTotalPDFPages(0)}
            className="flex flex-col items-center gap-4 py-4"
          >
            {Array.from({ length: totalPDFPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={pdfZoom}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                    onRenderSuccess={() => {
                      renderedPagesRef.current.add(pageNum);
                      const target = pendingScrollRef.current;
                      if (target !== null) tryScroll(target);
                    }}
                  />
                </div>
              )
            )}
          </Document>
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
