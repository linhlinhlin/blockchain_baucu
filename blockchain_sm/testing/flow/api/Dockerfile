FROM node:22-alpine

WORKDIR /app/testing/flow/api
ENV NODE_PATH=/app/testing/flow/api/node_modules

COPY testing/flow/api/package.json ./package.json
COPY testing/flow/api/package-lock.json ./package-lock.json
RUN npm install

COPY testing/flow/api/src ./src
COPY testing/flow/db /app/db
COPY artifacts /app/artifacts
COPY scripts /app/scripts
COPY deployments /app/deployments
COPY .env /app/.env

EXPOSE 3201

CMD ["node", "src/server.js"]
