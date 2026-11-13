// Documentation site of xlang: Astro + Starlight, built to static HTML and served by GitHub Pages under /xlang-docs.
// The sidebar below is the menu of the site: a new page goes here and in src/content/docs/index.md in the same change.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { baseLinks } from './src/plugins/base-links.ts';
import { codeFiles } from './src/plugins/code-files.ts';

const base = '/xlang-docs';

// TextMate grammar of `.xl` (the one the VS Code extension ships), registered as the `xlang` code-block language.
const xlang = {
  ...JSON.parse(readFileSync(new URL('./src/grammars/xlang.tmLanguage.json', import.meta.url), 'utf8')),
  aliases: ['xl'],
};

const page = (slug, label) => ({ slug, label });

export default defineConfig({
  site: 'https://hasirciogluhq.github.io',
  base,
  trailingSlash: 'always',
  markdown: { remarkPlugins: [codeFiles, baseLinks(base)] },
  integrations: [
    starlight({
      title: 'xlang',
      description: 'Documentation for the xlang language, compiler and standard library.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/hasirciogluhq/xlang' }],
      editLink: { baseUrl: 'https://github.com/hasirciogluhq/xlang-docs/edit/main/' },
      lastUpdated: true,
      expressiveCode: { shiki: { langs: [xlang] } },
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: true })],
      sidebar: [
        { label: 'Start', items: [page('index', 'Overview')] },
        {
          label: 'Language',
          items: [
            page('examples', 'Examples'),
            page('language', 'Language reference'),
            page('language/classes', 'Classes'),
            page('language/defer', 'defer'),
            page('language/entry', 'Entry point'),
            page('language/variadic', 'Variadic functions'),
          ],
        },
        {
          label: 'Compiler',
          items: [
            page('compiler/install', 'Install'),
            page('compiler/cli', 'The xl tool'),
            page('compiler/linking', 'Linking'),
            page('compiler/packages', 'Packages'),
            page('compiler/runtime', 'Runtime'),
            page('compiler/testing', 'Testing'),
            page('known-limitations', 'Known limitations'),
          ],
        },
        {
          label: 'Standard library',
          items: [
            page('std', 'Overview'),
            page('std/strings', 'Strings'),
            page('std/collections', 'Collections'),
            page('std/crypto', 'Cryptography'),
            page('std/math', 'Mathematics'),
            page('std/auth', 'Authentication tokens'),
            page('std/compress', 'Compression'),
            page('std/archive', 'Archives (tar, zip)'),
            page('std/files', 'Files and arguments'),
            page('std/encoding', 'Encodings'),
            page('std/cpu', 'CPU features'),
            page('std/system', 'System information'),
            page('std/process', 'Processes'),
            page('std/time', 'Date and time'),
            page('std/semver', 'Versions (SemVer)'),
            page('std/protocols', 'Network protocol messages'),
            page('std/random', 'Random and identifiers'),
            page('std/event-loop', 'Event polling'),
            page('std/tls', 'TLS'),
            page('std/http', 'HTTP'),
            page('std/http-audit', 'HTTP audit (RFC 9110, 9112)'),
            page('std/cloud', 'Cloud storage (S3)'),
            page('std/syscalls', 'System calls'),
            page('std/syscalls/linux-x86_64', 'Linux x86-64 numbers'),
            page('std/syscalls/linux-arm64', 'Linux arm64 numbers'),
            page('std/syscalls/macos-xnu', 'macOS (XNU) numbers'),
          ],
        },
      ],
    }),
  ],
});
