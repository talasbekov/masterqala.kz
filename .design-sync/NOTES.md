# Design-sync notes — @masterqala/ui

## Known render warns

- `[RENDER_THIN]` on `WrenchIcon`, `BoltIcon`, `MoreIcon`, `HomeIcon`, `ListIcon`, `UserIcon`, `ChevronRightIcon` — all 7 icon components. These are legitimately textless (pure SVG monoline icons, no text content ever). Confirmed benign by eyeballing the contact sheet and each component's individual review screenshot (`ds-bundle/_screenshots/review/general__<Name>.png`) — every icon renders its correct shape and color (stroke `currentColor`, sized via the preview's className). Not a bug; the heuristic just can't distinguish "no text" from "broken" for icon-only components. A future re-sync should expect this warn to keep appearing for these 7 names and not treat it as new.

## Font substitution

- Manrope isn't shipped by the app as a bundled `@font-face` anywhere in the repo — `apps/web/index.html` loads it at runtime via a Google Fonts `<link>` tag. For the design-system bundle to render correctly standalone (outside `apps/web`), real woff2 files were fetched from `fonts.googleapis.com`/`fonts.gstatic.com` and committed to `packages/ui/fonts/` (see `extraFonts` in config.json), covering weights 400/500/600/700/800, **latin + cyrillic subsets only** (the app's content is Russian/English — no need for cyrillic-ext, greek, or vietnamese subsets). If a future page needs another script, extend `packages/ui/fonts/manrope.css` and re-fetch the missing subset the same way (`curl` the Google Fonts css2 endpoint with a legacy-Firefox User-Agent to get discrete static woff2 URLs per weight instead of one variable-font file).

## Re-sync risks

- The font files in `packages/ui/fonts/` are a point-in-time fetch from Google Fonts — if Manrope's hosted files ever change URLs/hashes upstream, nothing here would notice; they're committed as static assets, not re-fetched on re-sync.
- `packages/ui`'s `typescript` devDependency is pinned to `~6.0.2` (not the newest available) because `tsup`'s `--dts` step (via `rollup-plugin-dts`) crashed against a newer `typescript@7.0.2` canary that was resolved by default. If bumping `typescript` in `packages/ui/package.json`, re-run `pnpm --filter @masterqala/ui build` and confirm `dist/index.d.ts` is still emitted before re-syncing.
- Preview compositions in `.design-sync/previews/*.tsx` use realistic Russian copy pulled from the real app pages (e.g. Card's "Протечка крана" / "Мастер в пути" mirrors `HomePage.tsx`'s active-order card). If the real page copy changes, these previews will silently drift from what the app actually shows — not a functional problem (previews are illustrative, not tested against the app), but worth eyeballing on a future re-sync if the app's copy has moved on.
