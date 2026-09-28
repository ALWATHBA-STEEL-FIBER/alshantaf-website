FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Inlined into the edge proxy at build time (must match runtime value).
ARG ADMIN_GATE_SECRET=
ENV ADMIN_GATE_SECRET=$ADMIN_GATE_SECRET
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG ADMIN_GATE_SECRET=
ENV ADMIN_GATE_SECRET=$ADMIN_GATE_SECRET
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
