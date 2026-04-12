FROM node:22-alpine

WORKDIR /app

COPY testing/flow/web/package.json ./package.json
RUN npm install

COPY testing/flow/web/index.html ./index.html
COPY testing/flow/web/vite.config.js ./vite.config.js
COPY testing/flow/web/src ./src

EXPOSE 3200

CMD ["npm", "run", "dev"]
