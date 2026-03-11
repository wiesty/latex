"use client";

import dynamic from "next/dynamic";
import ProjectSidebar from "@/components/sidebar/ProjectSidebar";
import FileTree from "@/components/sidebar/FileTree";
import Header from "@/components/layout/Header";
import StatusBar from "@/components/layout/StatusBar";
import LogPanel from "@/components/layout/LogPanel";
import ResizableSplit from "@/components/layout/ResizableSplit";
import { useEditorStore } from "@/store/editorStore";

const MonacoEditor = dynamic(
  () => import("@/components/editor/MonacoEditor"),
  { ssr: false }
);

const PDFViewer = dynamic(() => import("@/components/pdf/PDFViewer"), {
  ssr: false,
});

export default function Home() {
  const { showPDF } = useEditorStore();

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Project Sidebar */}
        <ProjectSidebar />

        {/* File Tree */}
        <FileTree />

        {/* Editor + PDF split */}
        <ResizableSplit
          left={<MonacoEditor />}
          right={<PDFViewer />}
          showRight={showPDF}
          defaultLeftWidth={55}
          minLeftWidth={30}
          minRightWidth={20}
          storageKey="editor-pdf-split"
        />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Log Panel */}
      <LogPanel />
    </div>
  );
}
