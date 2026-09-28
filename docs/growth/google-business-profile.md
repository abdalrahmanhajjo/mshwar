# Google Business Profile and brand presence

## 1. Check eligibility first (important)

Google Business Profile is for businesses that **meet customers in person**: at an address
customers can visit, or by going to customers (a service-area business). Google's guidelines
say online-only businesses are **not eligible**, and ineligible profiles get suspended — which
can also block you from creating a valid one later.

Mshwar qualifies only if at least one of these is true:

- There is an office or desk (for example at a hub) where travellers can come in, with a sign
  and staffed opening hours.
- Mshwar itself delivers an in-person service (for example guided days run by Mshwar staff),
  in which case it is a **service-area business** with the address hidden.

If neither is true today, skip to §3: the same brand result comes from the site's
Organization data and consistent profiles, and you can add a Business Profile later.

## 2. Profile content, ready to paste (only if eligible)

Create at <https://business.google.com> with the Google account that will own Mshwar.

| Field            | Value                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Business name    | `Mshwar` (the real-world name only; no keywords like "Lebanon travel")                                                            |
| Primary category | `Tour agency` if Mshwar runs guided days; otherwise `Travel agency` only if you sell travel. Pick the one that is literally true. |
| Service area     | Lebanon (if service-area; leave the address hidden)                                                                               |
| Website          | `https://mshwarlb.com`                                                                                                            |
| Phone            | A number that is answered during the hours below                                                                                  |
| Hours            | The hours someone actually answers or the desk is open                                                                            |
| Logo             | `apps/web/public/logo-512.png` (512×512)                                                                                          |
| Cover photo      | A real photo you own or have permission for (for example Baalbek or Byblos)                                                       |

**Description — English (max 750 characters):**

> Mshwar helps travellers, the Lebanese diaspora and residents discover Lebanon and plan a day
> that fits them. Browse real places across the country — from Beirut, Byblos and Batroun to the
> Qadisha Valley, the Cedars and Baalbek — each with where it is, opening hours and how long it
> takes. Save the places you like and let the planner put them in order with drive times worked
> out. Prices are published or marked "on request", never guessed. Available in English, Arabic
> and French at mshwarlb.com.

**الوصف — العربية:**

> يساعد مشوار المسافرين واللبنانيين في الاغتراب والمقيمين على اكتشاف لبنان والتخطيط ليوم
> يناسبهم. تصفّح أماكن حقيقية في كل البلد — من بيروت وجبيل والبترون إلى وادي قاديشا والأرز
> وبعلبك — لكلٍّ منها موقعه وساعات عمله ومدّة زيارته. احفظ ما يعجبك ودع المخطِّط يرتّبها مع حساب
> مدّة القيادة. الأسعار منشورة أو «عند الطلب» ولا نخمّنها أبدًا. بالعربية والإنجليزية والفرنسية
> على mshwarlb.com.

After verification (phone, video or postcard — Google chooses):

1. Add 5–10 real photos with permission.
2. Ask the first real users to review; never offer rewards for reviews (against Google policy).
3. Post monthly updates linking to new pages (for example `/things-to-do/nature` in spring).

## 3. Brand presence that works without a Business Profile

Google builds a brand panel from consistent signals. Do these in order:

1. **Same name, logo and link everywhere**: create or tidy profiles with the name `Mshwar`,
   the 512 px logo and `https://mshwarlb.com`:
   Instagram, Facebook page, LinkedIn company page, TikTok, YouTube, X.
2. **Tell Google about them**: add the profile URLs to `sameAs` in
   `organizationSchema()` (`apps/web/src/lib/seo/schema.ts`) once they exist — only real,
   active profiles.
3. **Search Console**: verify the domain and submit the sitemap (see `docs/seo-geo-strategy.md` §19).
4. **Bing Webmaster Tools**: import the site from Search Console (one click). Bing also feeds
   ChatGPT search and Copilot.
5. **Wikidata** (later): an item for Mshwar needs independent references (press, awards,
   university or hub coverage). Create it after the first two or three articles about Mshwar exist.
6. When a knowledge panel appears for "Mshwar", claim it with the verified Search Console
   account.
