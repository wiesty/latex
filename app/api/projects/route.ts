import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  addProject,
  removeProject,
  updateProjectLastOpened,
} from "@/lib/projects";
import fs from "fs/promises";
import path from "path";
import { FileEntry } from "@/types";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("id");

  if (projectId === "files") {
    // Get file tree for a project
    const projectPath = request.nextUrl.searchParams.get("path");
    if (!projectPath) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      );
    }

    try {
      const tree = await buildFileTree(projectPath, projectPath);
      return NextResponse.json({ files: tree });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read directory";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "updateLastOpened" && body.id) {
      await updateProjectLastOpened(body.id);
      return NextResponse.json({ success: true });
    }

    // Create new project folder inside LATEX_PROJECTS_DIR
    if (body.name) {
      const projectsDir = process.env.LATEX_PROJECTS_DIR;
      if (!projectsDir) {
        return NextResponse.json(
          { error: "LATEX_PROJECTS_DIR is not configured." },
          { status: 500 }
        );
      }
      const folderName = path.basename(body.name.trim());
      if (!folderName) {
        return NextResponse.json({ error: "Invalid project name." }, { status: 400 });
      }
      const newProjectPath = path.join(projectsDir, folderName);
      try {
        await fs.mkdir(newProjectPath, { recursive: false });
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EEXIST") {
          return NextResponse.json({ error: "A project with that name already exists." }, { status: 409 });
        }
        throw err;
      }
      const project = await addProject(newProjectPath);
      return NextResponse.json({ project });
    }

    const { path: projectPath } = body as { path: string };

    if (!projectPath) {
      return NextResponse.json(
        { error: "path or name is required" },
        { status: 400 }
      );
    }

    // Validate the path exists
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json(
        { error: "Project folder does not exist." },
        { status: 400 }
      );
    }

    const project = await addProject(projectPath);
    return NextResponse.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("id");
  const deleteFolder = request.nextUrl.searchParams.get("deleteFolder") === "true";

  if (!projectId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    await removeProject(projectId);
    if (deleteFolder && project) {
      await fs.rm(project.path, { recursive: true, force: true });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildFileTree(
  dirPath: string,
  rootPath: string
): Promise<FileEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: FileEntry[] = [];

  const allowedExtensions = [".tex", ".bib", ".sty", ".cls", ".bst"];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories and common LaTeX temp dirs
      if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;

      const children = await buildFileTree(fullPath, rootPath);
      if (children.length > 0) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children,
        });
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: "file",
        });
      }
    }
  }

  // Sort: directories first, then files. alphabetically within each group
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}
