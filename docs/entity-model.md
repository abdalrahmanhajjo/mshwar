# Entity Model — Mshwar Platform

## Overview

Mshwar's database model consists of **22 tables** organized into five domains. Every table has a primary key, `created_at` and `updated_at` timestamps, and an owner/foreign key relationship where applicable.

---

## Domain: Identity (`migrations/001_identity.py`)

### `users`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | Auto-increment |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Primary identifier |
| `name` | VARCHAR(255) | | Display name |
| `language` | VARCHAR(10) | DEFAULT 'en' | UI language preference |
| `is_active` | BOOLEAN | DEFAULT true | Account status |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `business_members`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `business_id` | INTEGER | FK → businesses.id | |
| `user_id` | INTEGER | FK → users.id | |
| `role` | VARCHAR(50) | NOT NULL | owner, admin, staff |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Domain: Catalogue (`migrations/002_catalogue.py`)

### `businesses`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `name` | VARCHAR(255) | NOT NULL | |
| `category` | VARCHAR(100) | | For filtering |
| `location` | VARCHAR(255) | | City/area |
| `verified` | BOOLEAN | DEFAULT false | Admin-verified |
| `status` | VARCHAR(50) | DEFAULT 'active' | |
| `latitude` | FLOAT | | PostGIS geography |
| `longitude` | FLOAT | | PostGIS geography |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `categories`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe |
| `description` | TEXT | | |
| `icon` | VARCHAR(100) | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `experiences`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `business_id` | INTEGER | FK → businesses.id | |
| `category_id` | INTEGER | FK → categories.id | |
| `name` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | | |
| `duration_minutes` | INTEGER | | Estimated time |
| `price_type` | VARCHAR(50) | DEFAULT 'fixed' | fixed, range, per-person |
| `price_amount` | FLOAT | | |
| `price_currency` | VARCHAR(3) | DEFAULT 'LBP' | |
| `suitable_for_groups` | BOOLEAN | DEFAULT true | |
| `indoor_outdoor` | VARCHAR(20) | DEFAULT 'indoor' | |
| `verified` | BOOLEAN | DEFAULT false | |
| `status` | VARCHAR(50) | DEFAULT 'active' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `price_rules`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `experience_id` | INTEGER | FK → experiences.id | |
| `currency` | VARCHAR(3) | DEFAULT 'LBP' | |
| `price_type` | VARCHAR(50) | NOT NULL | |
| `amount` | FLOAT | | |
| `min_group_size` | INTEGER | | |
| `max_group_size` | INTEGER | | |
| `effective_from` | TIMESTAMPTZ | | |
| `effective_until` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `operating_hours`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `business_id` | INTEGER | FK → businesses.id | |
| `day_of_week` | INTEGER | NOT NULL | 0=Sunday |
| `open_time` | VARCHAR(5) | | HH:MM |
| `close_time` | VARCHAR(5) | | HH:MM |
| `is_closed` | BOOLEAN | DEFAULT false | |
| `exception_date` | DATE | | Non-recurring exception |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Domain: Availability (`migrations/003_availability.py`)

### `availability_slots`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `experience_id` | INTEGER | FK → experiences.id | |
| `date` | DATE | NOT NULL | |
| `start_time` | VARCHAR(5) | NOT NULL | HH:MM |
| `end_time` | VARCHAR(5) | NOT NULL | HH:MM |
| `capacity` | INTEGER | NOT NULL, CHECK >= 0 | |
| `available` | INTEGER | NOT NULL, CHECK <= capacity | |
| `source` | VARCHAR(50) | DEFAULT 'manual' | |
| `last_updated` | TIMESTAMPTZ | DEFAULT now() | |
| `status` | VARCHAR(20) | DEFAULT 'available' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** Unique on `(experience_id, date, start_time)`. Check `available <= capacity`.

---

## Domain: Booking & Payment (`migrations/004_booking_payment.py`)

### `trips`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `name` | VARCHAR(255) | NOT NULL | |
| `status` | VARCHAR(50) | DEFAULT 'draft' | draft, confirmed, completed |
| `user_id` | INTEGER | FK → users.id | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `bookings`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `business_id` | INTEGER | FK → businesses.id | |
| `trip_id` | INTEGER | FK → trips.id | Nullable for standalone bookings |
| `status` | VARCHAR(50) | DEFAULT 'pending' | draft, pending, confirmed, rejected, cancelled, completed, refunded |
| `price_snapshot` | TEXT | | Immutable at booking time |
| `policy_snapshot` | TEXT | | Immutable at booking time |
| `party_size` | INTEGER | | Number of guests |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** `status` must be in the allowed set.

### `payments`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `booking_id` | INTEGER | FK → bookings.id | |
| `provider` | VARCHAR(50) | DEFAULT 'stripe' | |
| `provider_payment_id` | VARCHAR(255) | | External reference |
| `amount` | FLOAT | NOT NULL | |
| `currency` | VARCHAR(3) | DEFAULT 'LBP' | |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending, succeeded, failed, refunded |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `refunds`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `booking_id` | INTEGER | FK → bookings.id | |
| `payment_id` | INTEGER | FK → payments.id | |
| `amount` | FLOAT | NOT NULL | |
| `currency` | VARCHAR(3) | DEFAULT 'LBP' | |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending, approved, rejected, completed, failed |
| `reason` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `reviews`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `user_id` | INTEGER | FK → users.id | |
| `business_id` | INTEGER | FK → businesses.id | |
| `experience_id` | INTEGER | FK → experiences.id | |
| `rating` | INTEGER | CHECK 1-5 | |
| `title` | VARCHAR(255) | | |
| `text` | TEXT | | |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending, approved, rejected |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `favorites`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `user_id` | INTEGER | FK → users.id | |
| `business_id` | INTEGER | FK → businesses.id | Nullable |
| `experience_id` | INTEGER | FK → experiences.id | Nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** Unique on `(user_id, business_id)` and `(user_id, experience_id)`.

### `group_participants`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `trip_id` | INTEGER | FK → trips.id | |
| `user_id` | INTEGER | FK → users.id | |
| `role` | VARCHAR(20) | DEFAULT 'member' | member, organizer, vote |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** Unique on `(trip_id, user_id)`.

### `votes`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `trip_id` | INTEGER | FK → trips.id | |
| `participant_id` | INTEGER | FK → group_participants.id | |
| `experience_id` | INTEGER | FK → experiences.id | |
| `category` | VARCHAR(100) | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Domain: AI & Ops (`migrations/005_ai_ops.py`)

### `knowledge_documents`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `title` | VARCHAR(255) | NOT NULL | |
| `content` | TEXT | NOT NULL | |
| `source_type` | VARCHAR(50) | NOT NULL | |
| `source_id` | VARCHAR(255) | NOT NULL | |
| `embedding_vector` | TEXT | | For pgvector |
| `business_id` | INTEGER | FK → businesses.id | |
| `verified` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

### `recommendation_events`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `trip_id` | INTEGER | FK → trips.id | |
| `user_id` | INTEGER | FK → users.id | |
| `model_version` | VARCHAR(50) | NOT NULL | |
| `candidate_ids` | TEXT | NOT NULL | JSON |
| `recommendation_order` | TEXT | NOT NULL | JSON |
| `ranking_scores` | TEXT | | JSON |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### `feedback_events`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `trip_id` | INTEGER | FK → trips.id | |
| `user_id` | INTEGER | FK → users.id | |
| `original_recommendation` | TEXT | | JSON |
| `user_modification` | TEXT | | JSON |
| `decision` | VARCHAR(20) | NOT NULL | saved, replaced, abandoned, booked |
| `outcome` | VARCHAR(20) | | confirmed, rejected, cancelled |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### `notifications`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `user_id` | INTEGER | FK → users.id | |
| `type` | VARCHAR(50) | NOT NULL | |
| `title` | VARCHAR(255) | NOT NULL | |
| `body` | TEXT | NOT NULL | |
| `is_read` | BOOLEAN | DEFAULT false | |
| `reference_type` | VARCHAR(50) | | |
| `reference_id` | VARCHAR(255) | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### `audit_logs`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | |
| `actor_type` | VARCHAR(20) | NOT NULL | user, business, admin |
| `actor_id` | INTEGER | | |
| `action` | VARCHAR(50) | NOT NULL | |
| `target_type` | VARCHAR(50) | NOT NULL | |
| `target_id` | INTEGER | | |
| `old_value` | TEXT | | JSON |
| `new_value` | TEXT | | JSON |
| `reason` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## Migration Order

```
000_create_extensions → 001_identity → 002_catalogue → 003_availability → 004_booking_payment → 005_ai_ops
```

Each migration depends on the previous one. `alembic upgrade head` succeeds from an empty database. `alembic downgrade base` reverses all migrations in reverse order.

All migrations are re-runnable and use `CREATE TABLE IF NOT EXISTS` / `DROP TABLE` patterns where appropriate.

---

## ERD Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│    users    │─────│  business_members │     │  categories   │
│  (id,email) │     │ (business_id,user │     │ (id,name,slug)│
│             │     │  _id,role)        │     └──────┬───────┘
└──────┬──────┘     └──────────────────┘            │
       │                                            │
       │ 1:N                                        │ 1:N
       ▼                                            ▼
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  businesses │─────│   experiences    │─────│  price_rules  │
│  (id,name)  │     │ (business_id,cat │     │ (experience_  │
│             │     │  _id,name,...)   │     │  id,...)      │
└──────┬──────┘     └────────┬─────────┘     └──────────────┘
       │                    │
       │ 1:N                │ 1:N
       ▼                    ▼
┌──────────────┐  ┌──────────────────┐
│   trips      │  │  availability_slots│
│ (id,name,st  │  │ (experience_id,d │
│  user_id)    │  │  ate,start,end)   │
└──────┬───────┘  └──────────────────┘
       │
       │ 1:N (via group_participants)
       ▼
┌──────────────────┐     ┌──────────────────┐
│ group_participants│─────│     votes         │
│ (trip_id,user_id) │     │ (trip_id,partic │
│                  │     │  ipant_id,...)    │
└──────────────────┘     └──────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   bookings   │   │  payments        │   │  refunds         │
│ (business_id,│   │ (booking_id,prov │   │ (booking_id,pay  │
│  trip_id,...)│   │  id,amount,...)  │   │  _id,amount,...) │
└──────┬───────┘   └──────────────────┘   └──────────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│    reviews   │
│ (user_id,bus │
│  iness_id,...)│
└──────────────┘
       │
       │ 1:N (favorites)
       ▼
┌──────────────┐
│  favorites   │
│ (user_id,bus │
│  iness_id)   │
└──────────────┘
       │
       │ 1:N (recommendation/feedback events)
       ▼
┌────────────────────┐
│ recommendation_evts │
│ feedback_events     │
└────────────────────┘
       │
       │ 1:N (notifications, audit_logs)
       ▼
┌────────────────────┐  ┌────────────────────┐
│  notifications      │  │  audit_logs        │
│ (user_id,...)       │  │ (actor_type,...)   │
└────────────────────┘  └────────────────────┘
       │
       │ 1:N (knowledge_documents)
       ▼
┌────────────────────┐
│ knowledge_documents │
│ (business_id,...)   │
└────────────────────┘
```

## Extension Dependencies

| Extension | Purpose | Migration |
|---|---|---|
| `postgis` | `ST_DWithin`, `ST_MakePoint`, geospatial queries | 000 |
| `pgvector` | Vector similarity (`<->` operator) for RAG | 000 |
| `btree_gist` | EXCLUDE constraint for slot booking overlap prevention | 000 |
