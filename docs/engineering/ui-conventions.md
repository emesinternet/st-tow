# UI Conventions

## Goals

- Keep visual parity with the established neo/brutalist theme.
- Use shared tokens before introducing one-off sizes.
- Keep sizing, gaps, and radii consistent across panels and controls.

## Token Usage

Defined in `web/src/styles/globals.css` (`:root`):

- Spacing: `--space-1` through `--space-6`
- Radius: `--ui-radius-sm|md|lg`
- Border width: `--ui-border-sm|md|lg`
- Control heights: `--ui-control-h-sm|md|lg`
- Text scale: `--ui-text-xs|sm|md|lg|xl|display`

Use these tokens in class names via arbitrary values, for example:

- `rounded-[var(--ui-radius-md)]`
- `border-[var(--ui-border-lg)]`
- `h-[var(--ui-control-h-md)]`
- `text-[var(--ui-text-sm)]`

## Shared Utilities

Use component utility classes from `globals.css` where possible:

- `ui-stack-1|2|3|4|6`
- `ui-inline-2|3`

## Allowed One-Off Sizing

One-off values are allowed only when all are true:

1. Value is tied to a unique gameplay visual (for example, dragon marker scaling).
2. Existing token scale cannot represent the requirement without visible regression.
3. The component includes a short comment explaining why a token was not used.

## Review Checklist

1. No duplicate hardcoded border/radius systems in new components.
2. Shared primitives (`Button`, `Input`, `Card`, `Badge`, `Toast`, tabs) are used.
3. Spacing rhythm remains consistent between sibling panels.
