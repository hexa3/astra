# SPDX-License-Identifier: MPL-2.0
FROM node:24.8.0-bookworm-slim@sha256:82a1d74c5988b72e839ac01c5bf0f7879a8ffd14ae40d7008016bca6ae12852b
WORKDIR /app
COPY sync-server/server.mjs sync-server/package.json ./
COPY LICENSE ./LICENSE
ENV ASTRA_SYNC_DATA_DIR=/data ASTRA_SYNC_HOST=0.0.0.0 ASTRA_SYNC_PORT=8787
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.mjs"]
