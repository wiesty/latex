import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  let pdfPath = request.nextUrl.searchParams.get("path");
  const projectPath = request.nextUrl.searchParams.get("projectPath");
  const mainFile = request.nextUrl.searchParams.get("mainFile") || "main.tex";
  const infoOnly = request.nextUrl.searchParams.get("info") === "1";

  if (projectPath) {
    const safeMainFile = path.basename(mainFile);
    const baseName = safeMainFile.toLowerCase().endsWith(".tex")
      ? safeMainFile.slice(0, -4)
      : safeMainFile;
    pdfPath = path.join(projectPath, `${baseName}.pdf`);
  }

  if (!pdfPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Validate that the file is a PDF
  if (!pdfPath.endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files can be served" },
      { status: 400 }
    );
  }

  try {
    if (infoOnly) {
      const stat = await fs.stat(pdfPath);
      return NextResponse.json({
        exists: true,
        pdfPath,
        timestamp: stat.mtimeMs,
      });
    }

    const fileBuffer = await fs.readFile(pdfPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    if (infoOnly) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({ error: "PDF not found. Please recompile the LaTeX document." }, { status: 404 });
  }
}
