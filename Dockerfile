FROM node:22-slim

# تثبيت Python و ffmpeg و yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    --no-install-recommends && \
    pip3 install yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]