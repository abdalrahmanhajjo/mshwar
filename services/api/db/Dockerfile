FROM postgres:17

RUN apt-get update && apt-get install -y --no-install-recommends postgis postgresql-17-postgis-3 && rm -rf /var/lib/apt/lists/*

# Enable extensions in template1 so all new databases inherit them
RUN psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS postgis;" && \
    psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS pgvector;" && \
    psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

ENV POSTGRES_DB=mshwar