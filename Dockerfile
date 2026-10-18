# --- Сборка клиента ---
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run icons && npm run build

# --- Сервер ---
FROM node:24-alpine AS server
WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY plans.json ./plans.json
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 3000
CMD ["node", "src/index.js"]
