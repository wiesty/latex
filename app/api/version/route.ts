import { NextResponse } from "next/server";
import packageJson from "@/package.json";

const LATEST_PACKAGE_URL =
  process.env.VERSION_CHECK_URL ??
  "https://raw.githubusercontent.com/wiesty/latex/main/package.json";
const REPOSITORY_URL = "https://github.com/wiesty/latex";

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  const length = Math.max(candidateParts.length, currentParts.length);
  for (let index = 0; index < length; index++) {
    const difference =
      (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export async function GET(request: Request) {
  const currentVersion = packageJson.version;
  // A manual check (?fresh=1) bypasses the 15-minute cache so clicking the
  // version in the status bar always re-queries GitHub.
  const fresh = new URL(request.url).searchParams.has("fresh");

  try {
    const response = await fetch(LATEST_PACKAGE_URL, {
      ...(fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 900 } }),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Version source unavailable");
    const latestPackage = (await response.json()) as { version?: string };
    const latestVersion = latestPackage.version ?? currentVersion;

    return NextResponse.json({
      currentVersion,
      latestVersion,
      updateAvailable: isNewerVersion(latestVersion, currentVersion),
      repositoryUrl: REPOSITORY_URL,
    });
  } catch {
    return NextResponse.json({
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      repositoryUrl: REPOSITORY_URL,
      checkFailed: true,
    });
  }
}
