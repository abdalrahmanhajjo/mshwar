# Real prices with proof

The trip planner prices a day only from prices somebody published. It never estimates one. The
sources are:

- **Owners** publish their own prices: price rules on their listings, a restaurant's typical spend
  per person, and a stay's price per night.
- **Staff** record the price of places without an owner on Mshwar, such as castles, grottoes,
  museums and reserves. The price is taken from the official source: the place's own ticket page,
  the ministry's list, or the ticket office. It is recorded with proof, as described below.

A place with neither shows **"Price on request"** and is never counted as free.

## Recording a price (staff)

Each price needs:

| Field                       | Rule                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `price_type`                | `fixed`, `from` or `range`. A published price of 0 is "free". There are no estimates. |
| `amount` / `max_amount`     | In the currency's main unit (e.g. `18.00`). `max_amount` is only for a range.         |
| `currency`, `unit`          | e.g. `USD`; `person` or `group`                                                       |
| `source_url`, `source_name` | The **https** page where the price is published, and who publishes it                 |
| `checked_on`                | When you checked it, within the last 60 days                                          |
| `review_by`                 | Optional; defaults to 180 days after the check and can be at most a year after it     |

There are two ways to record a price:

- **One at a time:** `PUT /api/v1/admin/prices/listings/{listing_id}`.
- **Many at once:** use a CSV file with these columns:

  ```
  slug,price_type,amount,max_amount,currency,unit,source_url,source_name,checked_on,review_by,note
  ```

  Then run:

  ```bash
  cd services/api
  DATABASE_URL=... python scripts/import_sourced_prices.py prices.csv --admin you@mshwar.example --dry-run
  DATABASE_URL=... python scripts/import_sourced_prices.py prices.csv --admin you@mshwar.example
  ```

  Every row goes through `app.admin_set_sourced_price`, with the same rules as the API. Rows with
  a problem are listed and skipped.

## What travellers see

Each price line in "What the day costs" names its source and the date it was checked, and links to
the page where it was published.

## Places with no published price

At `/admin/catalogue`, **Places with no published price** lists the listings the planner offers with
"price on request" today, most planned first (`GET /api/v1/admin/prices/worklist`). It shows how
often the planner put each one in a trip in the last 90 days, and the last source that lapsed, if
any. **Record its price** opens the form for that listing. Record a price only after you have
found it at its source; if it has no published price, leave it on request.

## Keeping prices true

- **After the review date,** a price stops applying and the place is "Price on request" again. An
  old price is never shown as today's.
- **Prices to check again:** `GET /api/v1/admin/prices/due?days=30` lists the prices whose review
  date falls in the next 30 days, or passed in the last 30.
- **A new price** ends the one that applied until then; it is not deleted, because bookings keep
  pointing at the price they used. Every change is audited.

## Why no prices were entered for you

Prices on aggregator sites are often years old. Some quote Lebanese pounds from before the currency
collapse, which no longer convert meaningfully into dollars. The official sites were not reachable
from the build environment, so no price was entered: each one needs a person to check it at the
source.
