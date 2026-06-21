import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { parseLatexLog } from "./latex-log-parser";
import { CompileResult } from "@/types";

const execAsync = promisify(exec);

export async function compileLatex(
  projectPath: string,
  mainFile: string = "main.tex"
): Promise<CompileResult> {
  const mainBaseName = mainFile.replace(/\.tex$/, "");
  const start = Date.now();

  const pdflatexCmd = `pdflatex -interaction=nonstopmode -synctex=1 "${path.join(projectPath, mainFile)}"`;
  const bibtexCmd = `bibtex "${mainBaseName}"`;

  try {
    // Run pdflatex -> bibtex -> pdflatex -> pdflatex
    await runCommand(pdflatexCmd, projectPath);

    try {
      await runCommand(bibtexCmd, projectPath);
    } catch {
      // bibtex may fail if no citations, that's OK
    }

    await runCommand(pdflatexCmd, projectPath);
    await runCommand(pdflatexCmd, projectPath);
  } catch {
    // Even if pdflatex returns non-zero, we still want to parse logs
  }

  const duration = Date.now() - start;

  // Read log file
  let log = "";
  const logPath = path.join(projectPath, `${mainBaseName}.log`);
  try {
    log = await fs.readFile(logPath, "utf-8");
  } catch {
    // No log file generated
  }

  const { errors, warnings } = parseLatexLog(log);

  // Check if PDF was created
  const pdfPath = path.join(projectPath, `${mainBaseName}.pdf`);
  let pdfExists = false;
  try {
    await fs.access(pdfPath);
    pdfExists = true;
  } catch {
    // PDF not generated
  }

  return {
    success: pdfExists && errors.length === 0,
    duration,
    pdfPath: pdfExists ? pdfPath : "",
    log,
    errors,
    warnings,
  };
}

function getTexPath(): string {
  const extra = [
    "/Library/TeX/texbin",          // macOS (MacTeX)
    "/usr/local/texlive/2024/bin/x86_64-linux", // Linux TeX Live
    "/usr/bin",                     // Linux distro packages
  ];
  return [...extra, process.env.PATH].filter(Boolean).join(":");
}

async function runCommand(
  cmd: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, {
    cwd,
    timeout: 60000,
    env: {
      ...process.env,
      PATH: getTexPath(),
    },
  });
}

export async function checkLatexInstalled(): Promise<boolean> {
  try {
    await execAsync("which pdflatex", {
      env: {
        ...process.env,
        PATH: getTexPath(),
      },
    });
    return true;
  } catch {
    return false;
  }
}
