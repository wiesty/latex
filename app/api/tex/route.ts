import { NextRequest, NextResponse } from "next/server";
import { checkLatexInstalled } from "@/lib/compile";
import {
  getInstalledStatus,
  installPackages,
  isInstallRunning,
  EXTRA_COLLECTIONS,
  FULL_SCHEME,
} from "@/lib/tex-packages";

export const dynamic = "force-dynamic";

export async function GET() {
  const installed = await checkLatexInstalled();
  if (!installed) {
    return NextResponse.json(
      { error: "TeX Live is not installed in this environment." },
      { status: 500 }
    );
  }
  const status = await getInstalledStatus();
  return NextResponse.json({ ...status, installing: isInstallRunning() });
}

export async function POST(request: NextRequest) {
  const installed = await checkLatexInstalled();
  if (!installed) {
    return NextResponse.json(
      { error: "TeX Live is not installed in this environment." },
      { status: 500 }
    );
  }

  if (isInstallRunning()) {
    return NextResponse.json(
      { error: "An installation is already running." },
      { status: 409 }
    );
  }

  const { target } = (await request.json().catch(() => ({}))) as {
    target?: "extra" | "full";
  };
  const packages = target === "full" ? FULL_SCHEME : EXTRA_COLLECTIONS;

  // Stream tlmgr output to the client as plain text lines.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onLog = (line: string) => {
        try {
          controller.enqueue(encoder.encode(line + "\n"));
        } catch {
          // controller already closed
        }
      };
      installPackages(packages, onLog)
        .catch((err) => onLog(`Error: ${err?.message ?? err}`))
        .finally(() => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
