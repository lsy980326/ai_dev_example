FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /workspace/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web .
ENV CI=1
CMD ["npm","run","test:e2e"]
