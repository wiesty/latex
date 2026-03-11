import { NextRequest, NextResponse } from "next/server";
import { compileLatex, checkLatexInstalled } from "@/lib/compile";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const isInstalled = await checkLatexInstalled();
    if (!isInstalled) {
      return NextResponse.json(
        { error: "pdflatex is not installed. Please install MacTeX or TeX Live." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { projectPath, mainFile } = body as {
      projectPath: string;
      mainFile?: string;
    };

    if (!projectPath) {
      return NextResponse.json(
        { error: "projectPath is required" },
        { status: 400 }
      );
    }

    // Validate that projectPath exists and has input/output structure
    const fs = await import("fs/promises");
    const inputDir = path.join(projectPath, "input");
    try {
      await fs.access(inputDir);
    } catch {
      return NextResponse.json(
        { error: `Input directory not found: ${inputDir}` },
        { status: 400 }
      );
    }

    const result = await compileLatex(projectPath, mainFile || "main.tex");

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
