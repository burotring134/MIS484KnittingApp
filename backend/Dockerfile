FROM node:20-bookworm-slim

WORKDIR /app

# sharp ships glibc prebuilds — bookworm-slim has them out of the box.
# Install dumb-init so signals reach node cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
