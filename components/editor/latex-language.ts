import type { languages } from "monaco-editor";

export const latexLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: "%",
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "$", close: "$" },
    { open: "`", close: "'" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "$", close: "$" },
  ],
};

export const latexMonarchTokens: languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      // Comments
      [/%.*$/, "comment"],

      // Math mode
      [/\$\$/, { token: "string.math", next: "@mathDisplayMode" }],
      [/\$/, { token: "string.math", next: "@mathInlineMode" }],

      // Commands
      [/\\begin\{/, { token: "keyword", next: "@environment" }],
      [/\\end\{/, { token: "keyword", next: "@environment" }],
      [
        /\\[a-zA-Z@]+/,
        {
          cases: {
            "\\\\(?:documentclass|usepackage|input|include|bibliography|bibliographystyle|title|author|date|maketitle|tableofcontents|chapter|section|subsection|subsubsection|paragraph|subparagraph|label|ref|cite|textbf|textit|emph|underline|footnote|caption|centering)":
              "keyword",
            "@default": "tag",
          },
        },
      ],

      // Braces
      [/[{}]/, "delimiter.curly"],
      [/[[\]]/, "delimiter.square"],

      // Special characters
      [/[&~^_]/, "operator"],

      // Numbers
      [/\d+/, "number"],
    ],

    mathDisplayMode: [
      [/[^$\\]+/, "string.math"],
      [/\\[a-zA-Z]+/, "string.math"],
      [/\$\$/, { token: "string.math", next: "@pop" }],
      [/./, "string.math"],
    ],

    mathInlineMode: [
      [/[^$\\]+/, "string.math"],
      [/\\[a-zA-Z]+/, "string.math"],
      [/\$/, { token: "string.math", next: "@pop" }],
      [/./, "string.math"],
    ],

    environment: [
      [/[a-zA-Z*]+/, "type.identifier"],
      [/\}/, { token: "keyword", next: "@pop" }],
    ],
  },
};
