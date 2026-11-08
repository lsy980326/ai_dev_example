FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24.22.2-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd -g 10001 study && useradd --no-log-init -u 10001 -g study study
COPY --from=build --chown=study:study /app/.next/standalone ./
COPY --from=build --chown=study:study /app/.next/static ./.next/static
COPY --from=build --chown=study:study /app/public ./public
USER 10001:10001
EXPOSE 3000
CMD ["node","server.js"]
