FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --chown=node:node backend/ ./
USER node

EXPOSE 5000
CMD ["npm", "start"]
