---
title: The xl tool
---

`xl` is the one command a user runs. It installs the compiler and the standard library (`xl lc`), manages packages (`xl pkg`), builds and runs programs through the compiler `xlc` (`xl check`, `xl build`, `xl run`), reports what a build would use (`xl env`) and updates itself (`xl self-update`). `xl` is written in xlang; its sources are `src/` of the xlang repository.

```
xl run [flags] [file.xl] [args...]   build and run a program; arguments after the file go to it
xl build [flags] [file.xl]           build an executable (or what --emit asks for)
xl check [flags] [file.xl]           type-check without writing anything
xl env [--json] [file.xl]            the compiler, stdlib and module roots a build of the file uses
xl pkg <command>                     packages: add, install, update, remove, list, clean
xl lc <command>                      the compiler toolchain: install, update, list, use
xl self-update [--check] [--force]   replace this xl with the newest release
xl version                           print the version
```

`xl <command> --help` describes a command. Installing `xl` and the toolchain: [Install](/compiler/install/). Packages and `xlang.local.toml`: [Packages](/compiler/packages/).

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

## The build environment

The compiler, the stdlib, the package roots and the extra flags of a file come from five layers. Each replaces what it names, lowest first:

| Layer | Sets | Source |
|-------|------|--------|
| 1. The active toolchain | compiler, stdlib | `$XLANG_HOME/toolchain.toml` (`xlc = "<tag>"`, `std = "<tag>"`), written by `xl lc` |
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
