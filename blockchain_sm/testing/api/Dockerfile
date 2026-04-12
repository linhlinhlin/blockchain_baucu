FROM node:22-alpine

WORKDIR /app

COPY testing/api/package.json ./package.json
RUN npm install

COPY testing/api/src ./src
COPY deployments ./deployments
COPY tmp ./tmp

EXPOSE 3001

CMD ["node", "src/server.js"]
