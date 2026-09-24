# Local services: transport, drivers, money changers, food and stays (V1–V6)

Every destination page now carries a "Local essentials" section: checked transport
cards, verified drivers, licensed money changers, and checked restaurants and places
to stay. Nothing here is seeded; every card, partner and venue is added by staff,
proposed by a guide, or applied for by the partner, and shows only once checked.

## Trust model (V1)

- Drivers and money changers apply at `/drive` and `/exchange`. Each application
  needs a verified phone (SMS code), an authenticator app (TOTP), a profile, the
  documents in `app.trust_requirements`, and the signed partner agreement.
- Staff review at `/admin/verification`: every document is checked with its issuer,
  and approval is refused until someone has met the partner (video call or visit).
- "Verified" is derived, never stored: `app.partner_is_live()` is true only while the
  partner is approved and every required document is verified and in date.
- Live partners must give a fresh authenticator code (step-up, 15 minutes) before
  changing a plate, a branch address or posting rates.
- A daily sweep (`POST /api/v1/partners/ops/sweep` with `X-Job-Token`) warns
  30 and 7 days before a document lapses, hides lapsed partners, sends transport
  cards and venues past their review date back for a re-check, and expires ride
  requests.

## Transport cards (V2)

Staff write cards at `/admin/transport`; guides propose them from
`/guide/contribute`. A card is published with the date of its field check and is due
for a re-check 90 days later. Travellers can flag a card that changed; repeated flags
send it back for review.

## Drivers (V3)

Travellers send one request (`/rides/new`); verified drivers covering the area send
fixed prices; the traveller books one and pays the driver in the car. Mshwar takes no
fee. Booking shows the plate, the driver's verified phone and a share link for family
(`/rides/shared/<token>`, shown once, revocable). Either side can report a ride;
safety reports reach a person at once.

## Money changers (V4)

Only institutions on Banque du Liban's list of registered exchange institutions can be
approved. Staff paste the monthly list at `/admin/exchange`; changers missing from it
are hidden at once. Each branch is visited or video-checked. Rates are posted by the
changer, shown with the time, expire after 12 hours, and are never used to rank
changers. Two upheld "rate was different" reports in 30 days pause rate posting for
30 days (uphold from `/admin/cases`).

## Restaurants and stays (V5, V6)

Owners set the kind, licence and details of a listing in the business portal, or claim
a place our team listed (`/business/claims`). Staff add places they visited and record
checks at `/admin/venues`, which also shows coverage against the target of 5
restaurants and 3 stays per destination. A check lasts a year.

## Going live

- **Migrations 039–043** run on every deploy (the deploy job runs `migrate` before restarting
  the API). See `docs/staging-runbook.md` to run them by hand.
- **The daily sweep** is run by the `scheduler` service at 03:00 Beirut time and at boot, with
  notification dispatch every minute. It is deployed with the API.
- **SMS**: set `SMS_BACKEND=twilio` and `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
  in the server's `.env`, then send a test with `scripts/send_test_sms.py`. Production refuses to
  boot without them.
- **Legal review**: send counsel the review packet and follow
  `docs/legal/partner-agreements-review.md`. Partners see a draft notice until
  `NEXT_PUBLIC_PARTNER_AGREEMENTS_REVIEWED=true`.
- Start with Beirut, Byblos and Batroun: load the BDL list, write transport cards, and recruit
  and check the first drivers, changers and venues.
