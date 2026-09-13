# Mshwar

AI-Powered Lebanon Trip & Experience Platform

Discover. Plan. Book Lebanon.

[![CI](https://github.com/mshwar/mshwar/actions/workflows/ci.yml/badge.svg)](https://github.com/mshwar/mshwar/actions/workflows/ci.yml)

## Architecture

```
apps/web                   → Next.js 15 frontend (TypeScript, Tailwind, shadcn/ui)
services/api               → FastAPI backend (SQLAlchemy 2.x, Pydantic v2, Alembic)
packages/shared            → Shared TypeScript types and utilities
mshwar-brand-foundation    → Brand tokens (JSON source) and generated Tailwind / Figma artifacts
```

## Tech Stack

| Layer      | Technology                                                                        |
| ---------- | --------------------------------------------------------------------------------- |
| Frontend   | Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui                            |
| Backend    | FastAPI, Python 3.11, SQLAlchemy 2.x, Pydantic v2, Alembic                        |
| Database   | PostgreSQL 17 + PostGIS + pgvector + btree_gist                                   |
| AI/LLM     | LLM provider abstraction (OpenAI/Ollama), pgvector RAG, OR-Tools                  |
| Maps       | Google Maps Platform                                                              |
| Weather    | Open-Meteo                                                                        |
| Images     | ImageKit                                                                          |
| Payments   | Stripe (test mode) + provider abstraction                                         |
| Monitoring | Sentry + PostHog                                                                  |
| Deployment | Vercel (frontend), Docker Compose (local), Self-hosted PostgreSQL 17 (production) |

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm 9+
- Python 3.11+
- Docker and Docker Compose
- PostgreSQL 17 with PostGIS, pgvector, and btree_gist (if running without Docker)

### Single Command Setup

```bash
# Clone and install
git clone <repo-url>
cd mshwar
pnpm install

# Start everything with Docker Compose
docker compose up --build
```

Or run each service individually:

```bash
# Terminal 1 — Frontend
pnpm --filter web dev

# Terminal 2 — Backend
pnpm --filter api dev
```

### Without Docker

**Backend:**

```bash
cd services/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env .env.local  # or set environment variables
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd apps/web
pnpm install
pnpm dev
```

## Ports

| Service       | Port | URL                        |
| ------------- | ---- | -------------------------- |
| Web (Next.js) | 3000 | http://localhost:3000      |
| API (FastAPI) | 8000 | http://localhost:8000      |
| API Docs      | 8000 | http://localhost:8000/docs |
| PostgreSQL    | 5432 | localhost:5432             |
| Redis         | 6379 | localhost:6379             |

## Environment Variables

See `.env.example` for all required variables. Key variables:

| Variable              | Default                                                        | Description                     |
| --------------------- | -------------------------------------------------------------- | ------------------------------- |
| `NODE_ENV`            | `development`                                                  | Application environment         |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`                                        | Backend API URL for the web app |
| `DATABASE_URL`        | `postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar` | PostgreSQL connection string    |
| `REDIS_URL`           | `redis://localhost:6379/0`                                     | Redis connection string         |
| `SECRET_KEY`          | `change-me-in-production`                                      | JWT signing secret              |
| `ALGORITHM`           | `HS256`                                                        | JWT algorithm                   |

## Code Quality

### Linting, Formatting, Type Checking

```bash
# Lint all packages
pnpm run lint

# Format all files
pnpm run format

# Type check all packages
pnpm run typecheck

# Check formatting without fixing
pnpm run format:check
```

### Python Code Quality

```bash
cd services/api
pip install ruff mypy
ruff check .
ruff format . --check
mypy app/
```

### Pre-commit Hooks

Pre-commit hooks run automatically on `git commit`:

- ESLint (TypeScript)
- Prettier (formatting)
- Ruff (Python linting/formatting)
- mypy (Python type checking)
- Commit message convention enforcement

To install:

```bash
pnpm install
npx husky install
```

## Commit Convention

This project uses [Conventional Commits](https://conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Example: `feat(trip-builder): add weather-aware replanning`

## Development

### Adding a New API Endpoint

1. Create a new file in `services/api/app/api/v1/endpoints/`
2. Add the router to `services/api/app/api/v1/router.py`
3. Add tests in `services/api/tests/`

### Adding a New Frontend Component

1. Create it in `apps/web/src/components/ui/`
2. Use `cn()` from `@/lib/utils` for class merging
3. Follow shadcn/ui patterns

### Database Provisioning

```bash
# Apply migrations including extension creation
cd services/api && alembic upgrade head

# Extension smoke tests (requires running PostgreSQL)
PYTHONPATH=services/api python3 -m pytest tests/test_extensions.py -v
```

See [docs/database-provisioning.md](docs/database-provisioning.md) for the Supabase vs self-hosted decision and trade-offs.

## Testing

```bash
# Frontend tests
pnpm --filter web test

# Design tokens (single source → Tailwind / CSS / Figma exports)
pnpm tokens:generate
pnpm tokens:check
pnpm tokens:contrast
pnpm tokens:test

# Component library (Storybook — Theme and Direction toolbars, axe-core on every story)
pnpm --filter web storybook
pnpm --filter web build-storybook

# Backend tests (including extension smoke tests)
cd services/api && PYTHONPATH=services/api python3 -m pytest tests/ -v
```

### Extension Smoke Tests

Tests that verify PostgreSQL extensions are working:

| Test                                       | Extension Verified              |
| ------------------------------------------ | ------------------------------- |
| `test_st_within`                           | PostGIS (`ST_DWithin`)          |
| `test_vector_inner_product_operator`       | pgvector (`<->` operator)       |
| `test_exclude_constraint_prevents_overlap` | btree_gist (EXCLUDE constraint) |

## Project Structure

```
mshwar/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js app router pages
│       │   ├── components/     # React components
│       │   │   └── ui/         # shadcn/ui components
│       │   ├── lib/            # Utilities and config
│       │   ├── hooks/          # Custom React hooks
│       │   └── styles/generated/  # CSS vars + Tailwind theme from tokens
│       ├── components.json     # shadcn/ui configuration
│       ├── tailwind.config.ts  # extends generated mshwarTheme
│       ├── tsconfig.json
│       └── next.config.ts
├── services/
│   └── api/                    # FastAPI backend
│       ├── db/                 # PostgreSQL Dockerfile
│       ├── app/
│       │   ├── main.py         # FastAPI application entry
│       │   ├── core/           # Config and dependencies
│       │   ├── api/v1/         # API version 1 endpoints
│       │   ├── models/         # SQLAlchemy models
│       │   ├── schemas/        # Pydantic schemas
│       │   └── dependencies/   # Shared dependencies
│       ├── alembic.ini         # Alembic configuration
│       ├── pyproject.toml      # Python dependencies
│       ├── requirements.txt
│       └── tests/              # Test suite
│           ├── test_main.py
│           ├── test_config.py
│           ├── test_extensions.py  # Extension smoke tests
│           └── conftest.py
├── mshwar-brand-foundation/    # Design tokens (JSON source of truth)
│   ├── design-tokens.json
│   ├── scripts/generate-tokens.mjs
│   └── generated/              # Tailwind theme, CSS vars, Figma exports
├── docs/                       # Documentation
│   └── database-provisioning.md  # Supabase vs self-hosted decision
├── packages/
│   └── shared/                 # Shared TypeScript types
├── tooling/                    # Shared tooling configs
├── .github/workflows/          # CI/CD pipelines
├── .husky/                     # Git hooks
├── docker-compose.yml          # Local development
├── .env.example                # Environment template
├── .eslintrc.js                # ESLint config
├── .prettierrc                 # Prettier config
├── .ruff.toml                  # Ruff config
├── mypy.ini                    # mypy config
├── .pre-commit-config.yaml     # Pre-commit hooks
├── pnpm-workspace.yaml         # pnpm workspace config
├── package.json                # Root package.json
└── README.md
```

## License

Internal use only — Mshwar Project Team

## Support

For issues, contact the Mshwar Project Team.
