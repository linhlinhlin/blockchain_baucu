FROM node:20-bookworm-slim

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./

# S16 (spec 004): chay non-root. User `node` (uid 1000) co san trong image node:20.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
