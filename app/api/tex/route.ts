import { NextRequest, NextResponse } from "next/server";
import { checkLatexInstalled } from "@/lib/compile";
import {
  getInstalledStatus,
  getInstallState,
  startInstall,
  isInstallRunning,
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
  const state = getInstallState();
  return NextResponse.json({
    ...status,
    installing: state.running,
    target: state.target,
    log: state.log,
    finished: state.finished,
    success: state.success,
  });
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
      { error: "An installation is already running.", installing: true },
      { status: 409 }
    );
  }

  const { target } = (await request.json().catch(() => ({}))) as {
    target?: "extra" | "full";
  };

  // Fire-and-forget: the install runs in the background and buffers its output
  // into the server-side state, which clients poll via GET.
  const started = startInstall(target === "full" ? "full" : "extra");
  return NextResponse.json({ started }, { status: started ? 202 : 409 });
}
