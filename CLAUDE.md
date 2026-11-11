# xlang-docs — notes for Claude

## Language of work
- Repo content is English. User chat is Turkish.

## Purpose
- The only documentation of xlang, published as a GitHub Pages site (Jekyll, deployed by `.github/workflows/pages.yml` on every push to `main`): `language/`, `compiler/`, `std/`, and `known-limitations.md` (open decisions and intentional incompleteness only).
- This repository is mounted as the `xlang-docs/` submodule of https://github.com/hasirciogluhq/xlang. Examples live in the xlang repository (`test/e2e/`) and in `examples/` here.

## Rules
- Plain, professional Markdown. A new page goes into `_data/nav.yml` and `index.md` in the same change.
- Docs follow the code: when xlang behavior changes, the old form is removed completely, with no note about it.
- The site is served under `/xlang-docs` (`baseurl` in `_config.yml`).

## Git
- Never add `Co-Authored-By` trailers or any "Generated with Claude Code" line to commits or PR descriptions.
- Never force-push or rewrite published history without an explicit request.

## Editing
- File edits use the built-in Read/Edit/Write tools. Bash is for build, inspect, and moving or deleting whole files.
