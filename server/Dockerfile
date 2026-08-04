FROM node:20-bookworm-slim

# Chromium runtime deps for Puppeteer (PDF/print generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation wget xdg-utils \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=2003
EXPOSE 2003

CMD ["node", "src/index.js"]
