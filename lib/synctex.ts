import zlib from "zlib";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

/**
 * Forward SyncTeX lookup: given a TeX source file and line number,
 * returns the PDF page number that corresponds to that position.
 */
export async function forwardSync(
  projectPath: string,
  mainBaseName: string,
  texFile: string,
  line: number
): Promise<number | null> {
  let content: string;

  try {
    const buf = await fs.readFile(path.join(projectPath, `${mainBaseName}.synctex.gz`));
    content = (await gunzip(buf)).toString("utf-8");
  } catch {
    try {
      content = await fs.readFile(
        path.join(projectPath, `${mainBaseName}.synctex`),
        "utf-8"
      );
    } catch {
      return null;
    }
  }

  // Build index → file path map from "Input:N:path" records
  const inputs = new Map<number, string>();
  const inputRegex = /^Input:(\d+):(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = inputRegex.exec(content)) !== null) {
    inputs.set(parseInt(m[1]), m[2]);
  }

  // Find the file index matching texFile (by full path, relative, or basename)
  let targetIdx: number | null = null;
  for (const [idx, filePath] of inputs) {
    if (
      filePath === texFile ||
      filePath.endsWith("/" + texFile) ||
      path.basename(filePath) === path.basename(texFile)
    ) {
      targetIdx = idx;
      break;
    }
  }
  if (targetIdx === null) return null;

  // Scan page blocks {N ... } to find the closest line match
  const rawLines = content.split("\n");
  let currentPage = 0;
  let bestPage = 1;
  let bestLineDiff = Infinity;

  for (const rawLine of rawLines) {
    const s = rawLine.trim();

    // Page start marker: {N
    if (/^\{\d+$/.test(s)) {
      currentPage = parseInt(s.slice(1));
      continue;
    }

    // hbox/vbox records: [fileIdx,lineNum:... or (fileIdx,lineNum:...
    if (currentPage > 0 && (s.startsWith("[") || s.startsWith("("))) {
      const match = s.match(/^[\[(](\d+),(\d+):/);
      if (match) {
        const fileIdx = parseInt(match[1]);
        const lineNum = parseInt(match[2]);
        if (fileIdx === targetIdx) {
          const diff = Math.abs(lineNum - line);
          if (diff < bestLineDiff) {
            bestLineDiff = diff;
            bestPage = currentPage;
          }
        }
      }
    }
  }

  return bestLineDiff < Infinity ? bestPage : null;
}
