import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = new Set([
  // LaTeX
  ".tex", ".bib", ".sty", ".cls", ".bst",
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps", ".pdf",
  // Other common LaTeX assets
  ".tikz", ".pgf", ".csv", ".dat", ".txt", ".md",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectPath = formData.get("projectPath") as string;
    const files = formData.getAll("files") as File[];

    if (!projectPath) {
      return NextResponse.json(
        { error: "projectPath is required" },
        { status: 400 }
      );
    }

    // Validate projectPath exists and is a directory
    try {
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "projectPath is not a directory" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "projectPath does not exist" },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        results.push({
          name: file.name,
          success: false,
          error: `File type ${ext} is not allowed`,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        results.push({
          name: file.name,
          success: false,
          error: "File exceeds 50 MB limit",
        });
        continue;
      }

      // Sanitize filename to prevent path traversal
      const safeName = path.basename(file.name);
      const destPath = path.join(projectPath, safeName);

      // Ensure destPath is still within projectPath
      const resolvedDest = path.resolve(destPath);
      const resolvedProject = path.resolve(projectPath);
      if (!resolvedDest.startsWith(resolvedProject + path.sep) && resolvedDest !== resolvedProject) {
        results.push({
          name: file.name,
          success: false,
          error: "Invalid file path",
        });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(resolvedDest, buffer);
        results.push({ name: safeName, success: true });
      } catch (err) {
        results.push({
          name: file.name,
          success: false,
          error: err instanceof Error ? err.message : "Write failed",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ results, successCount, totalCount: files.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
