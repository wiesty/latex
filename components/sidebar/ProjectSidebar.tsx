"use client";

import { useEditorStore } from "@/store/editorStore";
import { Project } from "@/types";
import {
  FolderOpen,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
  const [newPath, setNewPath] = useState("");

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
    if (!newPath.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setNewPath("");
      setShowAddInput(false);
      await loadProjects();
      toast.success(`Project "${data.project.name}" added`);
    } catch {
      toast.error("Failed to add project");
    }
  };

  const handleRemoveProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    try {
      await fetch(`/api/projects?id=${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      if (activeProject?.id === project.id) {
        setActiveProject(null);
      }
      await loadProjects();
      toast.success(`Project "${project.name}" removed`);
    } catch {
      toast.error("Failed to remove project");
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
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddProject();
              if (e.key === "Escape") {
                setShowAddInput(false);
                setNewPath("");
              }
            }}
            placeholder="/path/to/project"
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
                setNewPath("");
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
    </div>
  );
}
