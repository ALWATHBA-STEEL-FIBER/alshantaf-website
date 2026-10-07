FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl ffmpeg poppler-utils chromium nss freetype harfbuzz ca-certificates ttf-freefont

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN mkdir -p dist/knowledge && cp src/knowledge/*.txt dist/knowledge/

RUN mkdir -p uploads

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node dist/server.js"]
