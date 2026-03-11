"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  showRight: boolean;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  storageKey?: string;
}

export default function ResizableSplit({
  left,
  right,
  showRight,
  defaultLeftWidth = 50,
  minLeftWidth = 30,
  minRightWidth = 20,
  storageKey = "split-width",
}: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return defaultLeftWidth;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return defaultLeftWidth;
    const val = parseFloat(stored);
    return !isNaN(val) && val >= minLeftWidth && val <= 100 - minRightWidth
      ? val
      : defaultLeftWidth;
  });
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(
        minLeftWidth,
        Math.min(100 - minRightWidth, pct)
      );
      setLeftWidth(clamped);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(storageKey, leftWidth.toString());
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [leftWidth, minLeftWidth, minRightWidth, storageKey]);

  if (!showRight) {
    return <div className="flex-1 overflow-hidden">{left}</div>;
  }

  return (
    <div ref={containerRef} className="flex h-full flex-1 overflow-hidden">
      <div
        className="h-full overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {left}
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="group flex h-full w-1 cursor-col-resize items-center justify-center hover:bg-blue-500/20"
      >
        <div className="h-8 w-0.5 rounded-full bg-neutral-300 transition-colors group-hover:bg-blue-500 dark:bg-neutral-700" />
      </div>
      <div
        className="h-full overflow-hidden"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {right}
      </div>
    </div>
  );
}
