# Wiesty's LaTeX Editor

A self-hosted, browser-based LaTeX editor with live compilation and PDF preview — powered by Next.js and Monaco Editor. Run it anywhere via Docker.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Monaco Editor** — VS Code-grade editing with LaTeX syntax highlighting, autocompletion, and bracket matching
- **Live PDF Preview** — compile and preview your document side-by-side
- **Multi-Project Support** — manage multiple LaTeX projects simultaneously
- **Dark / Light Theme** — toggle between themes with one click
- **Docker Ready** — single container with TeX Live included, works on Windows, macOS, and Linux
- **Auto-Import Projects** — map a single folder and subfolders are auto-discovered as projects

## Quick Start with Docker

### Docker Compose (recommended)

Create a `docker-compose.yml`:

```yaml
services:
  latex-editor:
    image: ghcr.io/wiesty/latex-editor:latest
    ports:
      - "3000:3000"
    volumes:
      # Map your projects folder — each subfolder becomes a project
      - ./projects:/projects
      # Persist editor config
      - latex-config:/data/config

volumes:
  latex-config:
```

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

### Docker Run

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/my-projects:/projects \
  ghcr.io/wiesty/latex-editor:latest
```

## Project Folder Structure

Each project is a single folder containing your `.tex`, `.bib`, `.sty`, `.cls`, and `.bst` files. Compiled output (PDF, logs, aux files) is written to the same folder.

```
projects/               ← mounted volume
├── my-thesis/          ← auto-discovered as project
│   ├── main.tex
│   ├── references.bib
│   ├── chapters/
│   │   ├── introduction.tex
│   │   └── methodology.tex
│   ├── main.pdf        ← generated
│   └── main.log        ← generated
└── my-paper/           ← auto-discovered as project
    ├── main.tex
    └── main.pdf        ← generated
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `LATEX_PROJECTS_DIR` | Root directory for projects — each subfolder is auto-discovered | — |
| `LATEX_CONFIG_DIR` | Directory for editor config (project list) | `~/.latex-editor` |

### Adding Projects

Projects can be added in two ways:

1. **Folder structure** — Place a subfolder inside the `LATEX_PROJECTS_DIR` directory and it is automatically discovered as a project.
2. **UI** — Click the **+** button in the project sidebar and enter the absolute path to a project folder.

## Local Development

### Prerequisites

- Node.js 20+
- pdflatex (via [TeX Live](https://tug.org/texlive/) or [MacTeX](https://tug.org/mactex/))

### Setup

```bash
git clone https://github.com/wiesty/latex-editor.git
cd latex-editor
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save & Compile |
| `Ctrl/Cmd + Shift + B` | Compile |
| `Ctrl/Cmd + +` | Zoom in PDF |
| `Ctrl/Cmd + -` | Zoom out PDF |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Editor:** Monaco Editor
- **State Management:** Zustand
- **Styling:** Tailwind CSS 4
- **LaTeX Engine:** pdflatex (TeX Live)
- **Containerization:** Docker (Alpine + TeX Live)

## License

MIT
