.PHONY: all build-web build-go build run dev-web dev-go clean test

all: build

build-web:
	@echo "==> Building React Dashboard with Vite..."
	cd web && npm run build

build-go:
	@echo "==> Compiling Go single binary..."
	go build -o cosmodrome ./cmd/cosmodrome

build: build-web build-go
	@echo "==> Cosmodrome binary built successfully: ./cosmodrome"

run: build
	./cosmodrome

dev-web:
	cd web && npm run dev

dev-go:
	go run ./cmd/cosmodrome

clean:
	rm -f cosmodrome
	rm -rf web/dist
