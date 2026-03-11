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
  const inputDir = path.join(projectPath, "input");
  const outputDir = path.join(projectPath, "output");
  const mainBaseName = mainFile.replace(/\.tex$/, "");
  const start = Date.now();

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const pdflatexCmd = `pdflatex -interaction=nonstopmode -output-directory="${outputDir}" "${path.join(inputDir, mainFile)}"`;
  const bibtexCmd = `cd "${outputDir}" && bibtex "${mainBaseName}"`;

  try {
    // Run pdflatex -> bibtex -> pdflatex -> pdflatex
    await runCommand(pdflatexCmd, inputDir);
    
    // Copy .aux to output for bibtex (if not already there via -output-directory)
    try {
      await runCommand(bibtexCmd, outputDir);
    } catch {
      // bibtex may fail if no citations, that's OK
    }

    await runCommand(pdflatexCmd, inputDir);
    await runCommand(pdflatexCmd, inputDir);
  } catch {
    // Even if pdflatex returns non-zero, we still want to parse logs
  }

  const duration = Date.now() - start;

  // Read log file
  let log = "";
  const logPath = path.join(outputDir, `${mainBaseName}.log`);
  try {
    log = await fs.readFile(logPath, "utf-8");
  } catch {
    // No log file generated
  }

  const { errors, warnings } = parseLatexLog(log);

  // Check if PDF was created
  const pdfPath = path.join(outputDir, `${mainBaseName}.pdf`);
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

async function runCommand(
  cmd: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, {
    cwd,
    timeout: 60000,
    env: {
      ...process.env,
      PATH: `/Library/TeX/texbin:${process.env.PATH}`,
    },
  });
}

export async function checkLatexInstalled(): Promise<boolean> {
  try {
    await execAsync("which pdflatex", {
      env: {
        ...process.env,
        PATH: `/Library/TeX/texbin:${process.env.PATH}`,
      },
    });
    return true;
  } catch {
    return false;
  }
}
