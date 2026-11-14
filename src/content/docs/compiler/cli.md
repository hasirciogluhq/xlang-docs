---
title: The xl tool
---

`xl` is the one command a user runs. It scaffolds a new project (`xl new`, `xl init`), installs the compiler (`xl lc`) and the standard library (`xl std`), manages packages (`xl pkg`), builds and runs programs through the compiler `xlc` (`xl check`, `xl build`, `xl run`), runs test files (`xl test`), reports what a build would use (`xl env`) and updates itself (`xl self-update`). `xl` is written in xlang; its sources are `src/` of the xlang repository.

```
xl new <name> [main|lib]             a new project in <name>/ (`xl new lib`: a library in lib/)
xl init [main|lib]                   a new project in the current directory
xl run [flags] [file.xl] [args...]   build and run a program; arguments after the file go to it
xl build [flags] [file.xl]           build an executable (or what --emit asks for)
xl check [flags] [file.xl]           type-check without writing anything
xl test [flags] [patterns...]        build and run the *.test.xl files, several at a time
xl env [--json] [file.xl]            the compiler, stdlib and module roots a build of the file uses
xl pkg <command>                     packages: add, install, update, remove, list, clean
xl lc <command>                      the compiler: install, update, list, use
xl std <command>                     the standard library: install, update, list, use
xl self-update [--check] [--force]   replace this xl with the newest release
xl version                           print the version
```

`xl <command> --help` describes a command. Installing `xl` and the toolchain: [Install](/compiler/install/). Packages and `xlang.local.toml`: [Packages](/compiler/packages/).

## Scaffolding: `new`, `init`

```bash
xl new hello          # an executable project in hello/: xlang.toml, src/main.xl, .gitignore
xl new mylib lib      # a library project in mylib/: xlang.toml, src/lib.xl, src/index.xl, .gitignore
xl init               # the same, in the current directory (its name is the directory's name)
xl init lib           # a library project in the current directory
```

- **The kind.** `main` (an executable, the default) writes `src/main.xl`; `lib` (a package others import) writes `src/lib.xl` and an `index.xl` that re-exports it. Both write an `xlang.toml` with `[package] root = "src"` and a `.gitignore` that ignores `.xlang/`. Without a kind and with a terminal, `xl` asks `main or lib?`; without a terminal (a script, CI) the kind is `main`.
- **Nothing is overwritten.** A directory that already has an `xlang.toml`, or a `src/main.xl`, `src/lib.xl` or `src/index.xl`, is refused (`E0740`), and nothing is written. `new` also refuses an existing directory that is not empty; `init` works in place by definition.
- **`xl run` finds the program.** Without a file, `xl run`, `xl build` and `xl check` use `main.xl` of the project root, then `main.xl` of its `[package] root` — the scaffolded `src/main.xl` — then `main.xl` of the current directory.
- **Next steps.** An executable runs with `xl run`. A library is pushed as a repository and added to a project with `xl pkg add <host/user/repo>` ([Packages](/compiler/packages/)).

## Building: `check`, `build`, `run`

```bash
xl check                          # main.xl of the project root (or of the current directory)
xl build app.xl -O2 -o app        # flags on both sides of the file
xl run -O2 tool.xl input.txt -v   # input.txt and -v go to the program
xl run -- --port 8080             # main.xl, with arguments that look like flags
```

- **The file.** The program root is the `.xl` file named on the command line. Without one, `main.xl` of the project root (the directory of the nearest `xlang.toml` above the current directory) is used, then `main.xl` of the current directory. A missing file is `E0711`.
- **Flags** are the compiler's own (`xlc --help`: `-O2`, `-o out`, `--emit=obj`, `-D NAME=VALUE`, `--target`, `--safety`, ...) and pass through unchanged, in order. `--std=<dir>` is xl's: it replaces the stdlib for this call (see [the build environment](#the-build-environment)). `check` and `build` take flags before and after the file, and pass any other argument to the compiler as a prebuilt object or library to link (`xl build app.xl vendor/libz.a`); see [Linking](/compiler/linking/).
- **`run`** builds the program into a private temporary directory (`$TMPDIR`, `%TEMP%` on Windows), runs it with the remaining arguments and removes the directory afterwards. Everything after the file, or after `--`, belongs to the program, so `xl run app.xl --help` passes `--help` to `app`. The program's exit status becomes xl's; a failed compile returns the compiler's status.
- **No network.** Builds read `xlang.lock` and `.xlang/cache` only. A package that is not in the cache is `E0741` with the fix `run xl pkg install`.
- `XL_VERBOSE=1` prints the full `xlc` command line before running it.

Every build hands the compiler its environment, then the caller's flags:

```
xlc <file> <objects and libraries> -M std=<stdlib> --import std -DfeatureDefaultAllocator=true \
    -M <repository>=<dir> ...  <[build] flags of xlang.local.toml>  <your flags>
```

## Testing: `xl test`

```bash
xl test                              # every *.test.xl under the current directory
xl test net/ json                    # the files under net/, and the files whose path contains "json"
xl test 'crypto/**/*.test.xl' -x rsa # a glob, without the files that contain "rsa"
xl test -q -j 4 --fail-fast          # 4 at a time, output of failures only, stop at the first failure
xl test --list 'tls*'                # print the selection; a glob without / matches a name at any depth
xl test -O2 --safety=checked         # compiler flags apply to every file
```

A test file is a program named `*.test.xl` whose exit status says whether it passed; [`std/testing`](/compiler/testing/) gives it a suite and a report. `xl test` builds each selected file with the same environment as `xl build` (the project's stdlib, packages and `xlang.local.toml`), runs it, and prints one result line per file, in file order:

```
 PASS  a.test.xl (338 ms)
 FAIL  net/broken.test.xl (build failed)
 FAIL  net/fail.test.xl (exit 1)

Tests  2 failed, 3 passed (5 files, 8 at a time)
Time   812 ms
  x net/broken.test.xl
  x net/fail.test.xl
```

- **Patterns.** A file selects itself. A directory selects every test file under it. A glob (any pattern with `*` or `?`) is matched against the path from the current directory: `*` and `?` stay inside one path segment and `**` spans any number of segments; a glob without `/` matches a name at any depth (`'ok*'` selects `net/http/ok.test.xl`), a glob that matches a directory selects the test files under it, and a glob ending in `.xl` also selects files that are not named `*.test.xl`. Anything else selects the test files whose path contains it. Several patterns add up; a pattern that selects nothing is `E0711`. Without a pattern every test file under the current directory runs. Directories named `build` or `node_modules`, or starting with `.`, are not searched.
- **Output.** Each file builds and runs in its own temporary directory, with stdin the null device. The compiler's diagnostics and the program's output go to a log that is printed under the file's result line, so parallel runs never interleave. A failure line says why: `build failed`, `exit N`, `killed by signal N`.
- **Colors** are on when stdout is a terminal and `NO_COLOR` is not set; the test programs are then built with the compiler's `--color=always`, and otherwise with `-DxlTestNoColor`, which turns off the colors of `std/testing`.
- **Exit status** is 0 when every selected file built and passed, 1 otherwise (also when `--fail-fast` skipped files).

| Flag | Meaning |
|------|---------|
| `-x`, `--exclude <pattern>` | drop the files the pattern selects; repeatable, same forms as a pattern |
| `-j`, `--jobs <n>` | build and run `n` files at once (default: one per CPU) |
| `-q`, `--quiet` | print a file's output only when it fails |
| `--fail-fast` | after the first failure, end the files still building or running and start no more |
| `--list` | print the selected files, one per line, and run nothing |
| `--no-color` | plain output |
| `--std=<dir>` | replace the stdlib, as for `xl build` |
| `-- <args...>` | pass the arguments to every test program |

Every other flag goes to the compiler for each file (`-O2`, `-D NAME=VALUE`, `--safety=checked`, `--target`, ...). `-o`, `--output`, `--emit` and `--check` are `E0740`, because `xl test` chooses each file's executable itself. Values take the forms `-j 4`, `-j4`, `--jobs 4` and `--jobs=4`.

## The build environment

The compiler, the stdlib, the package roots and the extra flags of a file come from five layers. Each replaces what it names, lowest first:

| Layer | Sets | Source |
|-------|------|--------|
| 1. The active toolchain | compiler, stdlib | `$XLANG_HOME/toolchain.toml` (`xlc = "<tag>"`, `std = "<tag>"`), written by `xl lc` and `xl std` |
| 2. `xlang.toml` | package roots | each `xlang.lock` entry maps to `.xlang/cache/<repository>@<tag>`, each `path` dependency to its directory |
| 3. `xlang.local.toml` | compiler, stdlib, package roots, flags | `[toolchain] xlc/std`, `[modules]`, `[build] flags` ([Packages](/compiler/packages/#xlanglocaltoml)) |
| 4. Environment | compiler, stdlib | `$XLC` (a compiler binary), `$XLANG_STD` (a stdlib directory) |
| 5. Command line | stdlib | `--std=<dir>` |

`$XLANG_HOME` defaults to `~/.xlang` (`%USERPROFILE%\.xlang` on Windows). Without a compiler the build stops with `E0790`; a stdlib directory without `index.xl` is `E0790` as well.

## `xl env`

```bash
xl env [--json] [--std=<dir>] [file.xl]
```

Prints the environment a build of the file would use, without building. A project that is not ready (no toolchain, a package missing from the cache) is reported in the output, not as a failure, because editors ask for every file they open; the exit status is 0 unless the arguments are wrong.

The text form has one `name value` line per item (`file`, `project`, `xlc`, `std`, one `module` per root, one `flag` per local flag, one `missing` per absent package, and `problem`). `--json` prints one compact JSON object, which the VS Code extension reads:

| Key | Type | Meaning |
|-----|------|---------|
| `file` | string | the absolute path of the program root |
| `project` | string | the directory of `xlang.toml`; empty outside a project |
| `xlc` | string | the compiler binary |
| `xlcTag` | string | its toolchain tag; empty when layer 3–5 chose the compiler |
| `std` | string | the stdlib directory |
| `stdTag` | string | its toolchain tag; empty when layer 3–5 chose the stdlib |
| `modules` | `[{name, dir}]` | the package roots, `std` not included |
| `flags` | `[string]` | `[build] flags` of `xlang.local.toml` |
| `arguments` | `[string]` | every compiler argument but the file and the caller's flags |
| `missing` | `[string]` | packages the project needs that are not in the cache |
| `problem` | string or null | why a build cannot start, as `error[CODE]: message (fix: ...)` |

```json
{"file":"/p/main.xl","project":"/p","xlc":"/home/u/.xlang/xlc/v1.0.0/xlc","xlcTag":"v1.0.0","std":"/home/u/.xlang/std/v1.2.2","stdTag":"v1.2.2","modules":[{"name":"github.com/u/a","dir":"/p/.xlang/cache/github.com/u/a@v1.0.0"}],"flags":[],"arguments":["-M","std=/home/u/.xlang/std/v1.2.2","--import","std","-DfeatureDefaultAllocator=true","-M","github.com/u/a=/p/.xlang/cache/github.com/u/a@v1.0.0"],"missing":[],"problem":null}
```

## Errors and exit status

xl's own errors print as `error[CODE]: message` and a `fix:` line, and exit with 1; a wrong command line (`xl` alone, an unknown command) exits with 2. The compiler's diagnostics are printed by the compiler itself, and its status is passed on.

| Code | Meaning |
|------|---------|
| `E0711` | the program root does not exist, or there is no `main.xl` to default to |
| `E0740` | a bad argument, or an invalid `xlang.toml`, `xlang.lock` or `xlang.local.toml` line |
| `E0741` – `E0744` | package errors, see [Packages](/compiler/packages/#diagnostics) |
| `E0790` | no compiler or stdlib installed, or the named one does not exist; also a compiler that cannot be started |
| `E0791` | a release could not be found or downloaded (network, unknown tag, `$XLANG_MIRROR` without it) |
| `E0792` | a downloaded asset is not listed in, or does not match, the release's `checksums.txt`, or is not an archive |
| `E0793` | an install or update could not be completed: a broken release, a binary that does not start or reports another version, a directory that is not writable, an xl managed by Homebrew |
