# Wiesty's LaTeX Editor

A self-hosted LaTeX workspace for editing, compiling, and reviewing PDFs in the browser.

## What it does

- Monaco-based LaTeX and BibTeX editing
- Live PDF preview with SyncTeX scrolling
- Automatic and manual save/compile modes
- Multiple projects from one mounted folder
- External-change detection with a side-by-side diff
- Safe handling of externally renamed and deleted files
- Existing PDFs restored after a browser reload
- Dark mode, resizable panels, logs, warnings, and errors
- Built-in update check against the latest version in this repository

## Run with Docker Compose

Create `docker-compose.yml`:

```yaml
services:
  latex-editor:
    image: ghcr.io/wiesty/latex-editor:latest
    container_name: latex-server
    ports:
      - "3107:3107"
    volumes:
      - /path/to/your/latex-projects:/projects
      - latex-config:/data/config
    restart: unless-stopped

volumes:
  latex-config:
```

Start it:

```bash
docker compose up -d
```

Open [http://localhost:3107](http://localhost:3107).

Every direct subfolder inside the mounted `/projects` directory appears as a project. Source files remain on your host, while the named `latex-config` volume keeps editor configuration across container updates.

## Update

```bash
docker compose pull
docker compose up -d
```

Your project and configuration mounts are reused; replacing the container does not delete them.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save and compile |
| `Ctrl/Cmd + Shift + B` | Compile |
| `Ctrl/Cmd + +` | Zoom into PDF |
| `Ctrl/Cmd + -` | Zoom out of PDF |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `LATEX_PROJECTS_DIR` | `/projects` | Root folder containing project subfolders |
| `LATEX_CONFIG_DIR` | `/data/config` | Persistent editor configuration |
| `PORT` | `3107` | Web server port |
| `VERSION_CHECK_URL` | Repository `package.json` | Optional custom source for update checks |

## Local development

Requires Node.js 26+ and a working TeX Live or MacTeX installation.

```bash
git clone https://github.com/wiesty/latex.git
cd latex
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run build
```

## Data safety

The editor writes source files directly to the mounted project directory. When another editor changes the same open file, the browser shows both versions before anything is overwritten. Generated LaTeX artifacts such as `*-blx.bib`, `.aux`, `.bbl`, and SyncTeX files are ignored by the conflict watcher.

## License

MIT
