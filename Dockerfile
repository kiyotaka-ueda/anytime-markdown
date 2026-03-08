FROM node:24-slim AS base

# curl のインストール
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /anytime-markdown/

COPY ./package.json ./
RUN npm install

# 開発用ステージ
FROM base AS local

# Serena MCP サーバー用の Python パッケージマネージャー
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client bash sudo tmux curl gpg && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    echo "node ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

# Claude Code CLI のインストール
RUN npm install -g @anthropic-ai/claude-code

# Playwright ブラウザとシステム依存パッケージのインストール
RUN npx playwright install --with-deps

ENV PATH="/home/node/.local/bin:${PATH}"

# nodeユーザーのホームディレクトリを準備
RUN mkdir -p /home/node/.ssh /home/node/.claude && \
    chown -R node:node /home/node

WORKDIR /anytime-markdown/

COPY ./package.json ./
RUN npm install

# 作業ディレクトリの権限をnodeユーザーに変更
RUN chown -R node:node /anytime-markdown

USER node

WORKDIR /anytime-markdown
COPY --chown=node:node . .

ENTRYPOINT ["sleep", "infinity"]

# 開発サーバー用ステージ
FROM base AS development

WORKDIR /anytime-markdown
COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "dev"]
