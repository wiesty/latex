"use client";

import { useEditorStore } from "@/store/editorStore";
import { Project } from "@/types";
import {
  FolderOpen,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export default function ProjectSidebar() {
  const {
    projects,
    activeProject,
    setProjects,
    setActiveProject,
  } = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch {
      toast.error("Failed to load projects");
    }
  }, [setProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleAddProject = async () => {
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setNewName("");
      setShowAddInput(false);
      await loadProjects();
      toast.success(`Project "${data.project.name}" created`);
    } catch {
      toast.error("Failed to create project");
    }
  };

  const handleRemoveProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    try {
      // Check if folder contains files
      const res = await fetch(
        `/api/projects?id=files&path=${encodeURIComponent(project.path)}`
      );
      const data = await res.json();
      const hasFiles = Array.isArray(data.files) && data.files.length > 0;

      const message = hasFiles
        ? `"${project.name}" contains files. Permanently delete the project folder and all contents?`
        : `Delete project folder "${project.name}"?`;

      if (!window.confirm(message)) return;

      await fetch(
        `/api/projects?id=${encodeURIComponent(project.id)}&deleteFolder=true`,
        { method: "DELETE" }
      );
      if (activeProject?.id === project.id) {
        setActiveProject(null);
      }
      await loadProjects();
      toast.success(`Project "${project.name}" deleted`);
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleSelectProject = async (project: Project) => {
    setActiveProject(project);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateLastOpened", id: project.id }),
      });
    } catch {
      // non-critical
    }
  };

  const handleExportZip = async (project: Project) => {
    setContextMenu(null);
    try {
      const res = await fetch(`/api/projects/export?path=${encodeURIComponent(project.path)}`);
      if (!res.ok) {
        toast.error("Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${project.name}.zip"`);
    } catch {
      toast.error("Export failed");
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-r border-neutral-200 bg-neutral-50 pt-2 dark:border-neutral-800 dark:bg-neutral-950">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-45 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Projects
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddInput(true)}
            className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            title="Add project"
          >
            <Plus className="h-3.5 w-3.5 text-neutral-500" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Add project input */}
      {showAddInput && (
        <div className="border-b border-neutral-200 p-2 dark:border-neutral-800">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddProject();
              if (e.key === "Escape") {
                setShowAddInput(false);
                setNewName("");
              }
            }}
            placeholder="Project name"
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-600"
            autoFocus
          />
          <div className="mt-1 flex gap-1">
            <button
              onClick={handleAddProject}
              className="flex-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-600"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddInput(false);
                setNewName("");
              }}
              className="flex-1 rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-neutral-400">
            No projects yet.
            <br />
            Click + to add one.
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectProject(project)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSelectProject(project);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, project });
            }}
            className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              activeProject?.id === project.id
                ? "bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100"
            }`}
          >
            <div className="relative">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              {activeProject?.id === project.id && (
                <div className="absolute -left-1.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="flex-1 truncate text-xs font-medium">
              {project.name}
            </span>
            <button
              onClick={(e) => handleRemoveProject(e, project)}
              className="hidden rounded p-0.5 hover:bg-neutral-300 group-hover:block dark:hover:bg-neutral-700"
              title="Remove project"
            >
              <Trash2 className="h-3 w-3 text-neutral-400" />
            </button>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-35 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleExportZip(contextMenu.project)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export as ZIP
          </button>
          <button
            onClick={(e) => {
              setContextMenu(null);
              handleRemoveProject(e, contextMenu.project);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}
