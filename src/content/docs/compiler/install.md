---
title: Install
---

xlang is three pieces, each released on its own: the tool **`xl`** ([hasirciogluhq/xlang](https://github.com/hasirciogluhq/xlang)), the compiler **`xlc`** ([hasirciogluhq/xlc](https://github.com/hasirciogluhq/xlc)) and the standard library **`xl-std`** ([hasirciogluhq/xl-std](https://github.com/hasirciogluhq/xl-std)). You install `xl`; `xl` installs and updates the other two (`xl lc`) and itself (`xl self-update`). Packages are a different topic: see [Packages](/compiler/packages/).

## Supported platforms

| Host | x86-64 | arm64 |
|------|--------|-------|
| Linux | yes | yes |
| macOS | yes | yes |
| Windows | yes | no release yet |

Every release holds one archive per OS and CPU and a combined `checksums.txt` (`sha256sum` format):

| Repository | Asset |
|------------|-------|
| `xlang` | `xl_<version>_<os>_<arch>.tar.gz` (`.zip` on Windows), the binary `xl` at the archive root |
| `xlc` | `xlc_<version>_<os>_<arch>.tar.gz` (`.zip` on Windows), the binary `xlc` at the archive root |
| `xl-std` | `xl-std_<version>.tar.gz`, one `xl-std_<version>/` directory with `index.xl` (the stdlib is source, one archive for every host) |

`os` is `linux`, `darwin` or `windows`, `arch` is `amd64` or `arm64`. A tag that contains `-` (`v1.0.0-rc.1`) is a pre-release.

The compiler links with LLVM's linkers, which must be on `PATH`: `ld.lld` on Linux, `ld64.lld` on macOS (`brew install lld`), `lld-link` on Windows. See [Linking](/compiler/linking/).

## Install script

Every release of `xl`, stable or pre-release, carries `install.sh` and `install.ps1` as assets, listed in its `checksums.txt`. Whichever release a script comes from, it installs the newest `xl` unless told otherwise. The commands below use the scripts of the newest stable release (the newest pre-release while there is no stable one).

macOS and Linux:

```bash
curl -fsSL https://github.com/hasirciogluhq/xlang/releases/download/v1.0.0-rc.7/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://github.com/hasirciogluhq/xlang/releases/download/v1.0.0-rc.7/install.ps1 | iex
```

The scripts:

1. Detect the OS and CPU. On Apple silicon the arm64 build is installed even when the shell runs under Rosetta.
2. Find the requested release of `xl` (`--version`, below).
3. Download the archive and `checksums.txt`, and stop when the SHA-256 differs or the list has no entry for the archive.
4. Run the new binary with `version`, then move it into place: `~/.local/bin/xl` (`%LOCALAPPDATA%\xlang\bin\xl.exe` on Windows, which is added to the user `PATH`).
5. Run `xl lc install`, which installs the newest compiler and stdlib (below).

| Option (`install.sh`) | Environment variable | Meaning |
|-----------------------|----------------------|---------|
| `--version <v>` | `XL_VERSION` | `xl` release to install. `latest` (default): the newest stable release, or the newest pre-release while there is no stable one. `latest-stable`: the newest stable release. `latest-rc`: the newest pre-release. A tag (`v1.0.0`, `1.0.0-rc.1`): that release. |
| `--dir <path>` | `XL_INSTALL_DIR` | Install directory. Default: `$HOME/.local/bin`. |
| `--no-toolchain` | `XL_NO_TOOLCHAIN=1` | Do not run `xl lc install`. |

Pass options through a pipe with `bash -s --`, for example `curl -fsSL <url> | bash -s -- --version latest-rc`. `install.sh` needs `curl`, `tar` and `sha256sum` or `shasum`. `install.ps1` reads `XL_VERSION`, `XL_INSTALL_DIR` and `XL_NO_TOOLCHAIN` the same way.

## The toolchain: `xl lc`

```bash
xl lc install                 # the newest compiler and stdlib, made active
xl lc install v1.0 --std=v1.2 # the newest v1.0.x compiler and v1.2.x stdlib
xl lc update                  # the newest of both, made active
xl lc list                    # installed releases, * = active
xl lc use v1.0.0 --std=v1.2.2 # switch between installed releases
```

Compilers and stdlibs are installed per user, never system-wide, several versions side by side:

```
$XLANG_HOME/xlc/<tag>/xlc          one directory per compiler release (xlc.exe on Windows)
$XLANG_HOME/std/<tag>/index.xl     one directory per stdlib release
$XLANG_HOME/toolchain.toml         xlc = "<tag>"  std = "<tag>": the active pair
```

`$XLANG_HOME` defaults to `~/.xlang` (`%USERPROFILE%\.xlang` on Windows). No root rights are needed.

- Without a tag, the newest stable release is taken, or the newest pre-release while the repository has no stable one. A tag may be partial: `v1` is the newest `v1.x.x`, `v1.2` the newest `v1.2.x`.
- `install` without `--std` also installs the newest stdlib. A release that is already installed is not downloaded again.
- Every asset is checked against its release's `checksums.txt` before it is unpacked (`E0792`); a compiler is run once with `--version` before it is moved into place (`E0793`).
- Release tags are read with `git ls-remote`, so `git` must be on `PATH`; assets are downloaded with the stdlib's HTTPS client.
- `$XLANG_MIRROR` replaces GitHub with a directory laid out as `<mirror>/<owner>/<repository>/<tag>/<asset>`, for machines without access to GitHub (the tag directories are the release list).

A project can use another compiler or stdlib than the active pair: `[toolchain]` in `xlang.local.toml`, `$XLC`, `$XLANG_STD` or `--std=<dir>` (see [The build environment](/compiler/cli/#the-build-environment)). That is how the compiler and the stdlib are developed from their checkouts.

## Updating xl: `xl self-update`

```bash
xl self-update            # the newest release
xl self-update v1.0.0     # that release (a partial tag such as v1 works too)
xl self-update --check    # report only, install nothing
xl self-update --force    # reinstall or downgrade
```

The command lists the releases of `hasirciogluhq/xlang` and compares the newest with the running version (`xl version`):

- A stable `xl` takes the newest stable release, or the newest pre-release while there is no stable one. A pre-release `xl` (such as `1.0.0-rc.1`) takes the newest release of any kind, so a release candidate follows the next candidates and then the stable release.
- When the installed version is the newest or newer, it prints `xl <version> is up to date` and exits with 0.
- Otherwise it downloads the archive for the host, verifies it against `checksums.txt`, unpacks it next to the running binary, runs it once with `--version` (it must report the release's version, `E0793`) and renames it over the running binary, so an interrupted update leaves the old `xl`. Windows cannot replace a running executable but can rename it, so the old binary is first moved aside as `xl.old.exe`, removed by the next update.
- A binary under Homebrew's `Cellar` is refused (`E0793`): the package manager owns it.
- A directory that is not writable fails with the path (`E0793`); a network failure or an unknown tag is `E0791`.

The compiler and the stdlib are updated with `xl lc update`, not by `self-update`.

## Uninstall

The uninstall scripts are not release assets. They live on the `development` branch and are always run from there, so one script knows the layout of every version, including the older `xlang` binary and its Homebrew formula.

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/hasirciogluhq/xlang/development/scripts/uninstall.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/hasirciogluhq/xlang/development/scripts/uninstall.ps1 | iex
```

The script scans the well-known places, prints a numbered list, and asks which entries to remove: `all`, numbers and ranges (`1 3 5-7`), or nothing. The answer is read from the terminal, so it works through a pipe.

| Entry | macOS and Linux | Windows |
|-------|-----------------|---------|
| `xl` | `$XL_INSTALL_DIR`, `~/.local/bin`, `~/bin`, `/usr/local/bin` and every `PATH` directory; also the older `xlang` and any `xlc` copied there | `%LOCALAPPDATA%\xlang` (with `xl.old.exe`), `$XL_INSTALL_DIR`, its user `PATH` entry, and `xl.exe`/`xlc.exe` elsewhere on `PATH` |
| Toolchain | `$XLANG_HOME` (default `~/.xlang`) | `$XLANG_HOME` (default `%USERPROFILE%\.xlang`) |
| Package manager | the Homebrew formula `xlang` and the tap `hasirciogluhq/tap` | |
| Shell completion | `$XDG_DATA_HOME/xlang`, `xl.fish` and `xlang.fish` in fish's completion directory, the `# >>> xlang completion >>>` block in `~/.zshrc`, `~/.bashrc` and `~/.bash_profile` | |
| Leftovers | `.xl.new.*` of an interrupted install | `%TEMP%\xl-install-*` |
| Editors | the `xlang.xlang` extension of VS Code, VS Code Insiders, VSCodium and Cursor | the same |

A binary counts only when its bytes carry the xlang marker (`hasirciogluhq` in `xl`, `_xl_initAll` in `xlc`), so another tool named `xl` (Xen's) is never listed. A file in a system directory such as `/usr/local/bin` is removed through `sudo`. A project's `.xlang/cache` belongs to the project and stays (`xl pkg clean` empties it); `lld` is left as well.

| Option (`uninstall.sh`) | Environment variable | Meaning |
|-------------------------|----------------------|---------|
| `--yes` | `XL_UNINSTALL_YES=1` | Remove everything found without asking. |
| `--list` | `XL_UNINSTALL_LIST=1` (`uninstall.ps1` only) | Only print what was found. |

Without a terminal to ask on, `uninstall.sh` stops unless `--yes` or `--list` is given. Options go through a pipe with `bash -s --`, for example `curl -fsSL <url> | bash -s -- --list`.

## Building from source

`xl` is written in xlang. With a compiler and a checkout of the xlang repository (its `xl-std` submodule is the stdlib):

```bash
git clone --recurse-submodules https://github.com/hasirciogluhq/xlang
cd xlang/src
xlc main.xl -M std=../xl-std --import std -DfeatureDefaultAllocator=true '-DxlVersion="1.0.0-dev"' -O2 -o ../xl
```

Without `-DxlVersion` the binary reports `0.0.0-dev`. The tests are `test/run.sh <xl> <xlc> xl-std` ([Testing](/compiler/testing/#the-xl-tool)).
