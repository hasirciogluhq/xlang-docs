import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin: prefixes root-relative Markdown links (`/std/strings/`) with the site `base`, so pages link
 * to each other without knowing where the site is served (`/xlang-docs` on GitHub Pages, `/` elsewhere).
 */
export const baseLinks = (base: string) => () => (tree: Root) => {
  const prefix = base.replace(/\/$/, '');
  visit(tree, 'link', (node) => {
    if (node.url.startsWith('/') && !node.url.startsWith('//')) node.url = prefix + node.url;
  });
};
