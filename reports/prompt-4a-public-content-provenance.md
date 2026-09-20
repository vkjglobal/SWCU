# Prompt 4A public-content provenance audit

Audit scope: public routes, public shell, CMS/seed data, public metadata, empty/error states, Services content, Member Login/App actions, and telephone actions.

Classification used by Prompt 4A:

- **MASTER EXACT** — wording traceable word-for-word to the locked design master.
- **OWNER APPROVED** — separately approved wording, where an approval record is traceable.
- **GENERIC UI** — ordinary functional interface wording.
- **BUILD-WRITTEN — CODE** — substantive wording introduced in application source.
- **BUILD-WRITTEN — CMS/SEED** — substantive wording introduced by seed/migration/bootstrap into CMS data.
- **UNRESOLVED CMS PROVENANCE** — present in the CMS/database, but no originating approval, seed, migration, or implementation record was found.

This report does not change public copy. Current database values were inspected read-only for tenant `swcu`.

## 1. Page-by-page inventory

### Home — `/`

Source: `src/app/(public)/page.tsx`, `src/components/home-experience.tsx`, `src/lib/home-data.ts`.

**Build-written code**

- Metadata title: `Service Worker Credit Union | SWCU`.
- Metadata description: `A clear, trusted public website for Service Worker Credit Union members in Fiji.`
- Hero eyebrow: `Bula. Welcome to Service Worker Credit Union.`
- Hero heading: `Save with confidence. Borrow with purpose. Build your future.`
- Hero summary: `SWCU helps members build savings, access financial assistance and strengthen the financial wellbeing of their families.`
- Hero actions: `Become a Member`, `Member Login`, `Try our Loan Calculator`.
- Empty hero caption: `A member-owned future, built together.`
- Hero accessibility labels: `SWCU highlights`, `Show hero slide {n}`, `Previous slide`, `Next slide`.
- Empty highlights state: `Homepage highlights will appear here when approved.`
- Why section: `Why members choose SWCU`; `A Credit Union Built Around Its Members`; `We are here to help ordinary working people take practical steps toward a stronger financial future.`; `Member-owned, member-focused`.
- Why cards: `Build Your Savings`; `Access Member Loans`; `Member Protection`; `Personal Member Service`.
- Services section: `What we offer`; `Services for Every Stage of Membership`; empty state `Services will appear here as they are approved and published.`; card action `Explore`.
- Calculator section: `A simple starting point`; `Plan your next step with clarity.`; `Use this simple tool to prepare your questions for SWCU. A repayment calculation will become available once it has been configured and approved.`; `No invented rates or figures. Just a clear, honest starting point.`; `Loan calculator`; `Your estimate`; `Loan Amount`; `Enter amount`; `Loan Term`; `Enter months`; `Repayment Frequency / salary/pay period`; `Salary / pay period`; `Weekly`; `Fortnightly`; `Monthly`; `Calculator status: Awaiting SWCU configuration`; `Calculate when configured`.
- Calculator disclaimer in code: `Repayment figures are estimates only. Actual terms and loan approval are subject to SWCU requirements and approval.` This remains BUILD-WRITTEN — CODE. The configured CMS disclaimer remains separately inventoried below.
- Membership journey: `A simple journey`; `Become a Member`; `Check Your Eligibility`; `Complete Your Application`; `Start Saving`; `Learn more about joining SWCU.`; `Take the next step with the right information.`; `Begin your journey with a member-owned credit union.`; `Membership Details`; `Download Membership Form`.
- Member App showcase: `Coming soon`; `Your SWCU. Wherever You Are.`; `A future digital member experience designed to make it easier to stay connected with SWCU.`; feature labels `Balances`, `Loans`, `Transactions`, `Statements`, `Forms & Requests`, `Member Notices`; mock-up labels `SWCU MEMBER APP`, `Welcome back`, `Your member home`, `Your details, in one place`; fallback setting label `Member App — Coming Soon`. The showcase is now a link using the same resolved Member App destination as the header and sticky bar.
- Resources section: `Useful to have nearby`; `Help & Resources`; `Download`; empty forms state `Approved forms and documents will appear here when available.`; `Latest from SWCU`; `Common questions`; empty FAQ state `Frequently asked questions will appear here as they are approved.`; `Contact SWCU`.

**Build-written CMS/seed**

Current HomeHighlights were introduced by `prisma/seed.ts:89-100`:

| Value | Label | Provenance |
|---|---|---|
| `1,500+` | `Members` | BUILD-WRITTEN — CMS/SEED |
| `Member-owned` | `A credit union for its members` | BUILD-WRITTEN — CMS/SEED |
| `Since 2000` | `Serving Fiji service workers` | BUILD-WRITTEN — CMS/SEED |

Current Services match `prisma/seed.ts:102-114` and are therefore BUILD-WRITTEN — CMS/SEED:

| Title | Current description | Stored icon | Source |
|---|---|---|---|
| `Savings` | `Build a steady savings habit with SWCU.` | `piggy-bank` | `prisma/seed.ts:103` |
| `Loans` | `Access member loan support when you need it.` | `hand-coins` | `prisma/seed.ts:104` |
| `Retirement Savings` | `Plan with a long-term savings mindset.` | `sunset` | `prisma/seed.ts:105` |
| `Death Benefit Scheme` | `Member support for families when it matters.` | `heart-handshake` | `prisma/seed.ts:106` |

Current FAQs match `prisma/seed.ts:116-127`:

- `Where can I find SWCU forms?` — `Approved forms and documents are available in the Forms & Resources area when they are published.`
- `How can I learn about joining SWCU?` — `Visit the Membership & Services page for approved membership information and next steps.`
- `How do I contact SWCU?` — `Use the contact details published on this website so you know you are reaching SWCU through an official channel.`

These are BUILD-WRITTEN — CMS/SEED. They were not rewritten in this audit.

### About SWCU — `/about-swcu`

Source: `src/app/(public)/about-swcu/page.tsx`.

**Build-written code**

- Metadata title: `About SWCU | Service Worker Credit Union`.
- Metadata description: `Learn about the approved story, purpose and leadership of Service Worker Credit Union.`
- Fallback hero heading: `About Service Worker Credit Union`.
- Leadership eyebrow/heading: `People of SWCU`; `Leadership`.
- Leadership image fallback: `SWCU leadership`.
- Reports heading: `Reports`; `Annual reports`.

**Build-written CMS/seed**

`prisma/seed.ts:23-43` introduced the current CMS slots:

- `Our Story` — `Service Worker Credit Union began on 23 August 2000, when a group of Fiji Public Service Association members met in Suva to establish a credit union for members. Today, SWCU serves its members from 300 Waimanu Road, Suva.`
- `Our Vision` — `To be a leading credit union providing financial services for our members.`
- `Our Mission` — `To encourage members to save and provide financial assistance that helps improve the wellbeing of members and their families.`
- `Our Purpose` — `To help members build savings, access financial assistance for provident and productive needs, and strengthen their financial wellbeing.`

The current database records match those seed values and are BUILD-WRITTEN — CMS/SEED unless a later approval record is supplied.

### Membership & Member Services — `/membership-services`

Source: `src/app/(public)/membership-services/page.tsx`.

**Build-written code**

- Metadata title: `Membership & Member Services | SWCU`.
- Metadata description: `Explore approved SWCU membership services and published information for Fiji members.`
- Hero eyebrow/title: `Membership & Services`; `Membership & Member Services`.
- Anchor labels: `Membership`; `Savings`; `Loans`; `Retirement`; `Death Benefit`.
- Joining panel: `Joining SWCU`; `Become a Member`.
- Steps:
  - `1. Review approved membership information.`
  - `Start with the approved information on this page.`
  - `2. Download the published Membership Application.`
  - `The application will appear here when published.`
  - `3. Find other documents in Forms & Resources.`
  - `Visit the resources page for approved documents.`
  - `4. Contact SWCU for current requirements or help.`
  - `Use the published contact details.`
- Actions: `Forms & Resources`; `Contact SWCU`.
- **Historical pre-4A rates presentation:** `Published information`; `Current rates`; `Current rate information is not available here.`; `Loan calculator`. The `Current rates` branch and public rates query were removed. Final current code renders only `Published information` and the configured `Loan calculator` disclaimer; no public rates/rate values/rates-unavailable message remain. The historical wording is retained here as provenance, not as current public output.

**Build-written CMS/seed**

Seed slots `MEMBERSHIP_INTRO`, `SAVINGS_INTRO`, `LOANS_INTRO`, `RETIREMENT_INTRO`, and `DEATH_BENEFIT_INTRO` were introduced at `prisma/seed.ts:45-68`:

- `Membership` — `SWCU provides savings, loans and member benefit services to eligible members. Members and people interested in joining can use the Membership Application and contact SWCU for current membership requirements.`
- `Savings` — `Regular savings help members build funds for future needs and difficult times. SWCU provides members with a practical way to build their savings over time.`
- `Loans` — `SWCU provides member loans for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member’s account position.`
- `Retirement Savings` — `SWCU’s Retirement Savings Fund helps members build additional savings and strengthen their financial position for the future.`
- `Death Benefit Scheme` — `SWCU’s Special Death Benefit Scheme is designed to provide support to the families and beneficiaries of members who pass away. Claims are handled under the Scheme’s approved rules.`

The current database `MEMBERSHIP_INTRO` record is instead headed `Membership & Member Services` with body `Everything you need to know about joining SWCU, saving, borrowing and your member benefits.`. Its origin is not traceable to the current seed and is classified UNRESOLVED CMS PROVENANCE. The other current slots match the seed values.

### Forms & Resources — `/forms-resources`

Source: `src/app/(public)/forms-resources/page.tsx`.

**Build-written code**

- Metadata title: `Forms & Resources | SWCU`.
- Metadata description: `Find approved SWCU forms, notices, annual reports and common questions.`
- Hero: `Forms & Resources`; `Forms and helpful resources`; `Approved information, documents and answers for members.`
- Sections: `Forms`; `Forms for members`; `News & Notices`; `News from SWCU`; `Annual Reports`; `Reports`; `Common Questions`; `Answers for members`.
- Empty states: `Approved forms will appear here when published.`; `News and notices will appear here when published.`; `Common questions will appear here when published.`
- Resource action: `Download`.

Form, news, FAQ titles, descriptions, summaries and answers are runtime CMS/database values. No code/seed provenance was found for individual later records beyond the three FAQ seed records listed under Home.

### Contact — `/contact`

Source: `src/app/(public)/contact/page.tsx`.

**Build-written code**

- Metadata title: `Contact SWCU | Service Worker Credit Union`.
- Metadata description: `Contact Service Worker Credit Union using approved contact details.`
- Hero: `Contact`; `Contact Service Worker Credit Union`.
- Map fallback: `SWCU office`; `300 Waimanu Road, Suva, Fiji`.
- Map alt when an asset exists: `Map showing the SWCU office at 300 Waimanu Road, Suva` — OWNER APPROVED wording explicitly supplied by Prompt 4A section 4; implementation location `src/app/(public)/contact/page.tsx:15`.
- Empty settings state: `Contact details will appear here when published.`
- Enquiry heading: `Send us an enquiry`.
- Privacy-gated fallback: `The contact form is temporarily unavailable until the published Privacy information is ready. Please use the approved contact details to reach SWCU.`
- Contact form subject values from `src/lib/contact.ts:9`: `Membership`; `Loans`; `Savings`; `Forms & Documents`; `Request a Call Back`; `General Enquiry`; `Other`.
- Contact form feedback from `src/app/(public)/_components.tsx:65`: `Your enquiry has been received. Reference: {reference}` and `Unable to send your enquiry.`.

Seed contact settings at `prisma/seed.ts:134-147` introduced:

- Organisation: `Service Worker Credit Union`
- Street: `300 Waimanu Road, Suva`
- Postal: `GPO Box 1405, Suva`
- Telephone: `(679) 7730445`
- Email: `swcu2016@gmail.com`
- Historical seed `directionsUrl`: `https://www.google.com/maps/search/?api=1&query=300+Waimanu+Road+Suva+Fiji`

The current database `directionsUrl` is `null`; no public directions link was found. The current map is static-image-only.

### Privacy, Terms of Use, Accessibility, Important Information

Routes: `/privacy`, `/terms-of-use`, `/accessibility`, `/important-information`; source `src/app/(public)/[utility]/page.tsx`.

These routes read only published CMS `PageContent` records. The current code has no substantive legal text hard-coded into the route. The current database contains long Privacy and Terms bodies and an Important Information record; their current CMS origin is not traceable from a seed/migration record except for the Important Information text below. Therefore, untraceable current legal bodies are classified UNRESOLVED CMS PROVENANCE, not assumed approved or build-written.

Current publication inventory: `PRIVACY`, `TERMS_OF_USE`, and `IMPORTANT_INFORMATION` are published; no published `ACCESSIBILITY` record was present in the current database, so `/accessibility` is unavailable rather than displaying invented fallback legal copy.

Final rendering path: `Content` in `src/app/(public)/_components.tsx:39-42` sends CMS bodies through `sanitizeRichText` from `src/lib/rich-text.ts`; this is implementation behavior, not a change to the substantive CMS wording.

Seeded `IMPORTANT_INFORMATION` at `prisma/seed.ts:70-73`:

- Heading: `Important Information`
- Body: `Repayment figures are estimates only. Actual repayments, terms and loan approval are subject to SWCU requirements and approval.`
- Body paragraph 2: `SWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.`

The utility route’s code-level fallback title is `Important Information`; it renders no draft or unpublished content. The public footer obtains all four publication flags from the published CMS query.

### Member Login holding page — `/member-login`

Source: `src/app/(public)/member-login/page.tsx`.

**Build-written code**

- Metadata title: `Member App Coming Soon`.
- Eyebrow: `Member App`.
- Heading: `Your SWCU. Wherever you are.`
- Body: `The secure SWCU Member App is a separate future project. Member account services are not part of this public website.`
- Action: `Return to the SWCU website`.

No external Member App URL is connected.

### Shared header, footer, mobile bar, and public shell

Source: `src/app/(public)/_components.tsx`, `src/app/(public)/layout.tsx`.

**Build-written code**

- Header navigation: `Home`; `About SWCU`; `Membership & Services`; `Forms & Resources`; `Contact`.
- Header actions: `Join SWCU`; `Member Login`.
- Mobile labels: `Open menu`; `Close menu`; `Join SWCU`.
- Mobile quick-action labels: `Join`; `Login`; `Call`; fallback `Contact`.
- Footer description: `Service Worker Credit Union. A member-owned credit union serving Fiji members.`
- Footer headings: `Member Services`; `Resources`; `Contact`; `Important Information`.
- Footer links: `Membership`; `Savings`; `Loans`; `Forms & Resources`; `About SWCU`; `Contact`; dynamic legal links.
- Site Notice fallback action: `Learn more`.
- Contact form acknowledgement: `I acknowledge the published Privacy information.`

Publication behavior is dynamic: a legal footer link appears only when the corresponding `PageContent.isPublished` record is present. This is not a provenance issue and should not be changed without a regression.

### Metadata, 404, and public error states

Sources: `src/app/layout.tsx`, `src/app/(public)/metadata.ts`, `src/app/not-found.tsx`, `src/app/(public)/error.tsx`.

**Build-written code**

- Global metadata default title: `Service Worker Credit Union`.
- Global metadata description: `SWCU public website`.
- Global metadata keywords: `Service Worker Credit Union`; `SWCU`; `Fiji credit union`.
- Open Graph site name: `Service Worker Credit Union`.
- 404: `Page not found`; `We could not find that SWCU page.`; `The site or page may not be recognised.`; `Go to SWCU home`.
- Public error: `SWCU website`; `We could not load this page`; `Please try again. If the problem continues, return to the homepage or contact SWCU using the published details.`; `Try again`; `Return home`.

No separate public `loading.tsx` exists. These are functional/error-state strings and are classified BUILD-WRITTEN — CODE.

## 2. Services provenance summary

| Current public card | Description | Database source | Origin | Source location |
|---|---|---|---|---|
| Savings | `Build a steady savings habit with SWCU.` | `services.description` | BUILD-WRITTEN — CMS/SEED | `prisma/seed.ts:103` |
| Loans | `Access member loan support when you need it.` | `services.description` | BUILD-WRITTEN — CMS/SEED | `prisma/seed.ts:104` |
| Retirement Savings | `Plan with a long-term savings mindset.` | `services.description` | BUILD-WRITTEN — CMS/SEED | `prisma/seed.ts:105` |
| Death Benefit Scheme | `Member support for families when it matters.` | `services.description` | BUILD-WRITTEN — CMS/SEED | `prisma/seed.ts:106` |

Stored icon values also originate at the same seed lines: `piggy-bank`, `hand-coins`, `sunset`, `heart-handshake`. Historical pre-4A code had a fallback-only icon renderer; the final current renderer at `src/components/home-experience.tsx:35-47` now has an explicit safe map for all four stored values (plus legacy `wallet`, `landmark`, and `heart`) and retains `PiggyBank` only as the unknown-value fallback. The Services icon bug is therefore resolved; this historical provenance inventory is retained.

## 3. CMS/seed provenance inventory

The following substantive seed-created records are traceable and classified BUILD-WRITTEN — CMS/SEED:

- `prisma/seed.ts:23-73`: About, Membership, Savings, Loans, Retirement Savings, Death Benefit Scheme, and Important Information PageContent records listed above.
- `prisma/migrations/20260919100000_prompt3_final_gate_content/migration.sql:10-44`: the same final-gate About headings/bodies and publication state; BUILD-WRITTEN — CMS/SEED.
- `prisma/migrations/20260919111500_publish_important_information/migration.sql:14-18`: the published Important Information heading/body; BUILD-WRITTEN — CMS/SEED and exact locked text.
- `prisma/seed.ts:89-100`: three HomeHighlight records listed above.
- `prisma/seed.ts:102-114`: four Service records listed above.
- `prisma/seed.ts:116-127`: three FAQ records listed above.
- `prisma/seed.ts:129-132`: tenant organisation `Service Worker Credit Union`.
- `prisma/seed.ts:134-147`: ContactSettings values listed above.
- `prisma/seed.ts:156-159`: CalculatorSettings structural record; its disclaimer is database/configuration content and is not invented by this audit.

No other substantive public copy was found in the Prompt 3 migrations. Current Privacy/Terms content is present in CMS but has no traceable seed/migration origin in the repository scan.

## 4. Member Login/App routing appendix

The final routing authority is `getMemberAppHref()` in `src/lib/public-links.ts:3-8`. It returns `/member-login` unless the tenant setting `memberAppStatus` is `LIVE`, in which case it returns `https://app.swcu.finance`. The current `swcu` setting is `COMING_SOON`, so every current public Member Login/App CTA resolves to `/member-login`; the production app is not connected.

| Location | Label | Current destination | Centralization status | Recommended file(s) |
|---|---|---|---|---|
| Public desktop header | `Member Login` | `/member-login` currently; external app only when status is `LIVE` | Centralized `memberAppHref` prop resolved by `getMemberAppHref()` | `src/app/(public)/_components.tsx:12,22`; `src/app/(public)/layout.tsx:18-19`; `src/lib/public-links.ts:3-8` |
| Public mobile header | `Member Login` via header action/menu context | `/member-login` currently; same LIVE switch | Same centralized helper/prop | `src/app/(public)/_components.tsx:12,22-24` |
| Home hero | `Member Login` | `/member-login` currently; same LIVE switch | Same `getMemberAppHref(data.tenantSettings)` result | `src/components/home-experience.tsx:50,85`; `src/app/(public)/page.tsx:19-23` |
| Mobile sticky quick actions | `Login`; aria label `Sign in to Member Login` | `/member-login` currently; same LIVE switch | Centralized `memberAppHref` prop | `src/app/(public)/_components.tsx:28,32`; `src/app/(public)/layout.tsx:19` |
| Home Member App showcase | `Member App — Coming Soon` / tenant-configured label | `/member-login` currently; `https://app.swcu.finance` only when LIVE | Same `getMemberAppHref()` result; now an actual Link | `src/components/home-experience.tsx:50,118`; `src/app/(public)/page.tsx:19-23` |
| Legacy `SiteHeader` component | `Member Login` | `/member-login` | Legacy `PublicShell` component is not referenced by the current route layout; active public shell uses the centralized component above | `src/components/site-header.tsx:76-80`; `src/components/public-shell.tsx`; `src/app/(public)/layout.tsx` |
| Member Login holding page | `Return to the SWCU website` | `/` | Direct internal Link | `src/app/(public)/member-login/page.tsx:19-21` |

Centralization is complete for the active public shell. Preserve `/member-login` while the Administrator Member App Status is `COMING_SOON`; setting the status to `LIVE` changes the central helper result to `https://app.swcu.finance` without editing each CTA. `memberAppUrl` is retained as tenant configuration but the helper intentionally uses the approved production URL when LIVE.

## 5. Telephone/call appendix

The current stored contact number is `(679) 7730445`. The final centralized helpers in `src/lib/public-links.ts:10-18` produce canonical display `+679 773 0445` and href `tel:+6797730445`.

| Location | Display/current href | Centralization status | Recommended file(s) |
|---|---|---|---|
| Home contact panel | `+679 773 0445` / `tel:+6797730445` | Centralized `formatTelephone()` / `telephoneHref()`; source number remains ContactSettings | `src/components/home-experience.tsx:120`; `src/lib/public-links.ts:10-18` |
| Public Contact page | `+679 773 0445` / `tel:+6797730445` | Same centralized helpers | `src/app/(public)/contact/page.tsx:9,16`; `src/lib/public-links.ts:10-18` |
| Public footer | `+679 773 0445` / `tel:+6797730445` | Same centralized helpers | `src/app/(public)/_components.tsx:10,61`; `src/lib/public-links.ts:10-18` |
| Mobile sticky quick actions | `<span>Call</span>`; aria `Call SWCU at +679 773 0445`; `tel:+6797730445` | Same centralized helpers; ContactSettings value is passed by layout | `src/app/(public)/_components.tsx:10,32`; `src/app/(public)/layout.tsx:19` |
| Contact form | Subject `Request a Call Back`; phone field required for that subject | Functional callback workflow; no direct call href | `src/lib/contact.ts:9,22,97`; `src/app/(public)/_components.tsx:64-66` |

`src/components/site-header.tsx` contains the legacy duplicate Member Login header but no telephone action; it is not used by the active `(public)` layout. No independent hard-coded `7730445` telephone link was found outside seed ContactSettings. Footer contact behavior is final: it uses the central telephone helpers and continues to render legal links only for published CMS records.

## 6. Audit limitations and approval boundary

- Generic interface labels such as `Save`, `Download`, `Open`, `Contact`, `Login`, `Join`, and `Call` are classified GENERIC UI and are not treated as substantive approved copy.
- Current CMS records whose seed/migration provenance is absent are explicitly marked UNRESOLVED CMS PROVENANCE rather than being guessed as owner-approved.
- No public wording was rewritten during this audit.
- No rates, fees, eligibility, scheme limits, Member App URL, or new SWCU facts were invented.