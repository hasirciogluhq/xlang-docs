# Contributing to xlang-docs

The documentation is licensed under the [Apache License 2.0](LICENSE). Unless you state otherwise, any contribution you submit is licensed under the same terms (Apache-2.0 §5).

## Rules

- Plain, professional Markdown in English. Every page starts with front matter `title:` and has no `# ` heading.
- A new page goes into the `sidebar` of `astro.config.mjs` and into `src/content/docs/index.md` in the same change.
- Internal links are root-relative without extension (`/std/strings/`); the build fails on a broken link.
- Code comes from `examples/` with a fenced block ```` ```xlang file=examples/name.xl ```` and an empty body.
- Docs follow the code: when behavior changes, the old form is removed completely.

## Workflow

1. Fork, branch from `main`, keep the change focused.
2. Check the site: `bun install && bun run build` (Node is needed for the search index).
3. Open a pull request against `main` and fill in the template.

## Security and conduct

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
