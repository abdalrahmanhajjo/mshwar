# Privacy retention by entity

Mshwar keeps enough history to honour bookings and accounting. Personal
data is exported, reset, or anonymised through `/api/v1/privacy/*`.

| Entity                                         | Export                                   | Personalisation reset                                            | Account deletion                                                                                                 |
| ---------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Profile (`users`, `user_private`)              | Display name, email, locale, preferences | Preferences and personalisation consent cleared. Identity stays. | Display name becomes `Deleted user`, email/phone null, status `deleted`, subject rewritten.                      |
| Sessions / credentials / reset & verify tokens | Not included                             | Unchanged                                                        | Sessions revoked. Credentials and unused tokens removed.                                                         |
| Trips                                          | Title, status, created_at                | `preference_overrides` cleared. Trip rows stay.                  | Trip rows stay under the anonymised owner id.                                                                    |
| Favorites (`account_favorites`)                | Listing slugs                            | Unchanged                                                        | Removed. They are not financial records.                                                                         |
| Reviews (`reviews`)                            | Rating and body for the author           | Unchanged                                                        | Rows stay. The author is the anonymised user.                                                                    |
| Bookings (`account_bookings`, `bookings`)      | Status, policy, reason                   | Unchanged                                                        | Rows stay with the same customer id. Never hard-deleted.                                                         |
| Payments / refunds / booking_events            | Not in the traveller JSON (accounting)   | Unchanged                                                        | Kept. Foreign keys point at the anonymised user.                                                                 |
| Feedback / recommendation runs                 | Not included                             | User id detached, changes cleared                                | Already detached by reset, or left pointing at the anonymised id.                                                |
| Notifications (`account_notifications`)        | Not included                             | Unchanged                                                        | Removed.                                                                                                         |
| Audit log                                      | Not included                             | New `reset_personalisation` row                                  | New `delete_account` row. Audit rows are immutable.                                                              |
| Guide profile, calendars, private feed         | Under `guides.guide_profile`             | Unchanged                                                        | Profile emptied and suspended (open bookings cancelled, travellers told); calendars, feed and busy time deleted. |
| Tour bookings (`tour_booking_details`)         | Under `guides.tour_bookings`             | Unchanged                                                        | Future ones cancelled with notice to the guide; past ones kept for accounting.                                   |
| Guide messages                                 | Under `guides.conversations`             | Unchanged                                                        | Bodies the person wrote become `[deleted]`. Deleted for everyone after 12 months (nightly).                      |
| Guide reviews (`guide_reviews`)                | Under `guides.reviews_written`           | Unchanged                                                        | Star rating kept, words removed.                                                                                 |
| Hire requests (`guide_engagements`)            | Under `guides.hire_requests`             | Unchanged                                                        | Rows stay under the anonymised id.                                                                               |
| Guide strikes                                  | Under `guides.strikes`                   | Unchanged                                                        | Kept with the profile (safety record).                                                                           |
| Email change links                             | Not included                             | Unchanged                                                        | Removed.                                                                                                         |

## Nightly purge (security plan SEC-63)

`app.purge_expired_data()` runs every night (scheduler job `privacy-purge`):

| What                                                      | Deleted after                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| Revoked or expired sessions                               | 30 days                                                               |
| Password reset, email verification and email change links | 7 days past expiry                                                    |
| Guide messages                                            | 12 months, unless the conversation was reported in the last 12 months |
| Empty conversations                                       | 12 months after the last message                                      |

Export, personalisation reset, and account deletion are written to `app.audit_log`.
