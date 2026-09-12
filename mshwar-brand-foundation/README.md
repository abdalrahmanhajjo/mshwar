# Mshwar brand foundation

Proposed visual identity for the Lebanon-wide travel discovery and itinerary platform. This is a reviewable brand direction for the interface work, not an assertion of trademark clearance or a user-approved identity. The previous PostgreSQL package remains independent.

## Included

- Primary bilingual logo concept, with the Latin wordmark `mshwar` and Arabic `مشوار`.
- App icon master concept, using the same journey symbol.
- Visual brand direction board.
- Exact editable design tokens in JSON and a CSS foundation.
- Typography, icon, photography and responsive-interface guidance.
- Calculated contrast checks for the proposed palette.

The images are raster artwork. They are not editable SVG masters, and typography shown in the generated board is a visual approximation. The definitive application type choices are listed below. Raster app-icon adaptation may vary slightly from the original logo; final production should export both from one approved vector master. Platform-specific app icon/favicons are not claimed as finished exports here.

## Logo concept

The continuous M-shaped path connects the name to a journey; the orange endpoint becomes a small memorable accent. Keep the mark flat, proportions unchanged and free of shadows or extra outlines. Use the full wordmark in the website header and symbol alone where space is limited. Keep clear space at least the diameter of the endpoint dot around the logo. At small sizes, omit the Arabic subline rather than shrinking it until unreadable. Test the finalized vector at 16, 24 and 32 pixels before exporting favicons.

Do not imply that the logo is an official emblem, government asset, verified supplier badge or partner mark. The RKIF website is the user's visual reference for the later UI; its logo is not being reused.

## Color roles

| Role | Exact value | Use |
|---|---|---|
| Cedar | #12352F | Primary text, navigation, primary buttons |
| Orange | #F3653E | Brand accent, selected details and endpoint dot |
| Canvas | #FCFCF8 | Main page background |
| White | #FFFFFF | Cards, dialogs and input surfaces |
| Slate | #66756E | Secondary text on canvas |
| Border | #D8E0DC | Dividers and secondary boundaries |
| Accent text | #0C241F | Small text on orange-filled controls |

Canvas/cedar contrast is 12.96:1. Slate/canvas is 4.71:1. White/orange is only 3.11:1 and cedar/orange is 4.28:1, so neither is the default small-text pairing on orange. The CSS uses the darker accent text instead. These calculations cover these color pairs only; full interface accessibility still requires component and interaction checks.

## Typography

- Latin: **Manrope**, weights 400, 500, 600, 700 and 800. [Official specimen](https://fonts.google.com/specimen/Manrope).
- Arabic: **Noto Sans Arabic**, weights 400, 500, 600 and 700. [Official specimen](https://fonts.google.com/noto/specimen/Noto%20Sans%20Arabic).
- Main body: 16px or larger; standard labels 14px or larger; Latin line height 1.6, Arabic 1.8.
- Use semantic heading order and avoid all-caps paragraphs. Do not apply Latin letter spacing to Arabic.
- Self-host approved font files in the production repository with their license notices; this package does not contain font binaries.

## Icon system

Use [Lucide](https://lucide.dev/) consistently, with 24px default size and 1.75px stroke. Do not mix unrelated icon libraries, emoji or solid icons in the navigation. Keep its [license notices](https://lucide.dev/license) when distributing icon assets. Icons are specified here, not bundled as individual SVG exports.

| Product purpose | Lucide icon |
|---|---|
| Discovery | Compass |
| Location | MapPin |
| Trip planning | Route |
| Date | CalendarDays |
| Party size | Users |
| Saved places | Heart |
| Booking | Ticket |
| Nature | Mountain |
| Dining | Utensils |
| Stay | BedDouble |
| Weather | CloudSun |
| Search | Search |
| Filters | SlidersHorizontal |
| Business portal | Store |
| Accessibility | Accessibility |

Give icon-only controls accessible names and 44px interaction targets. Mirror directional navigation appropriately in RTL; never mirror logos, photographs or non-directional icons automatically.

## Photography direction for the upcoming interface

Use real, source-checked Lebanese places: coast, mountains, historic architecture, food and human-scale local experiences. Favor natural light, documentary credibility and thoughtful crops. Never use generated scenery as documentary evidence for a named location, and never invent provider image URLs. Real listing photos must belong to or be authorized by the listing owner. Reserve image aspect ratios to avoid layout shifts, provide descriptive alt text and serve responsive optimized files. Actual destination photos will be sourced during interface construction; they are not included in this brand foundation.

## Interface rules

Use a 4px spacing base, 12px controls and 20px cards. Keep a 1280px content maximum with 48px desktop and 20px mobile gutters. Prioritize discovery/search and trip creation immediately; avoid a long marketing page before the working product. Navigation, filters, trip timeline, booking summaries and business screens must share the same tokens.

Use explicit available, pending, confirmed and cancelled text; never communicate a booking state by color alone. Provide keyboard focus, empty/error/loading states and reduced-motion behavior. The orange endpoint is a brand cue, not a universal notification badge. Display estimates as estimates, and keep demonstration inventory visibly distinguished from bookable supply.

## Remaining production artwork work

After the visual direction is settled, create a single editable vector logo master, exact vector-derived icon and favicon exports, final dark/light lockups and an audited font/icon asset bundle. Build and test the actual responsive screens against the product requirements and database contract. This foundation does not claim those later deliverables are already complete.
