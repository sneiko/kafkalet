.PHONY: dev build build-mac build-mac-arm build-win build-linux build-all \
        test vet check lint frontend-lint frontend-build frontend-install \
        generate clean help

# ── Dev ────────────────────────────────────────────────────────────────────────

dev: ## Start development server with hot reload
	wails dev

# ── Build ──────────────────────────────────────────────────────────────────────

build: ## Build for current platform
	wails build

build-mac: ## Build for macOS Intel (darwin/amd64)
	wails build -platform darwin/amd64

build-mac-arm: ## Build for macOS Apple Silicon (darwin/arm64)
	wails build -platform darwin/arm64

build-win: ## Build for Windows amd64 with NSIS installer
	wails build -platform windows/amd64 -nsis

build-linux: ## Build for Linux amd64
	wails build -platform linux/amd64

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
