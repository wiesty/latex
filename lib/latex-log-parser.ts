import { ParsedError } from "@/types";

export function parseLatexLog(log: string): {
  errors: ParsedError[];
  warnings: ParsedError[];
} {
  const errors: ParsedError[] = [];
  const warnings: ParsedError[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match errors like: ./main.tex:42: Undefined control sequence.
    const errorMatch = line.match(/^(.+\.tex):(\d+):\s*(.+)/);
    if (errorMatch) {
      const context = lines
        .slice(Math.max(0, i - 1), Math.min(lines.length, i + 3))
        .join("\n");
      errors.push({
        type: "error",
        file: errorMatch[1],
        line: parseInt(errorMatch[2], 10),
        message: errorMatch[3].trim(),
        context,
      });
      continue;
    }

    // Match ! errors (LaTeX fatal errors)
    if (line.startsWith("!")) {
      const message = line.slice(2).trim();
      let errorLine: number | null = null;
      let errorFile = "";

      // Look ahead for line number info: l.42
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lineMatch = lines[j].match(/^l\.(\d+)/);
        if (lineMatch) {
          errorLine = parseInt(lineMatch[1], 10);
          break;
        }
      }

      // Look backwards for file context
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const fileMatch = lines[j].match(/\(([^()]*\.tex)/);
        if (fileMatch) {
          errorFile = fileMatch[1];
          break;
        }
      }

      const context = lines
        .slice(Math.max(0, i - 1), Math.min(lines.length, i + 5))
        .join("\n");

      errors.push({
        type: "error",
        file: errorFile,
        line: errorLine,
        message,
        context,
      });
      continue;
    }

    // Match LaTeX warnings
    const warningMatch = line.match(
      /LaTeX Warning:\s*(.+?)(?:\s+on input line (\d+))?\.?\s*$/
    );
    if (warningMatch) {
      warnings.push({
        type: "warning",
        file: "",
        line: warningMatch[2] ? parseInt(warningMatch[2], 10) : null,
        message: warningMatch[1].trim(),
      });
      continue;
    }

    // Match overfull/underfull box warnings
    const boxMatch = line.match(
      /((?:Over|Under)full \\[hv]box .+?) (?:at lines? (\d+)(?:--(\d+))?|in paragraph at lines? (\d+)(?:--(\d+))?)/
    );
    if (boxMatch) {
      const lineNum = boxMatch[2] || boxMatch[4];
      warnings.push({
        type: "warning",
        file: "",
        line: lineNum ? parseInt(lineNum, 10) : null,
        message: boxMatch[1].trim(),
      });
      continue;
    }

    // Match Package warnings
    const pkgWarnMatch = line.match(/Package (\w+) Warning:\s*(.+)/);
    if (pkgWarnMatch) {
      let fullMessage = pkgWarnMatch[2];
      // Some warnings span multiple lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].startsWith("(") || lines[j].match(/^\s{2,}/)) {
          fullMessage += " " + lines[j].trim();
        } else {
          break;
        }
      }
      const lineMatch = fullMessage.match(/on input line (\d+)/);
      warnings.push({
        type: "warning",
        file: "",
        line: lineMatch ? parseInt(lineMatch[1], 10) : null,
        message: `[${pkgWarnMatch[1]}] ${fullMessage.trim()}`,
      });
    }
  }

  return { errors, warnings };
}
