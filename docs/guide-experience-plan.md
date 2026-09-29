# Mshwar for guides: the complete plan

**Status:** proposal for approval · **Owner:** Abdalrahman Hajjo · **Scope:** web (Next.js), API (FastAPI),
database (PostgreSQL migrations), operations.

> **In one line:** Mshwar becomes the easiest place in Lebanon for a licensed guide or local host to
> fill their calendar and grow a business. The AI planner sends them travellers who already know what
> they want, the scheduling tools run their week, and every booking, review and payment is real.

---

## Contents

1. [Why guides will choose Mshwar](#1-why-guides-will-choose-mshwar)
2. [How guides make money](#2-how-guides-make-money)
3. [Mshwar's business model and fees](#3-mshwars-business-model-and-fees)
4. [What exists today](#4-what-exists-today)
5. [Benchmark against the best platforms](#5-benchmark-against-the-best-platforms)
6. [The guide journey, start to finish](#6-the-guide-journey-start-to-finish)
7. [The traveller journey](#7-the-traveller-journey)
8. [Scheduling engine](#8-scheduling-engine)
9. [Pricing and revenue tools](#9-pricing-and-revenue-tools)
10. [Booking lifecycle and policies](#10-booking-lifecycle-and-policies)
11. [Payments and payouts roadmap](#11-payments-and-payouts-roadmap)
12. [Demand engine: how Mshwar brings guides customers](#12-demand-engine-how-mshwar-brings-guides-customers)
13. [Guide workspace](#13-guide-workspace)
14. [Messaging and notifications](#14-messaging-and-notifications)
15. [Quality, levels and ranking](#15-quality-levels-and-ranking)
16. [Trust, safety and support](#16-trust-safety-and-support)
17. [Data model](#17-data-model)
18. [API](#18-api)
19. [Screens](#19-screens)
20. [Delivery plan and timeline](#20-delivery-plan-and-timeline)
21. [Launch plan: the first 30 guides](#21-launch-plan-the-first-30-guides)
22. [Metrics](#22-metrics)
23. [Risks and how we handle them](#23-risks-and-how-we-handle-them)
24. [Principles that never change](#24-principles-that-never-change)

---

## 1. Why guides will choose Mshwar

A guide in Lebanon today finds customers through WhatsApp groups, Instagram, hotel front desks and word
of mouth, and runs the calendar in their head. International marketplaces have few Lebanese tours and take a
large cut. Mshwar is built for Lebanon, and for the guide.

| What guides get                                                                                                                       | Why it matters to them                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Customers who already want a guide.** Every AI plan on Mshwar can add "a guide for this day", matched by region, language and date. | Leads arrive with a date, a group size and an itinerary, not "how much?" in a DM. |
| **Zero cost to start.** Free listing, free tools, and **0% fee for Founding Guides** (section 3).                                     | No risk in trying.                                                                |
| **A professional storefront.** Profile, tour pages in three languages, real reviews, verified badge, Google-ready pages.              | Look as credible as any international operator.                                   |
| **Your calendar, run for you.** Schedules, capacity, buffers, blocked days, Google Calendar sync, no double bookings.                 | Less admin, fewer mistakes, more tours.                                           |
| **Every way to earn in one place.** Shared tours, private tours, hired days, custom trips, add-ons, groups.                           | Fill weekdays and quiet seasons, not just summer weekends.                        |
| **Arabic, English and French.** Right-to-left Arabic throughout, Arabizi understood by the planner.                                   | Reach the diaspora and foreign visitors alike.                                    |
| **Fair and transparent.** Standard cancellation policies, blind two-way reviews, ranking you can understand.                          | Protection from no-shows and unfair reviews.                                      |
| **Paid your way.** Today: paid by the guest on the day. Later: online deposits and weekly payouts (section 11).                       | Works with how Lebanon pays now.                                                  |

**Our promise to guides (shown on the "Earn with Mshwar" page):**

> Your tours, your prices, your calendar. We bring the travellers, handle the admin, and never list a
> fake review or a fake price next to your name.

## 2. How guides make money

### 2.1 Eight ways to earn

| #   | Product                                      | Who books it                   | How it's priced              | Built on                         |
| --- | -------------------------------------------- | ------------------------------ | ---------------------------- | -------------------------------- |
| 1   | **Shared tour** (join a group)               | Solo travellers, couples       | Per person, with child price | Tours + slots (exists)           |
| 2   | **Private tour**                             | Families, friends, couples     | Per group, with size tiers   | New: private schedules           |
| 3   | **Hired day** from an AI plan                | Planner users                  | Day rate (exists) + options  | Engagements (exists)             |
| 4   | **Custom trip** ("design my day")            | Travellers with special wishes | Guide's quote                | Engagement proposals (exists)    |
| 5   | **Multi-day trip**                           | Diaspora, tour groups          | Per day or package           | Planner multi-day trips (exists) |
| 6   | **Add-ons**                                  | Any booking                    | Fixed price each             | New: add-ons                     |
| 7   | **Groups**: schools, companies, associations | Organisers                     | Group rate, quote            | New: group requests              |
| 8   | **Local host walks** (free)                  | Anyone                         | Free, tips welcome           | Host tier (exists)               |

**Add-on ideas:**

- hotel pickup and drop-off (with a licensed driver from Mshwar Rides)
- food tasting stop
- entrance tickets arranged
- photographer
- extra hour
- equipment such as hiking poles

Add-ons are real items the guide sells, with a published price.

### 2.2 What a week can look like (illustrative)

These are **planning examples, not promises**; real earnings depend on season, prices and reviews.
The earnings calculator on the "Earn with Mshwar" page uses the guide's own numbers.

| Guide profile                                | Weekly mix                                                   | Illustrative week                              |
| -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| **Weekend city guide** (Byblos)              | 2 shared walks × 6 guests × $25 + 1 private tour $120        | $300 + $120 = **$420**                         |
| **Full-time mountain guide** (Qadisha)       | 3 shared hikes × 8 × $35 + 2 hired days × $150 + add-ons $60 | $840 + $300 + $60 = **$1,200**                 |
| **Diaspora-season specialist** (July–August) | 4 private family days × $180 + 1 multi-day (3 days × $160)   | $720 + $480 = **$1,200**                       |
| **Local host** (free walks)                  | 3 walks, tips only                                           | Tips, plus a path to becoming a licensed guide |

The calculator (section 13.6) lets a guide enter their prices and how many tours they want per week.
It then shows the **same formula** the dashboard later uses on real bookings.

### 2.3 Earning more over time

- **Levels** (section 15): Trusted and Top guides rank higher and get the "Top guide" badge.
- **Repeat guests and referrals.** "Book again with Rami" appears in the traveller's trips, and each
  guide gets a personal share link with a QR code for business cards, Instagram and hotel desks.
- **Seasonal pricing and demand alerts**, e.g. "Diaspora bookings to Batroun are up for August:
  open more Saturday slots?" Alerts are based on real search and booking counts only.
- **Smart price suggestion**, e.g. "3-hour walks in Byblos are usually $20–30." This uses the real
  median of published prices in the region, and is shown only when there are at least 5 comparable tours.

## 3. Mshwar's business model and fees

Fees must be simple, visible to guides before they list, and never hidden from travellers.

| Stage                                                          | Guide fee                                          | Traveller fee                              | Why                                                          |
| -------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| **Founding Guides** (first 50 approved guides, first 6 months) | **0%**                                             | 0%                                         | Build supply and reviews; guides take no risk                |
| **Launch** (pay on the day, no online payment)                 | 0%, plus optional **Featured** placement           | 0%                                         | Mshwar can't collect a commission on money it doesn't handle |
| **With online payments** (licensed partner live)               | **12% of the booking**, lower for Top guides (10%) | Small service fee (≤ 5%) shown at checkout | Pays for payments, support and marketing                     |

- **For comparison:** large international marketplaces commonly take **20–30%** from operators
  (check current published terms before quoting a number to guides). Mshwar stays clearly lower.
- **Featured placement** (optional, later) must always carry a "Sponsored" label. It never outranks a
  guide by more than one position on quality, and it's never shown to travellers as a review or rating.
- **Transparency rule:** every booking shows the guide exactly what the traveller paid, the fee, and
  what the guide receives.

## 4. What exists today

Migrations 033–038 (the "G1–G6 supply-side pivot") already give Mshwar a stronger base than most
marketplaces have at launch:

| Area                | Built today                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity**        | Application, documents, admin verification, tiers (**licensed guide** can charge, **local host** can't), badge that lapses with the licence, public profile, solo organisation per guide |
| **Tours**           | Tours built from real catalogue places (route), languages, meeting point, included and bring lists, cancellation terms, publish/unpublish                                                |
| **Scheduling**      | One weekly pattern per guide, minimum notice, maximum tours a day, blocked dates, slots generated up to 90 days ahead                                                                    |
| **Booking**         | Request to book (guide accepts or declines), paid on the day, idempotent requests, capacity checks                                                                                       |
| **Hired days**      | Traveller hires a licensed guide for a planned day, **day rate** and **max group** on the profile; guide accepts, declines or **proposes changes as a diff**                             |
| **Running the day** | Day sheet (stops, times, legs, group, phones once confirmed, dietary, access and children notes), start and complete                                                                     |
| **Reviews**         | **Blind two-way reviews**, 14-day window, public guide reviews                                                                                                                           |
| **Trust**           | Versioned guide agreement, suspension that closes future days, problem reports into support cases (safety escalated), admin funnel                                                       |

**What's missing** is everything that makes it feel like a modern booking platform and a business tool:

- a tours marketplace and tour pages
- real calendar booking
- per-tour schedules and pricing
- instant booking
- messaging
- my bookings and reminders
- a guide calendar and dashboard
- earnings reports
- levels and ranking
- online payments, later

## 5. Benchmark against the best platforms

| Capability                                                 | GetYourGuide / Viator | Airbnb Experiences | ToursByLocals | Withlocals | **Mshwar target**                           |
| ---------------------------------------------------------- | --------------------- | ------------------ | ------------- | ---------- | ------------------------------------------- |
| Tours marketplace with filters and map                     | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 1                                   |
| Tour page: gallery, itinerary, meeting point, FAQ, reviews | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 1, **plus itinerary on a real map** |
| Availability calendar with seats left                      | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 2                                   |
| Private and shared, child and group pricing                | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 2                                   |
| Instant confirmation                                       | ✓                     | ✓                  | partial       | ✓          | ✓ per tour                                  |
| Messaging                                                  | –                     | ✓                  | ✓             | ✓          | ✓ Phase 3                                   |
| Custom / private requests                                  | –                     | –                  | ✓             | ✓          | ✓, **plus hire for an AI-planned day**      |
| Reminders and add to calendar                              | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 3                                   |
| Operator calendar and sync                                 | Operator tools        | ✓                  | ✓             | ✓          | ✓ Phase 2/4                                 |
| Earnings dashboard and statements                          | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 4                                   |
| Quality levels and ranking                                 | ✓                     | ✓                  | ✓             | ✓          | ✓ Phase 5                                   |
| **AI day planner that sends guides leads**                 | –                     | –                  | –             | –          | **✓ unique to Mshwar**                      |
| **Arabic + Arabizi, Lebanon-first**                        | partial               | partial            | –             | –          | **✓ unique to Mshwar**                      |
| **Verified licence badge that lapses automatically**       | –                     | –                  | –             | –          | **✓ unique to Mshwar**                      |

## 6. The guide journey, start to finish

### 6.1 Discover → apply (target: 15 minutes)

1. **"Earn with Mshwar" landing page** (`/guides/join`), linked from the footer, the guides directory
   and the partners page. It has:
   - the promise
   - the eight ways to earn
   - the earnings calculator
   - the fee table
   - how it works in 4 steps
   - FAQ
   - "Apply in 15 minutes"
2. **Application wizard** (exists; improved). Each step saves, and a progress bar shows the steps:
   1. **You:** name, photo, headline, bio, languages, regions, specialities, years guiding
   2. **Tier:** licensed guide (licence number, expiry, upload) or local host
   3. **Documents:** ID and licence, with a checklist and clear photo tips
   4. **Agreement:** the guide agreement and code of conduct (versioned, exists)
   5. **Submit:** "We review within 2 working days", with a notification on decision (exists)

### 6.2 Approved → first tour live (target: 30 minutes)

A **launch checklist** on the guide home page, each item with a tick:

| Step                                                | Why                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add a profile photo and cover                       | Profiles with photos convert far better                                                                                                          |
| Create your first tour (start from a template)      | Templates: _Byblos old souk walk_, _Batroun sunset & lemonade_, _Qadisha valley hike_, _Beirut food walk_, _Baalbek temples_, _Tyre sea & ruins_ |
| Add 5+ photos, highlights, meeting point on the map | The publish checklist requires the minimum                                                                                                       |
| Set a schedule and price                            | The smart price suggestion helps                                                                                                                 |
| Choose instant booking or request                   | Instant ranks higher (clearly explained)                                                                                                         |
| Set hire terms (licensed only)                      | Get hired for AI-planned days                                                                                                                    |
| Connect Google Calendar (optional)                  | Never double-booked                                                                                                                              |
| Share your page link / QR                           | First bookings often come from your own network                                                                                                  |

### 6.3 Every week

- **Home:**
  - today's and tomorrow's runs
  - requests waiting, each with a reply countdown
  - unread messages
  - this week's confirmed earnings
  - one suggestion (e.g. "Open Saturday 10:00, demand is high")
- **Calendar:** see and block time, move a slot, close a day.
- **Requests:** accept, decline with a reason, or suggest another time, each in one tap.
- **After each run:** check in guests, mark complete, record payment received, and review the travellers.

### 6.4 Growing

- A monthly statement and performance email: views, requests, conversion, rating, and one tip.
- Level progress: "3 more completed tours to become Trusted."
- Guide Academy: short guides on photos, titles, pricing, reviews and safety, in three languages.

## 7. The traveller journey

1. **Find:**
   - "Find a guide" in the header (done)
   - `/tours` with filters
   - destination pages ("Guided tours in Batroun")
   - things-to-do pages
   - the AI planner's "Add a guide for this day"
2. **Choose:** the tour page, with:
   - photos
   - the itinerary as numbered stops on the map
   - highlights
   - what's included and what to bring
   - accessibility
   - meeting point map
   - languages
   - cancellation deadline in plain words
   - reviews with sub-ratings
   - "About your guide" (level, response time, tours given, verified badges)
3. **Book:**
   1. a calendar of available days with "from $X"
   2. times with seats left
   3. adults and children
   4. private or shared
   5. language
   6. add-ons
   7. pickup
   8. questions for the guide (dietary, access, children)
   9. review screen with the total and the policy
   10. instant confirmation, or a request answered within 24 h
4. **Before:**
   - a booking page with a code
   - add to calendar
   - messaging
   - reminders with weather at 24 h and 2 h
   - the guide's phone and WhatsApp once confirmed
5. **On the day:** "Navigate to meeting point" (Google Maps / Waze). An "I'm here" button tells the guide.
6. **After:**
   - a review prompt (blind, two-way)
   - "Book again", "Tip your guide" (once payments exist) and "Share"

## 8. Scheduling engine

The heart of the plan. All rules live in PostgreSQL so no path — web, API, a job or a future app — can
break them.

### 8.1 Concepts

| Concept         | Meaning                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Schedule**    | A recurring rule for one tour: which weekdays, which start times, a date range (season), capacity, private or shared |
| **Slot**        | One bookable start time of one tour, generated from schedules up to 120 days ahead                                   |
| **Busy block**  | Time the guide can't work: a manual block, a hired day, an imported calendar event, or another tour's booked slot    |
| **Guide rules** | Minimum notice, cut-off time, maximum tours a day, **buffer** between runs, **travel-aware buffer**                  |

### 8.2 Rules

1. **One guide, one place.** When a slot gets its first booking, every other slot of that guide that
   overlaps it closes, including the buffer and the drive between the two meeting points (OSRM travel
   time, cached). The same applies to hired days.
2. **Shared vs private.**
   - A shared slot stays open until its capacity is full.
   - A private slot closes on its first booking.
   - A tour offering both closes its shared seats once a private booking takes the time.
3. **Minimum group.** A shared slot can require, for example, 2 guests to run. If it isn't met by a
   deadline the guide sets (e.g. 24 h before), it auto-cancels with a notification and offers of
   another time. It's never silently dropped.
4. **Cut-off time.** E.g. "Bookings for tomorrow close at 18:00." This is separate from minimum notice.
5. **Maximum tours a day** (exists). This counts runs and hired days together.
6. **Seasons.** Schedules can have date ranges (summer / winter) and prices by season.
7. **Holidays.** Lebanese public holidays are shown on the guide calendar, and guides choose per holiday
   whether to run.
8. **Weather.** For outdoor tours, the guide gets an Open-Meteo alert 48 h ahead when rain or heat
   passes their threshold, with one tap to reschedule or cancel. Cancelling for weather is free for the traveller.
9. **Concurrency.** Two travellers booking the last seat at the same moment: one wins and one is told
   immediately. This is handled with the same locking approach as the existing last-seat race test
   (`mshwar-database/tests/concurrency.py`).

### 8.3 Calendar sync

- **Export:** a private iCal feed per guide (token in the URL, can be regenerated). It contains every
  confirmed run and hired day, with guest count and meeting point.
- **Import:** the guide adds one or more external busy calendars by iCal URL (e.g. their Google Calendar
  secret address). A job reads them every 15 minutes and creates busy blocks, which close clashing slots.
  Private event details are never stored, only busy time.

### 8.4 Slot generation

- The job runs nightly and on every schedule change, filling 120 days ahead.
- It never deletes a slot with a booking. Changing a schedule only affects future empty slots; booked
  ones need an explicit move or cancel with notice to guests.

## 9. Pricing and revenue tools

| Tool                         | Detail                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per person**               | Adult price, optional child price (with age range), optional infant free                                                                                  |
| **Group tiers**              | E.g. 1–2: $30 pp, 3–6: $25 pp, 7–12: $20 pp; or a private flat price per group size band                                                                  |
| **Seasonal prices**          | A different price in a date range (e.g. July–August)                                                                                                      |
| **Early bird / last minute** | Optional % off when booked X days ahead, or on a slot starting within 48 h with empty seats. Shown as the real published price, never a fake "was" price. |
| **Add-ons**                  | Fixed-price extras (pickup, tasting, tickets, photographer, extra hour)                                                                                   |
| **Hired day rate**           | Exists; add a half-day rate and an extra-hour rate                                                                                                        |
| **Smart price suggestion**   | Median and range of real published prices for similar tours (region, duration, type), shown only with ≥ 5 comparables                                     |
| **Host tier**                | Free only, enforced by the database (exists)                                                                                                              |

## 10. Booking lifecycle and policies

### 10.1 States

```
requested ──accept──▶ confirmed ──start──▶ in_progress ──complete──▶ completed ──▶ reviewed
    │                    │  │
    │ decline / expire   │  └── cancelled_by_traveller (policy decides refund)
    ▼                    ├───── cancelled_by_guide (always full refund; counts against the guide)
 declined                ├───── cancelled_weather  (free for the traveller)
                         └───── no_show            (guide marks; traveller notified)
```

- **Instant booking** goes straight to `confirmed`.
- **Requests expire after 24 h** by default (a guide can set 12–48 h). Expiry declines automatically,
  tells the traveller, and shows 3 similar tours.
- **Reschedule:** a traveller or guide proposes a new slot, and the other side accepts. The booking
  moves; it isn't cancelled and rebooked.

### 10.2 Cancellation policies (the guide picks one per tour)

| Policy       | Free cancellation until | After that |
| ------------ | ----------------------- | ---------- |
| **Flexible** | 24 hours before         | No refund  |
| **Moderate** | 3 days before           | 50%        |
| **Strict**   | 7 days before           | No refund  |

- With pay-on-the-day, the refund part applies only once online payment exists. Until then the policy
  sets expectations and a traveller's late-cancellation record, which guides can see as part of their
  reputation (exists).
- **Guide cancellations** are rare, public in the guide's stats, and affect ranking.

## 11. Payments and payouts roadmap

Stripe doesn't serve Lebanon (see AGENTS.md). Payments stay behind the existing provider layer so a
licensed local partner can be plugged in.

| Stage              | How money moves                                                                                            | What Mshwar builds                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Now**         | Guest pays the guide on the day (cash USD, or the guide's own wallet such as Whish or OMT)                 | "Paid on the day" clearly shown; guide marks **payment received**; receipts in the dashboard; earnings reports from recorded payments |
| **B. Deposits**    | Guest pays a deposit online (e.g. 20%) through a **licensed Lebanese acquirer or wallet**; rest on the day | Deposit at booking; refunds by policy; fee taken from the deposit                                                                     |
| **C. Full online** | Guest pays in full online; Mshwar pays guides **weekly**                                                   | Payout accounts, weekly payout run, statements, invoices, tax fields                                                                  |

**Tips:** in stage A tips are cash. In stages B and C there's "Tip your guide" after the tour, and 100%
goes to the guide.

## 12. Demand engine: how Mshwar brings guides customers

1. **AI planner hand-off.** Every generated day shows "Want a local guide for this day?" with up to 3
   matched guides (region, language, date free, group size). This already works through
   `match_guides_for_version`; the plan makes it prominent and measures it.
2. **SEO:**
   - tour and guide pages with `TouristTrip` / `Person` structured data (ratings only from real reviews)
   - "Guided tours in {destination}" sections on destination pages
   - things-to-do pages linking to tours
   - the sitemap
3. **Guide share kit:** a personal link, a QR code PDF for business cards, Instagram story templates,
   and the "Find us on Mshwar" badge (exists).
4. **Seasonal campaigns:** diaspora summer, Christmas, Easter, and spring hiking, featuring guides by
   region with real reviews.
5. **Partners:** hotels and guesthouses get a "Book a local guide" page for their guests (a referral link).
6. **Emails:** "Your trip to Byblos is in 5 days. Add a guide?" goes only to travellers who opted in.

## 13. Guide workspace

### 13.1 Home

- today and tomorrow
- requests waiting, with countdowns
- messages
- earnings this week and month
- level progress
- one tip
- the launch checklist, until it's complete

### 13.2 Calendar

- day, week and month views
- colours: open, partly booked, full, private, blocked, hired day, external busy
- drag to block, click to see the manifest, move a slot
- holiday markers and weather icons

### 13.3 Tours

- a builder with live preview and a publish checklist
- templates
- photos
- schedules, pricing tiers, add-ons, policy
- instant booking or request
- duplicate a tour

### 13.4 Requests and bookings

- inbox with SLA timers
- accept, decline or suggest a time
- filter by tour and date
- booking detail with the guest's notes and history

### 13.5 Day sheet (exists; upgraded)

- **check-in** (arrived, no-show)
- message the group
- "Running 10 min late" with one tap
- mark payment received
- start, complete, SOS

### 13.6 Earnings and insights

- **statement** by month: bookings, gross, fees (0% for founding guides), net, recorded as paid
- **upcoming confirmed earnings**
- per tour: views → requests → confirmed (conversion), occupancy, rating
- response rate and time
- CSV export
- **earnings calculator** (the same formula as the landing page)

### 13.7 Profile and settings

- profile, languages, regions, specialities, hire terms
- payout details (stage B/C)
- notifications
- calendar sync
- team (section 13.8)

### 13.8 Teams (later)

A guiding company or family business can add several guides to one organisation. The owner assigns
guides to slots, and each guide sees their own day sheets. This reuses organisations and memberships,
which already exist.

## 14. Messaging and notifications

### 14.1 Messaging

- One conversation per traveller and guide (optionally tied to a booking).
- Text, quick replies, and templates for guides ("Meeting point: …", "What to bring: …").
- **Contact details are masked until a booking is confirmed.** Phone numbers, emails and links are
  replaced with "shared after booking".
- Report and block; messages from reported conversations go to the support queue.
- Response time is measured here and shown on the guide profile.
- At first, refresh on open and every 30 s; real-time later.

### 14.2 Notification matrix

| Event                        | Traveller                           | Guide                                  | Channel                  |
| ---------------------------- | ----------------------------------- | -------------------------------------- | ------------------------ |
| Request sent                 | "Request sent: reply within 24 h"   | "New request: reply by 14:00 tomorrow" | In-app + email           |
| Request 4 h before expiry    | –                                   | Reminder                               | In-app + email           |
| Accepted / instant confirmed | Booking confirmed + add to calendar | Booking confirmed                      | In-app + email           |
| Declined / expired           | With 3 similar tours                | –                                      | In-app + email           |
| New message                  | ✓                                   | ✓                                      | In-app + email (batched) |
| 48 h weather alert (outdoor) | –                                   | Alert + reschedule option              | In-app + email           |
| 24 h before                  | Reminder + weather + bring list     | Tomorrow's manifest                    | Email + in-app           |
| 2 h before                   | Meeting point + navigate            | –                                      | In-app                   |
| Minimum group not met        | Cancelled + other times             | Cancelled                              | In-app + email           |
| Completed                    | Review prompt                       | Review prompt                          | In-app + email           |
| Review released              | ✓                                   | ✓                                      | In-app                   |
| Level reached                | –                                   | "You're a Trusted guide"               | In-app + email           |

Email goes through Brevo, which is already set up. All texts are in EN, AR and FR.

## 15. Quality, levels and ranking

### 15.1 Levels (thresholds are public)

| Level         | Requirements (rolling 12 months)                                                                   | Benefits                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **New**       | Approved                                                                                           | Listed                                                              |
| **Trusted**   | ≥ 5 completed runs, rating ≥ 4.6, ≥ 90% of requests answered within 24 h, ≤ 5% guide cancellations | Badge, ranking boost                                                |
| **Top guide** | ≥ 25 completed runs, rating ≥ 4.8, median response < 2 h, ≤ 2% guide cancellations                 | Badge, top of "Recommended", lower fee (10%), featured in campaigns |

Levels are recalculated nightly. A guide who drops below a threshold keeps the level for 30 days and
is told what to fix.

### 15.2 Ranking score (for "Recommended")

```
score = 0.35 · review_score        (Bayesian average, so 2 reviews of 5★ don't beat 80 reviews of 4.9★)
      + 0.20 · response_score      (answered within 24 h, median response time)
      + 0.15 · reliability_score   (1 − guide cancellation rate)
      + 0.10 · conversion_score    (requests → confirmed, smoothed)
      + 0.10 · completeness_score  (photos, languages, meeting point, schedule coverage)
      + 0.10 · freshness_score     (recent completed runs)
```

- Filters (date, language, region) are applied first, and the score sorts what's left.
- New guides get a small **new-guide boost** for their first 60 days, so they can get their first reviews.
- Guides see their own score parts, with one sentence on how to improve each.

### 15.3 Reviews

- Overall rating plus **knowledge, communication, value and route**.
- Guest photos go through moderation.
- The guide can reply publicly once.
- Reviews stay **blind and two-way** (exists), and are only possible after a completed run (exists).

## 16. Trust, safety and support

- **Verification** (exists): ID, licence, and expiry that removes the badge automatically.
- **Code of conduct and agreement** (exists, versioned). Guides re-accept when it changes.
- **Safety on the day:**
  - an SOS button on the day sheet (shares location with Mshwar support and the emergency number)
  - "Share my day" for travellers
  - emergency numbers per region
- **Insurance:** guides are encouraged to hold liability insurance. A policy number field adds an
  "Insured" badge once it's verified.
- **Disputes:** a support case with a 48 h response target (support cases exist). Both sides can add
  evidence, and the outcome is recorded.
- **Strikes:** repeated guide cancellations, no-shows or safety reports lead to a warning, then a pause,
  then suspension. Suspension already closes future days and tells travellers.
- **Privacy:** guests' phone numbers are visible to the guide only while a booking is confirmed and
  7 days after. Messages are kept 12 months.

## 17. Data model

New forward-only migrations (never edit an applied migration; refresh `mshwar-database/SHA256SUMS.txt`).
All business rules are in `SECURITY DEFINER` functions that take the user id explicitly, like the
rest of the schema.

| Migration                   | Tables / changes                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `060_tour_schedules`        | `tour_schedules` (experience, weekdays[], start_times[], valid_from/to, capacity, mode: shared/private/both, min_group, min_group_deadline_hours); `guide_availability` + buffer_minutes, cutoff_time, travel_aware; slot generation per schedule; **overlap guard** in booking; `guide_busy_blocks` (kind: manual/hired/external/run) |
| `061_tour_pricing`          | Child price and age range, group tiers, seasonal prices, early-bird / last-minute rules (on price rules); `tour_addons`; per-tour `booking_mode` (instant/request), `request_ttl_hours`                                                                                                                                                |
| `062_cancellation_policies` | `cancellation_policies` (flexible/moderate/strict) and a deadline computed per booking; booking states `in_progress`, `no_show`, `cancelled_weather`; reschedule proposals                                                                                                                                                             |
| `063_tour_content`          | `tour_media` (photos, order, alt text in 3 languages), highlights, FAQ, accessibility, questions for guests, pickup options                                                                                                                                                                                                            |
| `064_guide_messages`        | `conversations`, `messages`, contact masking, report/block, response metrics                                                                                                                                                                                                                                                           |
| `065_guide_calendar_sync`   | iCal feed token; `guide_external_calendars` (url, last_synced, status); busy blocks from sync                                                                                                                                                                                                                                          |
| `066_guide_earnings`        | `booking_payments` (recorded on the day: amount, method, at); statements view; add-on lines                                                                                                                                                                                                                                            |
| `067_guide_quality`         | Review sub-ratings and guide reply; `guide_levels` (nightly); ranking score view; strikes                                                                                                                                                                                                                                              |
| `068_guide_join`            | Founding-guide flag and fee schedule; referral codes for guides                                                                                                                                                                                                                                                                        |

## 18. API

All under `/api/v1`, with session auth, rate limits (`guide-write` and friends exist), and errors mapped
with `raise_from_db`.

**Traveller:**

- `GET /tours` (filters: date, region, language, duration, price, rating, mode, tier; sort), `GET /tours/{slug}`
- `GET /tours/{slug}/availability?month=YYYY-MM`: days with a price "from", then times with seats left
- `POST /tours/{slug}/book` (instant or request; idempotency key), `POST /bookings/{id}/cancel`,
  `POST /bookings/{id}/reschedule`
- `GET /me/bookings` (upcoming/past), `GET /bookings/{id}/calendar.ics`
- `GET/POST /conversations`, `GET/POST /conversations/{id}/messages`
- `POST /group-requests` (schools, companies)

**Guide:**

- `GET/PUT /guides/me/tours/{id}/schedules`, `/pricing`, `/addons`, `/media`, `/content`
- `GET /guides/me/calendar?from=&to=`, `POST /guides/me/blocks`, `DELETE /guides/me/blocks/{id}`
- `GET /guides/me/calendar.ics?token=`, `PUT /guides/me/external-calendars`
- `POST /guides/me/bookings/{id}/check-in`, `/no-show`, `/payment-received`, `/late`
- `GET /guides/me/earnings?month=`, `GET /guides/me/earnings.csv`, `GET /guides/me/insights`
- `GET /guides/me/level`, `GET /guides/me/score`

**Jobs** (`X-Job-Token`, like the existing internal jobs):

- `POST /jobs/guides/expire-requests` (every 15 min)
- `/min-group-check` (hourly)
- `/reminders` (every 15 min)
- `/weather-alerts` (every 6 h)
- `/calendar-sync` (every 15 min)
- `/generate-slots` (nightly)
- `/levels` (nightly)

## 19. Screens

| Screen            | Route                         | Notes                                                   |
| ----------------- | ----------------------------- | ------------------------------------------------------- |
| Earn with Mshwar  | `/guides/join`                | Promise, 8 ways to earn, calculator, fees, FAQ, apply   |
| Guides directory  | `/guides` (exists)            | + filters: date free, level, response time              |
| Tours marketplace | `/tours`                      | Filters, list/map toggle, sort                          |
| Tour page         | `/tours/[slug]`               | Gallery, map itinerary, sticky booking panel            |
| Booking flow      | `/tours/[slug]/book`          | Calendar → time → guests → options → review → confirm   |
| My bookings       | `/bookings`, `/bookings/[id]` | Code, map, add to calendar, messages, cancel/reschedule |
| Messages          | `/messages`                   | Traveller and guide                                     |
| Guide home        | `/guide` (exists)             | Upgraded dashboard                                      |
| Guide calendar    | `/guide/calendar` (exists)    | Day/week/month, blocks, sync                            |
| Tour builder      | `/guide/tours` (exists)       | Schedules, pricing, add-ons, media, preview             |
| Requests          | `/guide/requests` (exists)    | SLA timers, suggest a time                              |
| Day sheet         | `/guide/day/[id]` (exists)    | Check-in, late, paid, SOS                               |
| Earnings          | `/guide/earnings`             | Statement, upcoming, CSV, calculator                    |
| Insights          | `/guide/insights`             | Funnel, occupancy, score parts                          |

Every screen:

- is built phone-first (390 px) in EN/AR/FR with right-to-left Arabic;
- passes the axe accessibility tests;
- is covered by Playwright end-to-end tests.

## 20. Delivery plan and timeline

Each step is one pull request (or two), shipped behind the existing checks, with tests for every
database rule. The weeks assume one developer working full time.

| Weeks | Step                                    | Delivers                                                                                                                               |
| ----- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2   | **Join & earn**                         | `/guides/join` landing + calculator, fee table, founding-guide programme, launch checklist, tour templates                             |
| 3–5   | **Scheduling core**                     | Schedules per tour, private/shared, buffers, cut-off, minimum group, overlap guard, busy blocks, 120-day generation, concurrency tests |
| 6–7   | **Booking experience**                  | Availability calendar, guests and options, instant or request with expiry, policies, reschedule                                        |
| 8–9   | **Marketplace**                         | `/tours`, tour pages, media and content, SEO structured data, destination sections                                                     |
| 10–11 | **After booking**                       | My bookings, .ics, reminders, weather alerts, messaging with masking                                                                   |
| 12–13 | **Guide workspace**                     | Calendar views, sync (export + import), check-in, payment received, earnings and insights                                              |
| 14–15 | **Quality**                             | Sub-ratings, replies, levels, ranking score, strikes, admin moderation                                                                 |
| Later | **Payments B/C, teams, group requests** | When a licensed payment partner is signed                                                                                              |

## 21. Launch plan: the first 30 guides

| Region                     | Target guides | Focus                              |
| -------------------------- | ------------- | ---------------------------------- |
| Byblos / Jbeil             | 5             | Old souk, castle, harbour, food    |
| Batroun                    | 5             | Old town, sunset, coast, nightlife |
| Beirut                     | 6             | Food walks, history, street art    |
| Bsharri / Qadisha / Cedars | 5             | Hikes, monasteries, cedars         |
| Baalbek / Bekaa            | 4             | Temples, wineries                  |
| Tyre / Saida / South       | 5             | Sea, ruins, souks                  |

**How to recruit them:**

- the Ministry of Tourism licensed guides list
- the guide syndicate
- hiking clubs
- UNRWA Digital Hub and university networks
- guesthouses that already refer guides

**What we offer them:**

- a founding-guide 0% fee
- a free profile setup call
- help writing the first tour

**Goal:** every region has at least 3 bookable tours before the summer diaspora season.

## 22. Metrics

| Metric                                              | Target (6 months after launch)   |
| --------------------------------------------------- | -------------------------------- |
| Approved guides                                     | 50                               |
| Guides with ≥ 1 published tour and an open schedule | 80% of approved                  |
| Time from approval to first tour live               | < 1 day (median)                 |
| Tour page → booking request                         | ≥ 4%                             |
| Requests answered within 24 h                       | ≥ 95%                            |
| Median response time                                | < 2 h                            |
| Confirmed → completed                               | ≥ 90%                            |
| Completed runs with a traveller review              | ≥ 40%                            |
| Double bookings                                     | **0** (enforced by the database) |
| AI plans that add a guide                           | ≥ 5%                             |
| Guides with a booking in the last 30 days           | ≥ 60%                            |

## 23. Risks and how we handle them

| Risk                              | Mitigation                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Not enough guides at launch       | Founding programme, templates, setup calls, regional targets                            |
| Not enough travellers for guides  | AI planner hand-off, SEO pages, guide share kit, campaigns                              |
| Guides take bookings off-platform | Contact masking until confirmed; value on-platform (reviews, levels, protection, leads) |
| No online payments yet            | Pay on the day made clear; recorded payments for earnings; provider layer ready         |
| No-shows                          | Reminders, policies, traveller reputation (exists), minimum group rules                 |
| Unfair reviews                    | Blind two-way reviews (exists), only after completed runs, moderation, guide reply      |
| Double booking                    | Overlap guard in the database, concurrency tests                                        |
| Safety incidents                  | Verification, SOS, share-my-day, escalated reports (exists), strikes                    |

## 24. Principles that never change

1. **Real only:** real guides, real tours, real prices, real availability, real reviews. No sample
   listing is ever shown as real (`CATALOGUE_SAMPLE_FALLBACK` stays off in production).
2. **Rules live in the database:** capacity, overlaps, tiers, policies and levels are enforced by
   PostgreSQL functions and tested there.
3. **The guide is a partner, not inventory:** fees are visible, ranking is explainable, and data belongs
   to the guide (CSV export).
4. **Lebanon first:** Arabic, Arabizi and French throughout; pay-on-the-day respected; the diaspora
   season planned for.
