# Guide experience: plan to reach best-in-class

**Goal:** booking a local guide on Mshwar should feel as easy and trustworthy as GetYourGuide, Viator,
Airbnb Experiences, ToursByLocals and Withlocals. Guides should run their schedule as easily as they
would in Bókun or FareHarbor. Mshwar's rules still hold:

- real, verified guides only;
- real reviews only;
- no invented prices or availability;
- Arabic, English and French throughout.

---

## 1. What exists today (G1–G6, migrations 033–038)

| Area                   | Built                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity               | Guide application, documents, admin verification, licensed guide vs local host (hosts can't charge), badge that lapses when the licence does, public profile |
| Tours                  | Tours built from catalogue places (route), languages, meeting point, included and bring lists, cancellation terms, publish/unpublish                         |
| Scheduling             | **One weekly pattern per guide** (weekday + start time), minimum notice, maximum tours a day, blocked dates, slots generated up to 90 days ahead             |
| Booking                | **Request to book only**: the traveller picks from the next few slots in a dropdown, the guide accepts or declines, payment happens on the day               |
| Hire for a planned day | A traveller hires a licensed guide for their Mshwar plan; the guide can accept, decline or propose changes as a diff                                         |
| Running the day        | Day sheet (stops, times, group, phones once confirmed, needs), start and complete                                                                            |
| Reviews                | Two-way and blind: neither side sees the other's review until both are written or 14 days pass                                                               |
| Trust                  | Versioned guide agreement, suspension closes future days, problem reports, admin funnel                                                                      |

The foundations are strong: verification, trust and the running-the-day tools are already better than
many competitors. **The gaps are in discovery, the booking and scheduling experience, messaging, and
the traveller's bookings after they request.**

## 2. What the best platforms do that we don't yet

| Feature                                                                 | GetYourGuide / Viator | Airbnb Exp. | ToursByLocals | **Mshwar today**            |
| ----------------------------------------------------------------------- | --------------------- | ----------- | ------------- | --------------------------- |
| Browse all tours with filters (date, price, language, duration, rating) | ✓                     | ✓           | ✓             | Guide list only             |
| Tour page with its own URL, gallery, itinerary map, reviews, FAQ        | ✓                     | ✓           | ✓             | Tour card on the guide page |
| **Availability calendar** (month view → times → spots left)             | ✓                     | ✓           | ✓             | Dropdown of the next slots  |
| Per-tour schedules, seasons, buffers, cut-off times                     | ✓                     | ✓           | ✓             | One pattern per guide       |
| Private vs shared tours; adult/child/group pricing                      | ✓                     | ✓           | ✓             | One price per person        |
| Instant confirmation (optional)                                         | ✓                     | ✓           | –             | Request only                |
| Message the guide before and after booking                              | –                     | ✓           | ✓             | ✗                           |
| Custom tour request ("design my day")                                   | –                     | –           | ✓             | Only from a Mshwar plan     |
| My bookings: ticket, meeting point map, add to calendar, change, cancel | ✓                     | ✓           | ✓             | Partial (notifications)     |
| Reminders (24 h / 2 h), post-tour review prompt                         | ✓                     | ✓           | ✓             | Review inbox only           |
| Guide response rate and time, tours given, "usually responds in 1 h"    | –                     | ✓           | ✓             | ✗                           |
| Calendar sync (Google/iCal) so guides never double-book                 | Operator tools        | ✓           | ✓             | ✗                           |
| Guide dashboard: occupancy, conversion, earnings                        | ✓                     | ✓           | ✓             | Admin funnel only           |
| Ranking by quality (reviews, response, cancellations)                   | ✓                     | ✓           | ✓             | ✗                           |
| Rich results in Google for tours (TouristTrip + real ratings)           | ✓                     | ✓           | ✓             | ✗                           |

## 3. The plan: five phases

Each phase ships on its own and is useful by itself. They are ordered by traveller impact, and each
builds on the last.

### Phase 1: Find and trust a guide (discovery)

1. **Header button "Find a guide" → /guides.** Done in this change.
2. **Tours marketplace at `/tours`.** Every published tour from every approved guide, with filters:
   - date (only tours with a free slot that day)
   - region
   - language
   - duration
   - price
   - rating
   - private or shared
   - licensed or local host

   Sort by recommended, rating, price or next available. There's a map view too, reusing the MapLibre map.

3. **Tour detail page at `/tours/[slug]`:**
   - photo gallery
   - the itinerary as numbered stops on the map
   - highlights, what's included and what to bring
   - meeting point with a map and "Open in Google Maps"
   - languages, group size, duration
   - the cancellation policy in plain words
   - reviews
   - "About your guide"
   - a sticky booking panel
4. **Better guide profile:**
   - cover photo and short intro
   - verified badges (ID, licence and date checked)
   - languages
   - response rate and typical response time
   - tours given
   - member since
   - reviews summary
   - "Message" and "Request a custom day" buttons
5. **Directory upgrade:** filter guides by region, language, speciality, available on a date, and rating.
6. **SEO:** tour and guide pages get `TouristTrip` / `Person` structured data. Review ratings appear
   **only when there are real reviews**. Tours are added to the sitemap, and region pages link to them
   ("Guided tours in Batroun").

### Phase 2: Scheduling and booking (the core)

**Scheduling model:** from one pattern per guide to schedules per tour.

- **Schedules per tour.** A tour gets one or more schedules: days of the week, start times,
  a date range (for example "summer: June–September"), and capacity. A weekday sunset walk and a
  weekend all-day hike can differ.
- **Private vs shared.** Private tours take one group per slot and are priced per group or per person.
  Shared tours fill seats up to the tour's capacity.
- **Guide-level rules** (still enforced by the database):
  - minimum notice
  - maximum tours a day
  - **buffer time** between tours, including the drive between meeting points
  - **cut-off time** (for example "no bookings after 18:00 for tomorrow")
- **One guide can't be in two places.** When a slot is booked, every overlapping slot of the guide's
  other tours closes automatically, as does a hired-day engagement. The check runs inside the
  database's booking function, so two travellers can't both book the same guide for 10:00.
- **Blocked dates, and blocked times within a day**, with a reason that only the guide sees.
- **Calendar sync:**
  - Each guide gets a private **iCal feed** of their bookings for Google or Apple Calendar.
  - Guides can add an **external busy calendar** by iCal URL. Mshwar reads it every 15 minutes and
    closes clashing slots.

**Pricing:**

- per person, with optional **child price** and **group price tiers** (for example 1–2, 3–6, 7–10);
- private tours priced per group;
- **optional seasonal prices**;
- all shown as the guide's published price, never estimated.

Local hosts stay free, and the database keeps enforcing that.

**Booking experience (traveller):**

1. **Calendar picker:** a month view with available days highlighted and "from $X" on each day.
2. Pick a **time**; each time shows the seats left.
3. Pick **participants** (adults and children), and **private or join a group** where both exist.
4. Choose the **language**, add **pickup** if the tour offers it, write a **note to the guide**, and
   answer the accessibility or dietary questions.
5. **Review screen:** full price breakdown, cancellation policy, "pay the guide on the day",
   meeting point.
6. **Instant confirmation or request**, depending on the tour. The guide chooses per tour:
   - **Instant** confirms at once.
   - **Request** must be answered **within 24 h** (configurable). If it isn't, the request
     auto-declines, and the traveller is told and shown similar tours.

**Cancellation policies:** standard choices like Airbnb's:

- **Flexible:** free cancellation up to 24 h before
- **Moderate:** free up to 3 days before
- **Strict:** free up to 7 days before

Each is shown the same way everywhere, and the booking page shows the exact deadline date. Payment
stays on the day until a licensed Lebanese payment partner is chosen (AGENTS.md: Stripe isn't
available in Lebanon). The provider layer is ready for it.

### Phase 3: Messaging and my bookings

1. **Messages:** one conversation per traveller and guide, before and after booking. It covers text,
   quick replies ("What should I bring?") and read receipts.
   - Phone numbers and emails are **hidden until a booking is confirmed**, so the agreement stays
     on Mshwar.
   - Guides can report or block a conversation.
   - Response time is measured from here.
2. **My bookings (traveller):**
   - upcoming and past bookings
   - a booking card with a **QR / booking code**
   - the meeting point on a map, with Google Maps and Waze
   - the guide's phone once confirmed, and WhatsApp
   - **Add to calendar** (.ics)
   - **reschedule** to another open slot, if the policy allows
   - **cancel**, with the refund rule shown
3. **Reminders by email** (Brevo) and in-app notifications:
   - booking confirmed or declined
   - 24 h before, with weather from Open-Meteo and what to bring
   - 2 h before, with the meeting point
   - after the tour: "How was it?"
   - the guide's reminder to reply to requests
4. **Custom tour requests:** "Design my day with [guide]": date, group, interests and budget. The guide
   replies with a tour proposal, built from the existing engagement and diff machinery, which the
   traveller accepts in one tap.

### Phase 4: The guide's workspace (professional tools)

1. **Calendar:** day, week and month view of every slot, booking, hired day and block.
   - **Drag to block time**, click a slot to see who's coming.
   - Colours: open, partly booked, full, private, blocked.
2. **Tour builder upgrades:** photos (via the existing private upload storage, later ImageKit),
   highlights, FAQ, languages, pickup options, questions for guests, pricing tiers, schedules and
   policy. A **preview exactly as travellers see it**, and a **publish checklist** (photos, meeting
   point, at least one schedule).
3. **Requests inbox:** SLA timers ("reply in 5 h"), one-tap accept or decline with a reason, and
   suggest another time.
4. **Dashboard:**
   - upcoming days
   - requests waiting
   - **response rate and time**
   - occupancy per tour
   - page views → requests → confirmed (conversion)
   - earnings recorded (paid on the day)
   - rating trend
5. **Manifest / day sheet:** add **check-in** (tick off who arrived, mark no-shows), **message the
   whole group**, and let the guide **delay or cancel with a reason**. A cancellation notifies everyone
   and offers them other times.
6. **Mobile first:** the guide works from a phone on the day, so every screen is built for 390 px.

### Phase 5: Quality, ranking and trust

1. **Ranking score.** A single, explainable score used for "Recommended". It's built from real signals
   only:
   - review average (weighted by count)
   - response rate and time
   - guide cancellations
   - completed tours
   - profile completeness

   Guides are shown what drives their score.

2. **Detailed reviews:** overall rating plus knowledge, communication, value and route. Guest photos go
   through moderation. The guide can reply publicly, once.
3. **Guide levels:** New, then Trusted, then Top guide. Levels are earned on published thresholds and
   never paid for.
4. **Safety:**
   - an SOS button on the day sheet during a run
   - share-my-day with a contact
   - an emergency number per region
   - escalated safety reports (already built)
5. **Admin:**
   - tour moderation queue
   - review moderation
   - message reports
   - quality alerts: late responses, cancellations, low ratings

## 4. Data and API changes (outline)

New forward-only migrations (never edit applied ones; refresh `SHA256SUMS.txt`):

| Migration                   | Adds                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `06x_tour_schedules`        | `app.tour_schedules` (tour, weekdays, start times, date range, capacity, private/shared), buffer and cut-off on `guide_availability`, overlap guard in the slot booking function, slot generation per schedule |
| `06x_tour_pricing`          | Child price, group tiers, seasonal prices (reusing price rules), `booking_mode` per tour (instant/request), response SLA and auto-decline job                                                                  |
| `06x_cancellation_policies` | Standard flexible / moderate / strict policies and the deadline shown per booking                                                                                                                              |
| `06x_guide_messages`        | `app.conversations`, `app.messages` (SECURITY DEFINER functions only), contact masking before confirmation, response metrics                                                                                   |
| `06x_guide_calendar_sync`   | iCal feed token per guide, external busy calendars + busy blocks                                                                                                                                               |
| `06x_tour_content`          | Gallery, highlights, FAQ, questions for guests, pickup options                                                                                                                                                 |
| `06x_guide_quality`         | Review sub-ratings, guide replies, guide levels, ranking score view                                                                                                                                            |

API (FastAPI, `/api/v1`):

- `GET /tours` (filters, sort, date availability)
- `GET /tours/{slug}`
- `GET /tours/{slug}/availability?month=`
- `POST /tours/{slug}/book`
- `GET /me/guide-bookings`, then reschedule and cancel
- `/conversations`
- `GET /guides/me/calendar.ics` (token)
- guide schedule and pricing endpoints
- scheduled jobs (behind `X-Job-Token`):
  - auto-decline expired requests
  - send reminders
  - sync external calendars

Web:

- `/tours`, `/tours/[slug]`
- a new booking flow component
- `/bookings` (my bookings)
- `/messages`
- the guide workspace: calendar, dashboard and tour builder upgrades

Everything goes through the existing copy catalogues (EN/AR/FR) and is checked by the i18n check,
axe accessibility tests and Playwright.

## 5. How we'll know it's working

| Metric                                  | Target                       |
| --------------------------------------- | ---------------------------- |
| Tour page → booking request             | ≥ 4%                         |
| Requests answered within 24 h           | ≥ 95%                        |
| Median guide response time              | < 2 h                        |
| Confirmed → completed (no cancellation) | ≥ 90%                        |
| Completed tours with a review           | ≥ 40%                        |
| Double bookings                         | 0 (enforced by the database) |

## 6. Not in scope yet

- **Online payment and payouts:** needs a licensed Lebanese payment partner. Until then it's "pay the
  guide on the day", clearly shown.
- **A native mobile app:** the web app is built phone-first instead.
- **Real-time chat (WebSockets):** messages refresh on open and every 30 s at first.

## 7. Suggested order of work

| Step | Scope                                                  | Why first                                             |
| ---- | ------------------------------------------------------ | ----------------------------------------------------- |
| 1    | Phase 2 scheduling model + calendar booking + policies | The core promise: book a real time that's really free |
| 2    | Phase 1 `/tours` marketplace + tour page               | Travellers can find what they can now book            |
| 3    | Phase 3 my bookings + reminders + messaging            | What happens after "Request"                          |
| 4    | Phase 4 guide calendar + dashboard + check-in          | Guides run their business here                        |
| 5    | Phase 5 ranking, detailed reviews, levels              | Quality compounds once there's volume                 |
