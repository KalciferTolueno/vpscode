FROM oven/bun:1.3.14 AS build

ARG GIT_SHA=local
ENV HUSKY=0 \
    OPENCODE_CHANNEL=vpscode \
    OPENCODE_VERSION=0.0.0-vpscode-${GIT_SHA}

WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd packages/opencode build --single --skip-install \
    && mkdir -p /out \
    && cp packages/opencode/dist/opencode-linux-*/bin/opencode /out/opencode

FROM oven/bun:1.3.14

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git openssh-client ripgrep \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/opencode /usr/local/bin/opencode
WORKDIR /workspace

EXPOSE 4096
ENTRYPOINT ["opencode"]
CMD ["serve", "--hostname", "0.0.0.0", "--port", "4096"]
