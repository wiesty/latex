# --- Build stage ---
FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production stage ---
# Debian (not Alpine) so we can use the official TeX Live installer, which keeps
# `tlmgr` fully functional for installing additional packages/fonts at runtime.
FROM node:26-bookworm-slim AS runner

ARG BUILD_DATE
ARG SOURCE_REPOSITORY=https://github.com/wiesty/latex
ARG APP_VERSION=dev
ENV BUILD_DATE=${BUILD_DATE}
ENV APP_VERSION=${APP_VERSION}

LABEL org.opencontainers.image.source=${SOURCE_REPOSITORY}
LABEL org.opencontainers.image.description="Self-hosted browser-based LaTeX editor"
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.version=${APP_VERSION}

WORKDIR /app

# Minimal runtime deps for TeX Live + the installer
RUN apt-get update && apt-get install -y --no-install-recommends \
        wget \
        ca-certificates \
        perl \
        fontconfig \
        libfontconfig1 \
        ghostscript \
    && rm -rf /var/lib/apt/lists/*

# --- Install a SMALL base TeX Live via the official installer ---
# scheme-basic + a few sensible collections. Everything heavier (full fonts,
# latexextra, tikz, ...) is pulled on demand at runtime via tlmgr user-mode and
# persisted on the /data/config volume (TEXMFHOME). This keeps the image small
# and the build fast.
RUN set -eux; \
    mkdir -p /tmp/install-tl; \
    wget -qO /tmp/install-tl.tar.gz https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz; \
    tar -xzf /tmp/install-tl.tar.gz -C /tmp/install-tl --strip-components=1; \
    printf '%s\n' \
        'selected_scheme scheme-basic' \
        'TEXDIR /usr/local/texlive' \
        'TEXMFLOCAL /usr/local/texlive/texmf-local' \
        'TEXMFSYSVAR /usr/local/texlive/texmf-var' \
        'TEXMFSYSCONFIG /usr/local/texlive/texmf-config' \
        'instopt_adjustpath 0' \
        'tlpdbopt_install_docfiles 0' \
        'tlpdbopt_install_srcfiles 0' \
        > /tmp/tl.profile; \
    /tmp/install-tl/install-tl --no-interaction --profile=/tmp/tl.profile; \
    # Symlink all TL binaries onto the default PATH (arch-agnostic)
    ln -sf /usr/local/texlive/bin/*/* /usr/local/bin/; \
    # Baked-in extras for simple + German documents
    tlmgr install collection-latexrecommended collection-fontsrecommended collection-langgerman; \
    rm -rf /tmp/install-tl /tmp/install-tl.tar.gz /tmp/tl.profile

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LATEX_CONFIG_DIR=/data/config
ENV LATEX_PROJECTS_DIR=/projects
ENV PORT=3107
ENV HOSTNAME=0.0.0.0
# A writable HOME so tools (and tlmgr) don't fall back to /nonexistent
ENV HOME=/home/nextjs
# tlmgr user-mode trees on the persistent volume — survive container/image
# updates. TEXMFVAR/TEXMFCONFIG must be writable so font-map (updmap) and
# format postactions succeed when installing Type1 font packages at runtime.
ENV TEXMFHOME=/data/config/texmf
ENV TEXMFVAR=/data/config/texmf-var
ENV TEXMFCONFIG=/data/config/texmf-config

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/startup.js ./startup.js

# Create default directories (chown so the non-root user can write its HOME and
# the TEXMF trees on the volume)
RUN mkdir -p /data/config /projects /home/nextjs && \
    chown nextjs:nodejs /data/config /projects /home/nextjs

USER nextjs

EXPOSE 3107

CMD ["node", "startup.js"]
