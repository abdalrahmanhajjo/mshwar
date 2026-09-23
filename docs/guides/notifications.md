# Guide notification taxonomy

Owner: guide product · Code: migrations 035–038 (`app.emit_notification_event`, `app.notify_engagement`) ·
Test: `services/api/tests/test_guide_trust.py::test_every_guide_notification_has_a_template_in_every_language`

Every guide-related event uses the existing notification pipeline (outbox → in-app feed + email), is
transactional (never marketing), goes to exactly one person, and has an en / ar / fr template in
`app.notification_templates` (audience `traveller`, which means "one named user"). The test fails if an
event is emitted from a guide migration without all three templates.

| Event                               | Recipient                     | Raised when                                                               | Deep link                          |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `guide.application_decided`         | The applicant                 | An admin approves, rejects or suspends an application (trigger on status) | `/guide`                           |
| `guide.proposal_decided`            | The guide who proposed        | A reviewer accepts or rejects a place proposal                            | `/guide/contribute`                |
| `guide.review_requested`            | Each traveller, and the guide | The guide completes a tour start or a hired day                           | `/guides/review`, `/guide/reviews` |
| `engagement.requested`              | The guide                     | A traveller asks the guide to run a planned day                           | `/guide/requests/{id}`             |
| `engagement.accepted`               | The traveller                 | The guide accepts the day as planned                                      | `/plan/{trip}/guide`               |
| `engagement.changes_proposed`       | The traveller                 | The guide answers with a diff against the plan                            | `/plan/{trip}/guide`               |
| `engagement.declined`               | The traveller                 | The guide declines, with a reason                                         | `/plan/{trip}/guide`               |
| `engagement.confirmed`              | The guide                     | The traveller confirms, or accepts the guide's changes                    | `/guide/requests/{id}`             |
| `engagement.cancelled_by_traveller` | The guide                     | The traveller cancels, or keeps their own plan over the guide's changes   | `/guide/requests/{id}`             |
| `engagement.cancelled_by_guide`     | The traveller                 | The guide cancels with a reason, or the guide is suspended                | `/plan/{trip}/guide`               |

Tour requests reuse the existing `business.*` booking events raised by `app.notify_booking_row`. From
migration 038, `app.notification_deep_link` sends those to `/guide/requests` when the booking belongs to a
guide's organisation, so a guide never lands in the hidden business portal.

## Adding an event

1. Emit it with `app.emit_notification_event('<event>', <aggregate>, <recipient user>, NULL, <payload>)`.
   Put `path` in the payload for `guide.*` events; engagement events are routed by `app.notify_engagement`.
2. Insert en, ar and fr templates in the same migration.
3. Add a row to the table above.
