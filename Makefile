.PHONY: dev build build-mac build-mac-arm build-win build-linux build-all \
        test vet check lint frontend-lint frontend-build frontend-install \
        generate clean help

VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X main.Version=$(VERSION)

# ── Dev ────────────────────────────────────────────────────────────────────────

dev: ## Start development server with hot reload
	wails dev

# ── Build ──────────────────────────────────────────────────────────────────────

build: ## Build for current platform
	wails build -ldflags "$(LDFLAGS)"
	@if [ "$$(uname)" = "Darwin" ] && [ -d build/bin/kafkalet.app ]; then \
		codesign --force --deep -s - build/bin/kafkalet.app; \
		echo "✓ ad-hoc signed: build/bin/kafkalet.app"; \
	fi

build-mac: ## Build for macOS Intel (darwin/amd64)
	wails build -platform darwin/amd64 -ldflags "$(LDFLAGS)"
	codesign --force --deep -s - build/bin/kafkalet.app

build-mac-arm: ## Build for macOS Apple Silicon (darwin/arm64)
	wails build -platform darwin/arm64 -ldflags "$(LDFLAGS)"
	codesign --force --deep -s - build/bin/kafkalet.app

build-win: ## Build for Windows amd64 with NSIS installer
	wails build -platform windows/amd64 -nsis -ldflags "$(LDFLAGS)"

build-linux: ## Build for Linux amd64
	wails build -platform linux/amd64 -ldflags "$(LDFLAGS)"

build-all: build-mac build-mac-arm build-win build-linux ## Build for all platforms

# ── Test & Lint ────────────────────────────────────────────────────────────────

test: ## Run Go tests
	go test ./...

vet: ## Run go vet
	go vet ./...

check: vet test ## Run go vet + tests

frontend-lint: ## Run frontend ESLint
	cd frontend && npm run lint

lint: vet frontend-lint ## Run all linters (go vet + eslint)

# ── Frontend ───────────────────────────────────────────────────────────────────

frontend-install: ## Install frontend npm dependencies
	cd frontend && npm install

frontend-build: ## Build frontend only (tsc + vite)
	cd frontend && npm run build

# ── Wails ──────────────────────────────────────────────────────────────────────

generate: ## Regenerate Wails bindings after changing app.go
	wails generate module

# ── Cleanup ────────────────────────────────────────────────────────────────────

clean: ## Remove build artifacts (build/bin)
	rm -rf build/bin

# ── Help ───────────────────────────────────────────────────────────────────────

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help
