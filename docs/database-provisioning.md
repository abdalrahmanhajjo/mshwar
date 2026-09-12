# Database Provisioning Decision: Supabase vs Self-Hosted PostgreSQL

## Overview

Mshwar requires PostgreSQL 17 with three extensions enabled: **PostGIS** (geospatial queries for distance/routing), **pgvector** (vector similarity for RAG embeddings), and **btree_gist** (exclusion constraints for slot booking). This document evaluates the two viable hosting approaches.

---

## Supabase (Managed)

### What it provides
- PostgreSQL 16+ (PostGIS and pgvector included via dashboard UI)
- Built-in authentication, row-level security (RLS)
- Edge functions, storage, real-time subscriptions
- Automatic migrations via dashboard or CLI
- Free tier available for development

### Limitations for Mshwar
- **PostGIS**: Available but requires manual enabling per database via Supabase SQL Editor
- **pgvector**: Available in Supabase v2, but version may lag behind latest releases
- **btree_gist**: Not available on Supabase (not in their extension allowlist)
- **Statement timeouts**: Configurable via dashboard but less granular than self-hosted
- **Connection pooling**: Uses Supabase's built-in pooler (PgBouncer) — cannot configure `pool_pre_ping`, `pool_recycle` at the driver level
- **Extension constraints**: Cannot create custom extensions or use `CREATE EXTENSION` for arbitrary extensions
- **Production cost**: Scales with usage; can become expensive at high query volumes

### Verdict for Mshwar
**Not recommended** for production. The missing `btree_gist` extension blocks the slot booking exclusion constraints required by the BRD. The managed pooler also prevents fine-grained control over connection settings.

---

## Self-Hosted PostgreSQL 17

### What it provides
- Full control over PostgreSQL version and extensions
- All three extensions (`postgis`, `pgvector`, `btree_gist`) available via `CREATE EXTENSION`
- Granular configuration: `shared_preload_libraries`, `statement_timeout`, `idle_in_transaction_session_timeout`
- Custom connection pooling via SQLAlchemy engine settings
- Docker-based local development mirrors production
- Can be deployed on VPS, cloud VMs, or managed infra with full control

### Trade-offs
- **Operational overhead**: Requires DB administration (backups, monitoring, failover)
- **Scaling**: Manual scaling vs managed auto-scaling
- **Cost**: Fixed VPS cost vs variable managed pricing
- **Availability**: Must configure replication and failover for high availability

### Recommended Architecture

```
Local Dev:       docker compose up --build  (Postgres 17 + PostGIS + pgvector + btree_gist)
Staging:         Managed PostgreSQL 17 VPS (e.g., DigitalOcean, Hetzner, AWS RDS)
Production:      Self-hosted or managed PostgreSQL 17 with all three extensions enabled
```

---

## Extension Details

| Extension | Purpose | Usage in Mshwar |
|---|---|---|
| `postgis` | Geospatial data types and functions | `ST_DWithin`, `ST_MakePoint`, distance calculations between venues, map radius queries |
| `pgvector` | Vector similarity search | RAG embeddings for business descriptions, semantic search over experiences |
| `btree_gist` | GiST indexes on btree types | EXCLUDE constraints preventing overlapping booking slots for the same business |

---

## Migration Strategy

Extension creation is handled via Alembic migration `000_create_extensions` — never manual. The migration runs automatically via `alembic upgrade head` during deployment.

```bash
# Apply all migrations including extensions
cd services/api && alembic upgrade head
```

The Dockerfile for the `db` service pre-creates extensions in `template1` so all new databases inherit them automatically.

---

## Decision

**Self-hosted PostgreSQL 17 is the baseline.** Supabase is acceptable for development prototyping but cannot support the full feature set required by BRD Section 12 (Business Rules) — specifically the `btree_gist` EXCLUDE constraint for preventing double-booking of time slots.
