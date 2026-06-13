FROM node:22-slim

# تثبيت Python و ffmpeg و yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    --no-install-recommends && \
    pip3 install -U --pre yt-dlp[default] --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

# Install Deno (used by yt-dlp for YouTube JS challenge solving)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]