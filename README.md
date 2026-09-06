# tw4-doctor

**Know what breaks before you run the Tailwind v4 upgrade.**

`npx @tailwindcss/upgrade` already does the mechanical work well: dependencies,
JS config to CSS, renamed utilities. That is not where projects get hurt.

The damage is in the **changed default values**. They produce no error, no
warning, nothing in the console. The build goes green, the rendering changes, and
the team finds out in QA three weeks later.

`tw4-doctor` migrates nothing. It answers one question, *before* you start:
what will break in this codebase, and what will it cost?

```sh
npx tw4-doctor
```

> Not affiliated with Tailwind Labs. Run this **before** the official upgrade
> tool — they are complementary.

---

## Real output

Run against [`shadcn-ui/taxonomy`](https://github.com/shadcn-ui/taxonomy), a
Next.js + Tailwind v3.3 project, unmodified:

```
tw4-doctor
  ~/taxonomy
  149 files scanned

  Risk  HIGH (55/100)
  Effort ~5.8 h (heuristic)

PILE A — blocking: the build will not pass

  A5  Tailwind plugin with no declared v4 support  (3, ~3 h)
      package.json:1 — third-party plugin — confirm v4 support before migrating
      package.json:1 — folded into core in v3.3 — remove it, `line-clamp-*` is built in
      package.json:1 — official plugin — check for a v4 release

PILE B — silent visual breakage

  B1  Border utility with no colour  (55, ~50 min)
      app/(dashboard)/dashboard/layout.tsx:25 — border-b
      app/(dashboard)/dashboard/layout.tsx:45 — border-t
      app/(docs)/docs/layout.tsx:11 — border-r
      …and 52 more

  B5  hover: as the only interactive state  (23, ~1.2 h)
      app/(auth)/login/page.tsx:43 — no focus: or active: alongside hover:
      components/main-nav.tsx:37 — no focus: or active: alongside hover:
      …and 21 more

  B6  space-*/divide-* combined with a reversed or reordered container  (3, ~24 min)

PILE C — mechanical syntax (the official tool handles these)

  C6  Renamed utilities  (42, ~6 min)
      components/ui/button.tsx:7 — outline-none -> outline-hidden
      components/ui/card.tsx:12 — shadow-sm -> shadow-xs
      …and 40 more
```

Fifty-five borders that will change colour, twenty-three interactive elements
that become unreachable on touch. None of it produces a warning. That is the
whole point of the tool.

---

## The three piles

### Pile A — blocking. The build will not pass.

| | What |
|---|---|
| **A1** | `@apply` inside a Vue/Svelte `<style>` block or a CSS module — needs `@reference` |
| **A2** | Sass or SCSS used with Tailwind — v4 is itself the preprocessor |
| **A3** | Removed config options: `corePlugins`, `safelist`, `separator` |
| **A4** | Browser baseline below Safari 16.4 / Chrome 111 / Firefox 128 |
| **A5** | Tailwind plugins with no declared v4 support |

### Pile B — silent visual breakage. The real subject.

| | v3 | v4 |
|---|---|---|
| **B1** `border` with no colour | gray-200 | `currentColor` |
| **B2** `ring` with no width or colour | 3px blue-500 | 1px `currentColor` |
| **B3** placeholder colour | gray-400 | text colour at 50% |
| **B4** `<button>` cursor | pointer | default |
| **B5** `hover:` as the only state | always applies | wrapped in `@media (hover: hover)` |
| **B6** `space-*` / `divide-*` | `> :not([hidden]) ~ :not([hidden])` | `> :not(:last-child)` |

B2 and B5 are accessibility regressions, not just cosmetic ones: focus rings go
thin and take the text colour, and hover-only elements stop giving any feedback
at all on a touch screen. B6 is reported first where it is combined with
`flex-row-reverse`, `flex-col-reverse` or `order-*`, which is where the selector
change actually moves the spacing to the wrong side.

### Pile C — mechanical syntax.

`@tailwindcss/upgrade` handles all of C1–C8. They are counted here because the
number is what turns "we should migrate at some point" into a figure you can put
in a quote.

`!flex` → `flex!` · `bg-[--x]` → `bg-(--x)` · commas in arbitrary values ·
`@tailwind` → `@import` · `@layer utilities` → `@utility` · the renamed and
removed utilities · stacked variants, which now read left to right.

---

## How classes are found

A regex over the whole file finds `border` inside prose, inside imports, inside
anything. Instead, `tw4-doctor` finds **string literals** and then decides from
the characters in front of each one whether it is a class list:

- `class=`, `className=`, `classList`, Vue's `:class` and `v-bind:class`
- the `clsx` / `cn` / `classnames` / `twMerge` / `cva` / `tv` family, at any
  argument position
- template literals, with `${...}` holes replaced by a space so the utilities
  either side still count
- `@apply` directives, including inside a single-file component's `<style>`
- bare string constants, but only when they read overwhelmingly like utilities

Comments are skipped, so commented-out markup produces no findings. Vue's
`:class="'a b'"` and `:class="{ 'a': cond }"` are unwrapped to the class names
inside. Nothing imports Tailwind: a project mid-upgrade often has a config that
no longer evaluates, and that is exactly when you want to run this.

The tricky part is that some utilities are ambiguous. `border-[2px]` is a width,
`border-[#f00]` is a colour, and both have the same shape — so the value decides.
And `border-input` is a colour, because real projects name their theme colours:
matching against Tailwind's default palette instead flagged every border in a
shadcn codebase, which would have made the rule pure noise on exactly the
projects most likely to run it.

---

## Usage

```sh
npx tw4-doctor                     # audit the current directory
npx tw4-doctor ./apps/web          # audit a specific project
npx tw4-doctor --json              # machine-readable, for CI
npx tw4-doctor --only A,B          # skip the mechanical pile
npx tw4-doctor --fail-on A         # exit 1 if there are blockers
npx tw4-doctor --no-bare-literals  # only attributes and helpers
```

By default it prints a report and writes `tw4-report.md` next to the project.

### As a library

```ts
import { diagnose } from 'tw4-doctor';

const report = await diagnose('./apps/web');
console.log(report.riskLabel, report.estimatedHours);
```

---

## About the effort figures

They are a heuristic and the report says so. A constant number of minutes per
occurrence, with repeats past the tenth discounted to a third — the tenth border
genuinely is faster than the first — and a cap per rule so that one finding
cannot swallow the estimate.

They are meant to size a quote, not to schedule one. An agency with twenty
Tailwind v3 projects in its portfolio is who this is for.

---

## Roadmap

**`tw4-doctor diff` (0.2)** — the mode nothing else offers. Build the project as
it is, apply `@tailwindcss/upgrade` to a copy, build that, screenshot both with
Playwright at matching viewports, and produce a before/after report highlighting
what moved. It is the only way to catch pile B exhaustively, and the official
tool will never do it. The command exists today and tells you it is not
implemented yet.

**`--fix-safe` (0.2)** — apply only the unambiguous pile C rewrites. Never pile
B, which needs a design decision.

## What it does not do

- It does not replace `@tailwindcss/upgrade`. Run this first, that second.
- It changes no file. There is no write path in 0.1.0 at all.
- It never says a project is "ready". It lists risks and counts them.

## Licence

MIT.
