import fs from "fs/promises";
import path from "path";
import { Project } from "@/types";

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".latex-editor"
);
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

  // Auto-seed from environment variables (*_FOLDER)
  const envFolders = getEnvFolders();
  let changed = false;
  for (const folderPath of envFolders) {
    const alreadyExists = projects.some((p) => p.path === folderPath);
    if (alreadyExists) continue;

    // Verify the path exists with input/ subdirectory
    try {
      await fs.access(path.join(folderPath, "input"));
      const name = path.basename(folderPath);
      projects.push({
        id: `${name}-env-${Date.now()}`,
        name,
        path: folderPath,
        lastOpened: new Date().toISOString(),
      });
      changed = true;
    } catch {
      // Path doesn't exist or has no input/ dir — skip
    }
  }

  if (changed) {
    await saveProjects(projects);
  }

  return projects;
}

function getEnvFolders(): string[] {
  const folders: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith("_FOLDER") && value) {
      folders.push(value);
    }
  }
  return folders;
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
