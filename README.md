# Wiesty's LaTeX Editor

A self-hosted, browser-based LaTeX editor with live compilation and PDF preview — powered by Next.js and Monaco Editor. Run it on your local machine with docker. 

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Monaco Editor** — VS Code-grade editing with LaTeX syntax highlighting, autocompletion, and bracket matching
- **Live PDF Preview** — compile and preview your document side-by-side
- **Multi-Project Support** — manage multiple LaTeX projects simultaneously
- **Dark / Light Theme** — toggle between themes with one click
- **Docker Ready** — single container with TeX Live included, works on Windows, macOS, and Linux
- **Auto-Import Projects** — map a folder and every subfolder is auto-discovered as a project

---

## Quick Start with Docker

### Docker Compose (recommended)

```yaml
services:
  latex-editor:
    image: ghcr.io/wiesty/latex-editor:latest
    ports:
      - "3107:3107"
    volumes:
      - ./projects:/projects
      - latex-config:/data/config

volumes:
  latex-config:
```

```bash
docker compose up -d
```

Open [http://localhost:3107](http://localhost:3107).

### Docker Run

```bash
docker run -d \
  -p 3107:3107 \
  -v /path/to/my-projects:/projects \
  ghcr.io/wiesty/latex-editor:latest
```

---

## Why the volume mounts?

The Docker image ships as a fully self-contained, read-only build. Everything the app needs to run is baked in — Node.js, the compiled Next.js bundle, and a full TeX Live installation. Nothing is written inside the container itself.

That means any data that should **persist across restarts or survive an image update** must live outside the container, which is what the two mounts are for:

### `/projects`

Your LaTeX source files live outside the container so you can:

- Edit them with any local tool (VS Code, git, Finder, …) without going through the editor UI
- Keep them under version control
- Back them up independently of the container lifecycle
- Upgrade or replace the container image without losing a single `.tex` file

Every direct subfolder of the mapped path is automatically discovered as a project — no manual registration needed.

### `/data/config` (named volume)

Stores editor state that should survive a container restart: the project list and any persisted settings. Using a named Docker volume instead of a bind-mount here means Docker manages the lifecycle — no leftover config files to clean up on the host.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LATEX_PROJECTS_DIR` | `/projects` | Root directory scanned for projects |
| `LATEX_CONFIG_DIR` | `/data/config` | Directory for persisted editor config |
| `PORT` | `3107` | HTTP port the server listens on |

---

## Local Development

**Prerequisites:** Node.js 20+, `pdflatex` (TeX Live / MacTeX)

```bash
git clone https://github.com/wiesty/latex-editor.git
cd latex-editor
npm install
npm run dev
```

Open [http://localhost:3107](http://localhost:3107).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save & Compile |
| `Ctrl/Cmd + Shift + B` | Compile |
| `Ctrl/Cmd + +` | Zoom in PDF |
| `Ctrl/Cmd + -` | Zoom out PDF |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Editor:** Monaco Editor
- **State Management:** Zustand
- **Styling:** Tailwind CSS 4
- **LaTeX Engine:** pdflatex (TeX Live)
- **Containerization:** Docker multi-stage build (Alpine + TeX Live, production-only)