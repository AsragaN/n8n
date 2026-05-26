FROM node:20-alpine

WORKDIR /app

# Copiar solo lo necesario (no hay deps npm)
COPY server.js index.html ./

# Healthcheck simple: el server responde GET /config con JSON
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/config > /dev/null || exit 1

EXPOSE 8080

CMD ["node", "server.js"]
