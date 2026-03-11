import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";

export async function GET(request: NextRequest) {
  const pdfPath = request.nextUrl.searchParams.get("path");

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
    const fileBuffer = await fs.readFile(pdfPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF not found. Please recompile the LaTeX document." }, { status: 404 });
  }
}
