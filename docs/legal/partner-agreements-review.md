# Partner agreements: legal review

The driver agreement and the money-changer agreement
(`apps/web/src/lib/legal/partner-agreements.ts`, version `2026-09-23`, English, Arabic and
French) are reviewed separately from the site terms, which counsel approved on 18 September 2026.
Until they are approved, every partner sees "Draft pending legal review" on the agreement step.

## Send

Send counsel `Mshwar-partner-agreements-legal-review.docx` (kept outside the repo, next to the
patches). It holds:

1. what we are asking for,
2. a table of the rules the platform already enforces, so a change to the text is also flagged
   as a change to the product,
3. ten questions: Mshwar's role as a listing service, driver eligibility and plate rental, Law
   347/2001 and BDL rules for changers, personal data under Law 81/2018 and retention, electronic
   acceptance, suspension and appeal, the missing liability, governing-law and notices clauses,
   which language prevails, and anything else a court or regulator would expect,
4. a sign-off block,
5. both agreements in all three languages, with section identifiers so comments line up across
   languages.

Ask for tracked changes and comments in that file.

## When counsel signs off

Do this before approving the first live partner. Changing the version hides every partner until
they accept the new one, which costs nothing before launch.

1. Apply the approved text to `partner-agreements.ts` in all three languages, keeping the section
   identifiers.
2. Set `PARTNER_AGREEMENT_VERSION` to the approval date, and add a migration that redefines
   `app.current_partner_agreement_version()` to return the same date (migrations are
   forward-only, so do not edit 039). Update `SHA256SUMS.txt`.
3. Set `NEXT_PUBLIC_PARTNER_AGREEMENTS_REVIEWED=true` wherever the web app is built. It is read at
   build time, so rebuild or redeploy the web app afterwards.
4. Check `/drive` and `/exchange`: the draft notice is gone and the new version number shows.
   Anyone who accepted the draft is asked to accept again before they can go live.

File the signed packet with the date and the name of the reviewer.
