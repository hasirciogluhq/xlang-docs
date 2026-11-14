---
title: xlang Packages
---

A package is a git repository of plain `.xl` source. `xl pkg install github.com/user/repo` downloads its newest release into the project, and `import "github.com/user/repo"` uses it. That is the whole system.

## Vision

- **No registry, no central authority.** A package is named by its repository path. The repository host is the registry.
- **No required layout.** There is no `cmd/`, no workspace, no monorepo or polyrepo rule. A package is a directory with `.xl` files and an `index.xl` at its root, or at the directory its `[package] root` names; `xlang.toml` is optional inside it. Anything this system does, you can also do by hand with `git clone` and a relative import; the tool only saves the typing.
- **The compiler does not care.** The compiler maps an import to a directory (`-M NAME=DIR`); `xl` decides which directory that is.
- **The standard library is installed like the compiler**, per user and per version (`xl lc`, see [Install](/compiler/install/)), and a project can point at another one through `xlang.local.toml`.

## Files

| File | Written by | Committed | Role |
|------|-----------|-----------|------|
| `xlang.toml` | you, and `xl pkg add/install/update/remove` (in place, keeping comments) | yes | the dependencies |
| `xlang.lock` | `xl pkg install/update/remove` | yes | exact tag, commit and source of every downloaded package |
| `xlang.local.toml` | you | no | one developer's overrides: compiler, stdlib, package checkouts, flags |
| `.xlang/cache/` | `xl pkg install` | no | the downloaded sources: `.xlang/cache/<repository>@<tag>/`, or `@<commit>` for a `branch` or `rev` |

The project root is the directory of the nearest `xlang.toml`, searched upward from the current directory (`xl pkg`) or from the file being built (`xl check|build|run|env`). The cache lives in the project root, like `node_modules`; there is no global cache. Without an `xlang.toml`, nothing about packages applies. Put `.xlang/` and `xlang.local.toml` in `.gitignore`.

## xlang.toml

```toml
[package]
name = "myapp"                       # optional, informational
root = "src"                         # optional: imports of this package resolve under src/

[dependencies]
"github.com/user/repo" = "v1.2.0"    # exact release tag
"github.com/user/other" = "latest"   # newest stable release, pinned by xlang.lock
"git.example.org/team/lib" = { version = "v0.3.1", source = "git@git.example.org:team/lib.git" }
"github.com/user/nightly" = { tag = "nightly-2026-11-01" }      # any tag, as written
"github.com/user/edge" = { branch = "main" }                    # a branch head, pinned by xlang.lock
"github.com/user/fixed" = { rev = "3f1c2a9e0b7d4c5a8e6f1b2c3d4e5f60718293a4" }   # one commit
"example.org/me/local" = { path = "../local" }   # a directory on disk, not downloaded
```

Rules:

- Only `[dependencies]` and `root` in `[package]` are read; every other table and key is kept as written.
- A dependency key is a **repository path**: `host.tld/segment/...`. The first segment contains a dot; no segment is empty, `.` or `..`, or contains a space or `\`; `std` is not a dependency name. Keys are quoted (they contain `.` and `/`). A key listed twice is `E0740`.
- A value is a version string, or an inline table with one reference (`version`, `tag`, `branch` or `rev`), `source`, or `path` alone. Two references, or `path` with anything else, is `E0740`. Without a reference the entry is `version = "latest"`. Any other key is `E0740`, so typos do not pass silently.
- The references:

  | Key | Value | Locked as | Moved by `xl pkg update` |
  |-----|-------|-----------|--------------------------|
  | `version` | a release tag (see [Version tags](#version-tags)) or `latest` | the tag and its commit | yes: to the newest stable release |
  | `tag` | any tag, taken as written (`nightly`, `release-7`); not checked against the release format | the tag and its commit | no |
  | `branch` | a branch name | the commit of its head at install time | yes: to the branch's current head |
  | `rev` | a full commit hash: 40 hex digits (SHA-1) or 64 (SHA-256), lowercase | the commit | no |

  An abbreviated `rev` is `E0742`: a prefix can become ambiguous and cannot be fetched by hash. Fetching one commit needs the host to serve commits by hash ([protocol v2](https://git-scm.com/docs/protocol-v2#_fetch)); GitHub, GitLab and local repositories do.
- `source` replaces the default URL `https://<repository path>.git`. It may be any URL `git` understands (ssh, https, `file://`) or a directory (`./` and `../` are relative to the manifest).
- `latest` and `branch` are allowed in a **project** manifest only. A package that others depend on must pin a release tag, a `tag` or a `rev` for its own dependencies (`E0742`). The lock keeps `latest` and `branch` reproducible.
- `[package] root` is the directory, relative to the manifest, where the package's imports resolve: with `root = "src"`, `import "github.com/user/repo"` reads `src/index.xl` and `import "github.com/user/repo/sub"` reads `src/sub.xl`. It is set by the package itself, so its users never write `/src` in an import. It must stay inside the package: an absolute path, a `\`, a `:` or a `..` segment is `E0740`. `"."` and no `root` mean the manifest's directory. It applies wherever the package is used: from the cache, as a `path` dependency, and as a `[modules]` checkout in `xlang.local.toml`. The package's own `xlang.toml` stays at the repository root, next to `root`.
- The file is a TOML subset, one entry per line: bare and basic-quoted keys, basic strings, one-line inline tables and `#` comments. LF and CRLF line ends are both accepted.

## xlang.lock

Written only by `xl pkg`, sorted by name so that it diffs cleanly:

```toml
[[package]]
name = "github.com/user/repo"
version = "v1.2.0"
commit = "3f1c2a9e0b7d4c5a8e6f1b2c3d4e5f60718293a4"
source = "https://github.com/user/repo.git"

[[package]]
name = "github.com/user/inner"
version = "v0.4.1"
commit = "9a8b7c6d5e4f30211223344556677889900aabbc"
source = "https://github.com/user/inner.git"
indirect = true                      # only another package needs it

[[package]]
name = "github.com/user/edge"
branch = "main"                      # the reference as xlang.toml names it: version, tag, branch or rev
commit = "c6c7d298751394a598af806ba7ecf1f26f77cb59"
source = "https://github.com/user/edge.git"
```

A `version` entry records the resolved tag (also for `latest`); a `branch` entry records the commit its head had, which `xl pkg install` keeps and `xl pkg update` moves.

## Version tags

Packages are versioned by git tags and nothing else; there is no version field to keep in sync. Ordering is [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html).

- A release tag is `vMAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH`: `v1.2.0`, `1.2.0`. All three numbers are required.
- A tag with a suffix after `-` (`v1.2.0-rc.1`) is a pre-release; a suffix ending in `test` (`v1.2.0-test`) is a test tag. Neither is ever chosen as `latest`; both install when named exactly: `xl pkg install host/user/repo@v1.2.0-rc.1`.
- `latest` means the highest **stable** release. Tags that are not versions (`main`, `nightly`), pre-releases and test tags are ignored when looking for it. A repository with no stable release tag fails with `E0744` and nothing is written.
- A version that breaks the format (`"main"`, `"1.2"`) in `xlang.toml` or on the command line is `E0742`, before anything is downloaded.
- `v1.0.0` and `1.0.0` are the same version; if both exist, the `v` spelling is used.
- A release tag must never move. The lock stores the commit of each tag; if a tag later points to another commit, installing fails with `E0744`.

## Commands

All commands act on the `xlang.toml` found from the current directory. `add` and `install <repo>` create one in the current directory when there is none.

| Command | Effect |
|---------|--------|
| `xl pkg add <repo[@ref]>...` | Write the entries into `xlang.toml` (`latest` without a ref). `ref` is a release tag, `latest` or a full commit hash (written as `rev`); `tag` and `branch` entries are written by hand. Nothing is downloaded and the lock is not touched. An existing entry keeps its `source`. |
| `xl pkg install` | Download everything `xlang.toml` lists, and what those packages list, and write `xlang.lock`. Locked versions and commits are used; the network is touched only for what the cache lacks. |
| `xl pkg install <repo[@ref]>...` | Add the repositories at their newest stable release (the exact tag is written to `xlang.toml`) or at the given ref, then install. |
| `xl pkg update [repo...]` | Move all (or the named) git dependencies: exact `version` tags are rewritten in `xlang.toml` to the newest stable release, `latest` and `branch` entries ignore the lock, `tag` and `rev` entries stay. Then install. |
| `xl pkg remove <repo>...` | Delete the entries from `xlang.toml` and refresh the lock. Cached sources stay until `clean`. |
| `xl pkg list` | Each locked package with its tag and commit, `[indirect]` for packages only another package needs, `[missing]` when the cache lacks it, and every `path` dependency. Exit status 1 (`E0741`) when something is missing. |
| `xl pkg clean` | Delete `.xlang/cache`. |

`install`, `update` and `remove` write `xlang.toml` and `xlang.lock` only after everything resolved; a failure leaves both untouched. Edits replace or insert single lines, so comments, blank lines, order and other tables survive byte for byte.

**Builds never use the network.** `xl check`, `xl build` and `xl run` read the lock and the cache only. A missing package is `E0741` with the fix `run xl pkg install`. This keeps builds fast, offline and deterministic.

`git` must be on `PATH`. It is run without a shell, never prompts for a password (`GIT_TERMINAL_PROMPT=0`), and uses your normal git configuration, so private repositories work with an SSH key or a credential helper. A download is a shallow clone of the tag; the cache keeps the source tree without `.git`, plus a `.xlang-commit` file with the commit.

## Resolution

- The project's entries are resolved first, then the dependencies of each package, breadth first.
- There is one copy of each repository per build. When a package needs another version of a repository the project itself lists, **the project's version wins**. When the project does not list it and two packages need different versions, resolution stops with `E0743`; the fix is to choose one with `xl pkg add <repo>@<tag>`. There is no automatic "highest version" rule.
- `path` dependencies are used in place (not copied, not locked); the dependencies their own `xlang.toml` lists are resolved like any other package's.

## Using a package

```
from "github.com/user/repo" import connect          // the repository root: index.xl
from "github.com/user/repo/sub" import helper       // sub.xl or sub/index.xl inside it
import "github.com/user/repo" as repo
```

- Every package becomes one compiler module root, `-M <repository>=<directory>`. An import path that equals a repository path, or continues it with `/`, is resolved inside that directory.
- Inside a package, `from "util" import x` is relative to the importing file, as everywhere else. A package imports its own dependencies by repository path.
- A path that names no file is `E0711`.
- The module key of a package file is its import path (`github.com/user/repo/sub`), which is also what appears in mangled names.

## xlang.local.toml

One developer's overrides for one checkout, next to `xlang.toml` and never committed. Every key is optional:

```toml
[toolchain]
xlc = "../xlc/build/macosx/arm64/release/xlc"   # a compiler binary in place of the installed one
std = "../xl-std/src"                           # a stdlib directory in place of the installed one (root = "src")

[modules]
"github.com/user/repo" = "../repo"              # a checkout in place of a package, or one more module root

[build]
flags = ["--safety=unchecked", "-DdebugLog=true"]   # appended to every xlc call
```

- Paths that start with `./` or `../` are relative to the project directory.
- A `[modules]` entry replaces the package of the same name (the cache is not needed for it, so a missing package stops being an error) or adds a new root.
- Any other table or key is `E0740` with the line.
- `$XLC`, `$XLANG_STD` and `--std=<dir>` still win over it; see [the build environment](/compiler/cli/#the-build-environment). `xl env` shows the result.

## Diagnostics

| Code | Meaning |
|------|---------|
| `E0740` | invalid `xlang.toml`, `xlang.lock` or `xlang.local.toml` line, a bad repository path, an unknown dependency in `update`/`remove`, no `xlang.toml` |
| `E0741` | a package is not installed, or its cache directory holds another commit than the lock says |
| `E0742` | a version is not in the tag format, an empty `tag` or `branch`, a `rev` that is not a full commit hash, or `latest`/`branch` where a pinned reference is required |
| `E0743` | two packages need different versions of a repository the project does not list |
| `E0744` | `git` failed, no stable release tag, no such branch, a commit the host does not serve by hash, a tag moved to another commit, or the download could not be moved into the cache |

## Questions

- **My library keeps its code under `src/`. Can others import it?** Yes: set `root = "src"` in the `[package]` table of the library's `xlang.toml`. Without it, the repository root is the import root and users would have to write `import "github.com/user/repo/src"`.
- **Where do packages go?** `<project root>/.xlang/cache/<repository path>@<tag>/` (`@<commit>` for a `branch` or `rev`). Delete the directory any time; `xl pkg install` restores it from the lock.
- **Is the download verified?** The commit of the tag is recorded in `xlang.lock`. A cache that disagrees with the lock is `E0741`; a tag that moved is `E0744`. There are no separate checksums or signatures.
- **How do I publish?** Push a tag such as `v1.0.0`. There is no publish command.
- **Can I use a package that is not on a git host?** Put it in a directory and use `{ path = "..." }`, or point `source` at any URL or directory `git` can clone.
- **Can I use a fork or a mirror?** Set `source` for that dependency, or map a local checkout in `xlang.local.toml`.
- **What if I do not want the tool at all?** Clone the repository yourself and pass `-M github.com/user/repo=<dir>` to `xlc`. The compiler needs no manifest.
- **Monorepos?** The repository root is the package; `import "host/user/repo/sub"` reaches into it. There are no workspaces and no sub-packages with their own versions.

## Related documents

| Document | Role |
|----------|------|
| [The xl tool](/compiler/cli/) | `xl check/build/run/env` and the build environment |
| [Language Reference](/language/) | import syntax and module resolution |
| [Install](/compiler/install/) | installing `xl`, the compiler and the stdlib |
