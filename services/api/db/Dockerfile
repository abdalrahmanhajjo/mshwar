FROM postgres:17-alpine

RUN apk add --no-cache postgresql-postgis postgresql-contrib

# Enable extensions in template1 so all new databases inherit them
RUN psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS postgis;" && \
    psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS pgvector;" && \
    psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

ENV POSTGRES_DB=mshwar
