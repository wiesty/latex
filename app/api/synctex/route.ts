import { NextRequest, NextResponse } from "next/server";
import { forwardSync } from "@/lib/synctex";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const projectPath = p.get("projectPath");
  const mainFile = p.get("mainFile") ?? "main.tex";
  const texFile = p.get("texFile");
  const line = parseInt(p.get("line") ?? "1", 10);

  if (!projectPath || !texFile) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const mainBaseName = mainFile.replace(/\.tex$/, "");
  const page = await forwardSync(projectPath, mainBaseName, texFile, line);
  return NextResponse.json({ page });
}
