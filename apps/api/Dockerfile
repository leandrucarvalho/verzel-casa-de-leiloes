# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# SEED_ON_START=1 loads the demo data (idempotent); the free Render plan has no shell to run it by hand
CMD ["sh", "-c", "node dist/db/migrate.js && if [ \"$SEED_ON_START\" = \"1\" ]; then node dist/db/seed.js; fi && node dist/server.js"]
