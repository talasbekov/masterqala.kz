# Fixed 55-route × locale remaining checklist

Baseline: published 20d85b652429750bd6ed2ba7f0ada6ed54db8fb2; local owned-orders batch adds scoped coverage for two routes. Buckets: 16 dependency-gated, 28 unimplemented parity/locales, 11 scoped implementations. Source/static inventory, not rendered acceptance. Verified means only the named scoped implementation/tests, never whole-route/Figma readiness. Every route still requires permitted native geometry/live evidence.

Dictionary leaves: Next client RU256 /KK113 /EN113; common,newOrder,profile,addresses,navigation complete, auth24/25 (splashTagline missing),11other sections fallback. Vite RU218 /KK45 /EN45; common/newOrder and the four visible tabs are complete; home has only the new-request aria-label, and other sections remain incomplete. Owned orders uses the separate shared dictionary. Shared direct-order dictionary is separate and supports all3languages.

| Bucket | App / route | RU/KK/EN evidence | Gate / remaining boundary |
| --- | --- | --- | --- |
| Blocked dependency | client `/payments` | RU present; KK/EN page sections fall back to RU | Commercial/archived-payment design held; no policy changes |
| Blocked dependency | client `/planned/[id]` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | client `/planned/[id]/compare` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | client `/planned/[id]/dispute` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | client `/planned/new` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | master `/lead-credits` | Mostly hardcoded RU; selected shared labels only | Commercial/archived-payment design held; no policy changes |
| Blocked dependency | master `/wallet` | Mostly hardcoded RU; selected shared labels only | Commercial/archived-payment design held; no policy changes |
| Blocked dependency | operator `/security` | Hardcoded RU; no full KK/EN resource path mapped | ADMIN/last-admin design held; no role changes |
| Blocked dependency | operator `/users` | Hardcoded RU; no full KK/EN resource path mapped | ADMIN/last-admin design held; no role changes |
| Blocked dependency | operator `/withdrawals` | Hardcoded RU; no full KK/EN resource path mapped | Commercial/archived-payment design held; no policy changes |
| Blocked dependency | site `/` | Hardcoded RU; no full KK/EN resource path mapped | Original homepage images unavailable |
| Blocked dependency | web `/planned/:id` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | web `/planned/:id/compare` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | web `/planned/:id/dispute` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | web `/planned/new` | RU present; KK/EN page sections fall back to RU | Planned v2 design/explicit-acceptance contract held |
| Blocked dependency | web `/profile/payments` | RU present; KK/EN page sections fall back to RU | Commercial/archived-payment design held; no policy changes |
| Unimplemented parity/locales | client `/` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | client `/catalog` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | client `/notifications` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | client `/order/[id]/dispute` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/orders` | Shared RU/KK/EN active/history, truthful amounts, owner-safe partial GET/retry; mounted route tests | Native geometry/live APIs and full desktop controls/assets unverified |
| Unimplemented parity/locales | client `/support` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | master `/` | Mostly hardcoded RU; selected shared labels only | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | master `/become-master` | Mostly hardcoded RU; selected shared labels only | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | master `/disputes` | Mostly hardcoded RU; selected shared labels only | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | master `/disputes/[id]` | Mostly hardcoded RU; selected shared labels only | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | master `/login` | Mostly hardcoded RU; selected shared labels only | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/disputes` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/journal` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/login` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/masters` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/orders` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | operator `/verification` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | site `/about` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | site `/become-a-master` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | site `/categories/[slug]` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | site `/faq` | Hardcoded RU; no full KK/EN resource path mapped | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/catalog` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/notifications` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/order/:id/dispute` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | web `/orders` | Shared RU/KK/EN active/history, truthful amounts, owner-safe partial GET/retry; mounted route tests | Native geometry/live APIs and full desktop controls/assets unverified |
| Unimplemented parity/locales | web `/profile` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/profile/addresses` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Unimplemented parity/locales | web `/support` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/addresses` | RU/KK/EN section complete; reviewed form interactions | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/login` | RU/KK/EN auth24/25; unused splashTagline missing | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/order/[id]` | Shared direct branch RU/KK/EN; legacy orderDetail RU fallback | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/order/new` | RU/KK/EN newOrder35+common5; server content remains actual | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | client `/profile` | RU/KK/EN section complete; reviewed form interactions | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | master `/order/[id]` | Shared direct view RU/KK/EN | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | web `/login` | RU present; KK/EN page sections fall back to RU | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | web `/order/:id` | Shared direct branch RU/KK/EN; legacy orderDetail RU fallback | Native rendered/live acceptance unverified (global) |
| Verified scoped implementation | web `/order/new` | RU/KK/EN newOrder35+common5; server content actual | Native rendered/live acceptance unverified (global) |

Owned-orders batch now implements active/history, authoritative versioned direct totals, unknown prequote, legacy/planned price selection, independent partial GET outcomes, owner isolation and accessible detail links in both routes. This is scoped source/DOM evidence. Desktop All/Planned filters, planned CTA/side-card placement, original card/nav icons and Vite desktop shell remain incomplete. Every route still requires native rendered/live acceptance. Remaining nonlifecycle priorities require separate bounded design review; the 55-route denominator remains fixed.
