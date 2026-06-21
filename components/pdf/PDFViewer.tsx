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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer() {
  const {
    activeProject,
    mainFile,
    compiledPdfPath,
    restoreCompiledPdf,
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
  const [pageInput, setPageInput] = useState<string | null>(null);
  const displayedPage = pageInput ?? String(currentPDFPage);

  useEffect(() => {
    if (!activeProject || compiledPdfPath) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      projectPath: activeProject.path,
      mainFile: mainFile ?? "main.tex",
      info: "1",
    });

    fetch(`/api/pdf?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.exists && data.pdfPath) {
          restoreCompiledPdf(data.pdfPath, data.timestamp ?? Date.now());
        }
      })
      .catch(() => {
        // No existing PDF is a normal state for a new project.
      });

    return () => controller.abort();
  }, [activeProject, mainFile, compiledPdfPath, restoreCompiledPdf]);

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
  // Set when the page number changed because the user scrolled, so the
  // auto-scroll effect below does not fight the manual scroll.
  const suppressScrollRef = useRef(false);

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

  const commitPageInput = useCallback(() => {
    const parsed = Number.parseInt(pageInput ?? "", 10);
    const nextPage = Number.isNaN(parsed)
      ? currentPDFPage
      : Math.min(Math.max(parsed, 1), totalPDFPages || 1);
    setCurrentPDFPage(nextPage);
    setPageInput(null);
  }, [pageInput, currentPDFPage, totalPDFPages, setCurrentPDFPage]);

  // When the target page changes, mark it pending and attempt scroll —
  // unless the change originated from the user scrolling (then the view is
  // already where it should be).
  useEffect(() => {
    if (!totalPDFPages) return;
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    pendingScrollRef.current = currentPDFPage;
    tryScroll(currentPDFPage);
  }, [currentPDFPage, totalPDFPages, tryScroll]);

  // Update the page indicator while the user scrolls through the PDF.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !totalPDFPages) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const containerTop = container.getBoundingClientRect().top;
        let best = 1;
        let bestDist = Infinity;
        for (const [num, el] of pageRefs.current) {
          // Pick the page whose top is closest to the top of the viewport.
          const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
          if (dist < bestDist) {
            bestDist = dist;
            best = num;
          }
        }
        if (best !== useEditorStore.getState().currentPDFPage) {
          suppressScrollRef.current = true;
          setCurrentPDFPage(best);
        }
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [totalPDFPages, setCurrentPDFPage]);

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
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={displayedPage}
            onFocus={() => setPageInput(String(currentPDFPage))}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) setPageInput(e.target.value);
            }}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitPageInput();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setPageInput(null);
                e.currentTarget.blur();
              }
            }}
            aria-label="PDF page number"
            className="min-w-10 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-center text-xs tabular-nums text-neutral-700 outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            style={{
              width: `${Math.max(
                3,
                displayedPage.length,
                String(totalPDFPages || 1).length
              ) + 1}ch`,
            }}
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
