FROM node:22-alpine

WORKDIR /app

COPY testing/web/package.json ./package.json
RUN npm install

COPY testing/web/index.html ./index.html
COPY testing/web/vite.config.js ./vite.config.js
COPY testing/web/src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]
