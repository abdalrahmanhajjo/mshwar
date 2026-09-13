# Catalogue search and maps

Public catalogue reads come from PostgreSQL (`app.public_catalogue_*`). Unpublished, paused, archived, or inactive-organization rows never leave those functions.

## Embeddings

CI and local default use a deterministic stub:

- SQL: `app.stub_embedding(text)` (8-dim hash vector)
- Python: `app.catalogue.embeddings.stub_embedding`

Set `CATALOGUE_EMBEDDING_PROVIDER` to a real provider name when an API credential exists. The stub stays the fallback so search tests do not invent listings.

## Routing / travel time

Related cards show PostGIS distance plus `app.catalogue.routing.estimate_travel`. Set `CATALOGUE_ROUTING_PROVIDER` when a real router is wired. CI uses the stub.

## Maps

The experiences list/map toggle keeps the same filter query string (`view=map`). Markers are the current result set.

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to a **referrer-restricted** Google Maps key. When it is empty, the UI degrades to clustered pins (Beirut density) and the list remains usable at 390px.
