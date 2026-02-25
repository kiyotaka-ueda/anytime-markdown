FROM node:24-alpine AS base

# curl と openssl のインストール
RUN apk add --no-cache curl

WORKDIR /anytime-markdown/

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY ./package.json ./
RUN npm install

# 開発用ステージ
FROM base AS local

# Serena MCP サーバー用の Python パッケージマネージャー
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN apk add --no-cache git openssh-client bash sudo tmux \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont && \
    echo "node ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Claude Code CLI のインストール
RUN npm install -g @anthropic-ai/claude-code

ENV PATH="/home/node/.local/bin:${PATH}"

# nodeユーザーのホームディレクトリを準備
RUN mkdir -p /home/node/.ssh /home/node/.claude && \
    chown -R node:node /home/node

# 作業ディレクトリとnode_modulesの権限をnodeユーザーに変更
# RUN chown -R node:node /anytime-markdown /anytime-markdown/node_modules
RUN chown -R node:node /anytime-markdown

USER node

WORKDIR /anytime-markdown
COPY --chown=node:node . .

ENTRYPOINT ["sleep", "infinity"]

# 本番用ステージ
FROM base AS development

WORKDIR /anytime-markdown
COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "dev"]
