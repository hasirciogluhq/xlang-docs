import { readFileSync } from 'node:fs';
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

const repoRoot = new URL('../../', import.meta.url);

/**
 * Remark plugin: a fenced block written as ```` ```xlang file=examples/hello.xl ```` (empty body) shows the content
 * of that file, with the path relative to the repository root. The code on the page is then the code in the repository.
 */
export const codeFiles = () => (tree: Root) => {
  visit(tree, 'code', (node) => {
    const path = node.meta?.match(/(?:^|\s)file=(\S+)/)?.[1];
    if (!path) return;
    node.value = readFileSync(new URL(path, repoRoot), 'utf8').trimEnd();
    node.meta = null;
  });
};
