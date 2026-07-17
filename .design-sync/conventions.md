## Wrapping and setup

No provider or root wrapper is required — `@masterqala/ui` has no context/theme provider. Every visual value comes from CSS custom properties defined once in `tokens.css` (bundled at the project root as part of `styles.css`'s import closure) and consumed as Tailwind utility classes inside each component's own JSX. Just render components directly:

```tsx
import { Button, Card, Avatar, StatusPill } from '@masterqala/ui';
```

The only gotcha: components render unstyled if `styles.css` isn't loaded — always import it once at the app root (`import '@masterqala/ui/styles.css'` when consuming the raw npm package; in this design surface it's already wired into the page shell).

## Styling idiom

Tailwind CSS v4 utility classes, driven by a fixed set of named design tokens (defined via `@theme` in `tokens.css`, not the default Tailwind palette — never use `teal-*`, `gray-*`, `orange-*`, etc., only these):

| Token | Hex | Use |
|---|---|---|
| `bg-primary` / `text-primary` / `border-primary` | `#1E40AF` | trust/calm — secondary actions, info status |
| `bg-primary-light` / `text-primary-light` | `#3B82F6` | lighter accent of primary |
| `bg-accent` / `text-accent` | `#EA580C` | urgent/primary action (e.g. the main CTA button) |
| `bg-background` | `#FFFCF5` | warm page background (never plain white) |
| `bg-surface` | `#FFFFFF` | card/input surface |
| `text-foreground` | `#1B1B1F` | primary text |
| `text-muted` | `#8A8A8F` | secondary/caption text |
| `border-border` | `#F0EAE0` | default border color |
| `bg-success` / `text-success` | `#059669` | completed/positive status |
| `bg-destructive` / `text-destructive` | `#DC2626` | errors, cancel, danger actions |

Radii: `rounded-sm` (10px), `rounded-md` (14px), `rounded-lg` (18px) — overridden from Tailwind's defaults, always use these three, never `rounded-xl`/`2xl`/etc. Buttons and pills use `rounded-full`.

Shadow: `shadow-card` (soft `0 2px 8px rgba(20,20,30,0.06)`) — the only shadow this system uses; avoid Tailwind's default `shadow-sm/md/lg`.

Font: `Manrope` is the only typeface (`--font-sans`), already applied at the document `body` level — no `font-sans` utility needed on individual elements.

Opacity-tinted backgrounds (`bg-primary/10`, `bg-accent/5`, `bg-destructive/40`) are the standard pattern for soft-tinted banners/badges rather than introducing new token colors.

## Where the truth lives

- `tokens.css` (project root, `@theme` block) — the canonical token definitions.
- `styles.css` — import entry that pulls in tokens + compiled component CSS; always load this once.
- Each component's own `.d.ts` in `components/<group>/<Name>/` — the exact prop contract.

## Idiomatic build snippet

A composed order card exactly as the real app renders it (client-facing order tracking):

```tsx
import { Card, Avatar, StatusPill } from '@masterqala/ui';

function ActiveOrderCard({ order }) {
  return (
    <Card className="flex items-center gap-3">
      <Avatar name={order.masterName} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-foreground">{order.category}</div>
        <div className="truncate text-sm text-muted">{order.address}</div>
        <div className="mt-1.5">
          <StatusPill variant="active">{order.statusLabel}</StatusPill>
        </div>
      </div>
    </Card>
  );
}
```

`StatusPill`'s `variant` is one of `'info' | 'active' | 'success' | 'danger'` — map your own status/state vocabulary onto these four semantic buckets (info = neutral/waiting, active = in-progress/urgent, success = done, danger = error/cancelled) rather than inventing new colors.
