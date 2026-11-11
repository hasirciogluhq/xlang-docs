# xlang-docs — notes for Claude

## Language of work
- Repo content is English. User chat is Turkish.

## Purpose
- The only documentation of xlang, published as a GitHub Pages site (Astro Starlight, built and deployed by `.github/workflows/pages.yml` on every push to `main`): `src/content/docs/language/`, `compiler/`, `std/`, and `known-limitations.md` (open decisions and intentional incompleteness only).
- This repository is mounted as the `xlang-docs/` submodule of https://github.com/hasirciogluhq/xlang. Examples live in the xlang repository (`test/e2e/`) and in `examples/` here.

## Rules
- Plain, professional Markdown. Every page starts with front matter `title:` and has no `# ` heading (Starlight renders the title). A new page goes into the `sidebar` of `astro.config.mjs` and into `src/content/docs/index.md` in the same change.
- Internal links are root-relative without extension (`/std/strings/`, `/language/#try--catch`); the build adds the base path and fails on a broken link. Code from `examples/` is shown with a fenced block ```` ```xlang file=examples/name.xl ```` and an empty body.
- Check with `bun run build` (needs Node for the Pagefind search index).
- Docs follow the code: when xlang behavior changes, the old form is removed completely, with no note about it.
- The site is served under `/xlang-docs` (`base` in `astro.config.mjs`).

## Git
- Never add `Co-Authored-By` trailers or any "Generated with Claude Code" line to commits or PR descriptions.
- Never force-push or rewrite published history without an explicit request.

## Editing
- File edits use the built-in Read/Edit/Write tools. Bash is for build, inspect, and moving or deleting whole files.
