---
title: Files and arguments
---

## Command-line arguments (`std/os/args`)

An executable receives its arguments through `@entry fn main(argc: i32, argv: **u8)` on Linux, macOS and Windows.

| Function | Meaning |
|---|---|
| `fromArgv(argc, argv) -> Vec<String>` | copies the C strings behind `argv` into Strings; element 0 is the program path |
| `parseCommandLine(line) -> Vec<String>` | splits a Windows command line with the UCRT rules (`CommandLineToArgvW` conventions: quotes group, backslashes before a quote are halved) |

Linux and macOS pass the vector itself. Windows passes one command-line string, so the stdlib registers the `args` role (`std/runtime/args`) with `GetCommandLineW`, converted to UTF-8 and split by `parseCommandLine`. See [the language reference](/language/).

## File and directory helpers (`std/io/files`)

All take `*String` paths and return `bool` unless noted.

| Function | Meaning |
|---|---|
| `exists`, `isDir` | path tests |
| `makeDir`, `makeDirAll` | create one directory, or the whole chain (existing is success) |
| `removeFile`, `removeDir` | delete a file, or an empty directory; a read-only one too, on every OS |
| `removeAll` | delete a tree recursively; a missing path is success; a symbolic link is removed itself, never followed into |
| `chmod(path, mode)` | set the permission bits (low 12 bits of `mode`, e.g. `416` = 0640); Windows has no permission bits and maps "no write bit" to the read-only attribute |
| `setTimes(path, accessSec, modifySec)` | set access and modification times in whole seconds since 1970 |
| `symlink(target, link)` | create a symbolic link; the target text is stored as written. On Windows the file/directory kind is fixed at creation from what `target` is, so create the target first |
| `readLink(path) -> String`, `isSymlink(path)` | the stored target (empty when `path` is not a link), and whether `path` itself is a link, dangling or not |
| `listDir(path) -> Vec<String>` | the names of up to 64 entries (no `.`/`..`); list again after removing to go on |
| `rename(src, dst)` | rename or move |
| `currentDir() -> String`, `absolute(path) -> String` | working directory and path resolution |
| `isTerminal(fd)` | whether a descriptor is a terminal |

The system calls behind them are listed in [System information](/std/system/) and [System calls](/std/syscalls/).
