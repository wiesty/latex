import fs from "fs/promises";
import path from "path";
import { Project } from "@/types";

const CONFIG_DIR =
  process.env.LATEX_CONFIG_DIR ||
  path.join(process.env.HOME || process.env.USERPROFILE || "~", ".latex-editor");
const PROJECTS_FILE = path.join(CONFIG_DIR, "projects.json");

async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // directory exists
  }
}

export async function getProjects(): Promise<Project[]> {
  await ensureConfigDir();
  let projects: Project[];
  try {
    const data = await fs.readFile(PROJECTS_FILE, "utf-8");
    projects = JSON.parse(data) as Project[];
  } catch {
    projects = [];
  }

  // Auto-discover subfolders inside LATEX_PROJECTS_DIR
  const projectsDir = process.env.LATEX_PROJECTS_DIR;
  if (projectsDir) {
    let changed = false;
    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const folderPath = path.join(projectsDir, entry.name);
        const alreadyExists = projects.some((p) => p.path === folderPath);
        if (alreadyExists) continue;

        projects.push({
          id: `${entry.name}-auto-${Date.now()}`,
          name: entry.name,
          path: folderPath,
          lastOpened: new Date().toISOString(),
        });
        changed = true;
      }
    } catch {
      // projects dir doesn't exist yet — that's fine
    }

    if (changed) {
      await saveProjects(projects);
    }
  }

  return projects;
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

export async function addProject(projectPath: string): Promise<Project> {
  const projects = await getProjects();
  const name = path.basename(projectPath);
  const id = `${name}-${Date.now()}`;
  const project: Project = {
    id,
    name,
    path: projectPath,
    lastOpened: new Date().toISOString(),
  };
  projects.push(project);
  await saveProjects(projects);
  return project;
}

export async function removeProject(projectId: string): Promise<void> {
  const projects = await getProjects();
  const filtered = projects.filter((p) => p.id !== projectId);
  await saveProjects(filtered);
}

export async function updateProjectLastOpened(
  projectId: string
): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    project.lastOpened = new Date().toISOString();
    await saveProjects(projects);
  }
}
