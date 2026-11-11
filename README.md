# xlang-docs

Documentation of the [xlang](https://github.com/hasirciogluhq/xlang) language, compiler (`xlc`) and standard library.

Published at <https://hasirciogluhq.github.io/xlang-docs/>. Every push to `main` builds the site with [Astro Starlight](https://starlight.astro.build) and deploys it through the `pages` workflow (`.github/workflows/pages.yml`). The build validates every internal link and creates the search index.

This repository is mounted as the `xlang-docs/` submodule of the xlang repository.

## Layout

- `src/content/docs/`: the pages (Markdown). The folder path is the URL.
- `astro.config.mjs`: site settings and the sidebar.
- `examples/`: `.xl` programs. A page shows one with a fenced block written as ```` ```xlang file=examples/name.xl ```` and an empty body.
- `src/grammars/xlang.tmLanguage.json`: the highlighting grammar, a copy of `xl-vscode/syntaxes/xlang.tmLanguage.json`.
- `src/plugins/`: the two Markdown plugins (`file=` blocks, base-path links).

## Work on the site

```sh
bun install
bun run dev      # http://localhost:4321/xlang-docs/
bun run build    # static site in dist/, fails on a broken internal link
```

Pagefind (search) needs `npx` on the PATH, so Node must be installed for the full build.
