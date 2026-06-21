import path from "path";

const LATEX_BUILD_SUFFIXES = [
  ".aux",
  ".log",
  ".out",
  ".toc",
  ".lof",
  ".lot",
  ".fls",
  ".fdb_latexmk",
  ".synctex.gz",
  ".synctex",
  ".bbl",
  ".blg",
  ".bcf",
  ".run.xml",
  ".nav",
  ".snm",
  ".vrb",
  ".idx",
  ".ind",
  ".ilg",
  ".glg",
  ".glo",
  ".gls",
  ".ist",
  ".dvi",
  ".xdv",
  "-blx.bib",
  ".blx.bib",
];

export function isLatexBuildArtifact(fileName: string): boolean {
  const normalized = path.basename(fileName).toLowerCase();
  return LATEX_BUILD_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function isTemporaryFile(fileName: string): boolean {
  const normalized = path.basename(fileName).toLowerCase();
  return (
    normalized.startsWith(".") ||
    normalized.includes(".busy") ||
    normalized.endsWith("~") ||
    normalized.endsWith(".tmp") ||
    normalized.endsWith(".swp") ||
    normalized.endsWith(".swo")
  );
}
