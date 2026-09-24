# Build: docker build -t flagguard-platform platform
# Run:   docker run --rm -p 8080:8080 \
#          -e DATABASE_URL=postgres://flagguard:flagguard@host.docker.internal:5432/flagguard?sslmode=disable \
#          -e REDIS_URL=redis://host.docker.internal:6379/0 \
#          -e PROMETHEUS_URL=http://host.docker.internal:9090 \
#          flagguard-platform

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/platform ./cmd/server

FROM alpine:3.22
RUN adduser -D -H -u 10001 flagguard
COPY --from=build /out/platform /usr/local/bin/platform
USER flagguard
EXPOSE 8080
ENTRYPOINT ["platform"]
