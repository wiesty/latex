import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath, content } = body as {
      path: string;
      content: string;
    };

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "path and content are required" },
        { status: 400 }
      );
    }

    // Only allow writing to .tex and .bib files
    const ext = path.extname(filePath).toLowerCase();
    if (![".tex", ".bib", ".sty", ".cls", ".bst"].includes(ext)) {
      return NextResponse.json(
        { error: "Only .tex, .bib, .sty, .cls and .bst files can be written" },
        { status: 400 }
      );
    }

    await fs.writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Only allow deleting recognized file types
  const ext = path.extname(filePath).toLowerCase();
  const allowedExtensions = [
    // Source files
    ".tex", ".bib", ".sty", ".cls", ".bst",
    // Images & assets
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".eps", ".pdf",
    // Other source formats
    ".tikz", ".pgf", ".csv", ".dat", ".txt", ".md",
    // LaTeX build artifacts (visible when "show hidden files" is enabled)
    ".aux", ".log", ".out", ".toc", ".lof", ".lot",
    ".fls", ".fdb_latexmk", ".synctex.gz", ".synctex",
    ".bbl", ".blg", ".bcf", ".run.xml",
    ".nav", ".snm", ".vrb", ".idx", ".ind", ".ilg",
    ".glg", ".glo", ".gls", ".ist",
    ".dvi", ".xdv",
  ];
  if (!allowedExtensions.includes(ext)) {
    return NextResponse.json(
      { error: `File type ${ext} cannot be deleted` },
      { status: 400 }
    );
  }

  try {
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
