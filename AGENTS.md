# Mshwar - Project Agent Notes

## Architecture

Monorepo with two main applications:

- **apps/web**: Next.js 16 frontend with TypeScript, Tailwind CSS v4, shadcn/ui components
- **services/api**: FastAPI backend with SQLAlchemy 2.x, Pydantic v2, Alembic migrations

## Technology Choices (from BRD S23)

- **Database**: PostgreSQL + PostGIS + pgvector (not MongoDB)
- **AI**: LLM + RAG for language, structured DB retrieval for facts, OR-Tools for hard constraints
- **Maps**: Google Maps Platform
- **Weather**: Open-Meteo (prototype), commercial/self-hosted for production
- **Payments**: Stripe test mode + abstracted provider interface
- **Images**: ImageKit
- **Monitoring**: Sentry + PostHog

## Key Constraints

1. **Lebanon Stripe constraint**: Lebanon is not on Stripe's global availability page. Production payment provider must be abstracted and a legal acquirer selected.
2. **Python 3.9**: Base version constraint for compatibility. Use `Optional[X]` instead of `X | None` for runtime compatibility.
3. **`from __future__ import annotations`**: Required in all Python files using `|` type syntax for Python 3.9 compatibility.
4. **Structured facts over LLM**: AI must never invent businesses, prices, availability, or payment outcomes.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run both services via Docker
docker compose up --build

# Run individually
pnpm --filter web dev    # Frontend on :3000
pnpm --filter api dev     # Backend on :8000

# Code quality
pnpm run lint            # ESLint for both
pnpm run format          # Prettier for all
pnpm run typecheck       # TypeScript + mypy

# Python-specific
cd services/api && ruff check . && ruff format . && mypy app/

# Database migrations
cd services/api && alembic revision --autogenerate -m "msg" && alembic upgrade head
```

## Ports

| Service | Port |
|---|---|
| Web (Next.js) | 3000 |
| API (FastAPI) | 8000 |
| API Docs | 8000/docs |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Testing

- Frontend: `pnpm --filter web test`
- Backend: `PYTHONPATH=services/api python3 -m pytest services/api/tests/`
- Python lint: `cd services/api && ruff check . && ruff format .`
- Python types: `cd services/api && mypy app/`

## Important Files

- `.env.example` - Environment variable template
- `docker-compose.yml` - Local development orchestration
- `.pre-commit-config.yaml` - Git hooks configuration
- `.commitlintrc.json` - Conventional commits rules
- `apps/web/components.json` - shadcn/ui configuration
- `services/api/pyproject.toml` - Python project config
- `services/api/alembic.ini` - Alembic configuration
