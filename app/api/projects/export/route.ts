import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function GET(request: NextRequest) {
  const projectPath = request.nextUrl.searchParams.get("path");

  if (!projectPath) {
    return NextResponse.json(
      { error: "path is required" },
      { status: 400 }
    );
  }

  // Validate projectPath exists and is a directory
  try {
    const stat = await fs.stat(projectPath);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "path is not a directory" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Project directory does not exist" },
      { status: 404 }
    );
  }

  const projectName = path.basename(projectPath);

  try {
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();

    const archive = archiver("zip", { zlib: { level: 9 } });

    const collectPromise = new Promise<Buffer>((resolve, reject) => {
      passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
      passthrough.on("end", () => resolve(Buffer.concat(chunks)));
      passthrough.on("error", reject);
    });

    archive.pipe(passthrough);
    archive.directory(projectPath, projectName);
    await archive.finalize();

    const zipBuffer = await collectPromise;

    return new Response(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectName}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ZIP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
