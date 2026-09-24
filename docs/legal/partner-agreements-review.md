# Partner agreements: legal review

The driver agreement and the money-changer agreement
(`apps/web/src/lib/legal/partner-agreements.ts`, English, Arabic and French) are reviewed
separately from the site terms, which counsel approved on 18 September 2026.

## Record

| Version      | Sent to counsel   | Approved          | Changes |
| ------------ | ----------------- | ----------------- | ------- |
| `2026-09-23` | 24 September 2026 | 24 September 2026 | None    |

Approval is recorded in code, in `PARTNER_AGREEMENT_REVIEWS`, next to the text it covers. A
version that is not listed there shows partners "Draft pending legal review" on the agreement
step, so changing the text without a new review can never look approved.

File the signed review packet (`Mshwar-partner-agreements-legal-review.docx`) with the reviewer's
name and the date.

## The review packet

Counsel receives one Word file with:

1. what we are asking for,
2. a table of the rules the platform already enforces, so a change to the text is also flagged
   as a change to the product,
3. ten questions: Mshwar's role as a listing service, driver eligibility and plate rental, Law
   347/2001 and BDL rules for changers, personal data under Law 81/2018 and retention, electronic
   acceptance, suspension and appeal, liability, governing-law and notices clauses, which
   language prevails, and anything else a court or regulator would expect,
4. a sign-off block,
5. both agreements in all three languages, with section identifiers so comments line up across
   languages.

## Changing the agreements later

Do this with counsel's approved text in hand. Changing the version hides every partner until they
accept the new one, and they are asked to on their next visit.

1. Apply the approved text to `partner-agreements.ts` in all three languages, keeping the section
   identifiers.
2. Set `PARTNER_AGREEMENT_VERSION` to the new version date, and add a migration that redefines
   `app.current_partner_agreement_version()` to return the same date (migrations are
   forward-only, so do not edit 039). Update `SHA256SUMS.txt`.
3. Add the version and its approval date to `PARTNER_AGREEMENT_REVIEWS`.
4. Check `/drive` and `/exchange`: no draft notice, and the new version number shows.
