---
title: xlang Linking Reference
---

This document describes how the compiler turns a program into an executable, shared library or static archive today. xlang uses no libc and no C runtime: the compiler links only its own output.

---

## Pipeline

```text
.xl sources -> parse/check -> codegen (LLVM) -> object (.o / .obj) -> link -> executable / shared library
                                                              \-> in-process archiver -> static library
```

`xlc file.xl` runs the whole pipeline (`xl build file.xl` runs it with the project's stdlib and packages, see [The xl tool](/compiler/cli/)). `--emit` selects where it stops or what it produces: `exe` (default), `obj`, `ir`, `bc`, `header`, `static` (archive), `shared`. `xl run file.xl` builds into a temporary executable and runs it.

---

## What gets linked

- The program's object code, including the modules of every module root it imports: the stdlib (`-M std=<dir> --import std`) and the packages (`-M <repository>=<dir>`).
- Prebuilt object files and archives named on the command line after the program root: `xlc main.xl vendor/fast.o vendor/libz.a`, or `xl build main.xl vendor/fast.o vendor/libz.a` (executables and shared libraries only).
- For an executable, the compiler-generated entry stub (see below).
- Nothing else: there is no C runtime, no implicit `-lc`, no `-pthread`. Memory routines such as `memcpy` are stdlib code exported with C names.
- `--incremental` writes one object per module into a cache directory (`--cache-dir`, default `.xlc-cache` next to the output) and reuses unchanged ones.

An object or static library built by xlang contains the stdlib modules it imported, so one meant to be linked into another xlang program is built without the stdlib (plain `xlc lib.xl --emit=obj`, no `-M std`), or the link fails with duplicate symbols.

---

## Linkers per OS

The compiler runs an external linker found on `PATH`; it is not bundled:

| Target OS | Tool | Notes |
|-----------|------|-------|
| Linux | `ld.lld` or `ld` | `-nostdlib -static`, entry `_start`, `--gc-sections`, `-l<name>` for used `@library` names; `-shared` for shared libraries |
| macOS | `ld64.lld` | entry `_start`, `-dead_strip`, `-syslibroot <SDK>` and `-l<name>` for used `@library` names, `-dylib` for shared libraries |
| Windows | `lld-link` | `/nodefaultlib`, entry `mainCRTStartup`, `/subsystem:console`, `/dll` for shared libraries |

If the tool is missing, the build fails with a message naming it; `--emit=obj` needs no linker. Cross-compilation uses `--target <triple>` and needs a linker for that target.

---

## Entry stub

For an executable, the compiler emits a small assembly stub as the OS entry symbol. The stub calls the compiler-generated `_xl_initAll` (which runs the `@init` functions in order), then the `@entry` function, then `_xl_finiAll` (which runs the `@fini` functions in reverse order), and exits with the `@entry` function's integer result (0 when it returns nothing). Stubs exist for Linux and macOS on x86_64 and aarch64 and for Windows on x86_64; the Windows stub exits through ntdll's `NtTerminateProcess` and also defines `__chkstk` and `_fltused`. Without an `@entry` function the build fails with `E0739`, so no stub is emitted for static libraries or object files.

---

## External symbols and native libraries

```
declare fn helper(x: i32) -> i32
@library("ntdll") declare fn NtTerminateProcess(handle: i64, status: i32) -> i32
```

- A `declare`d function that no module of the compilation defines produces warning `W0301`; the final link then fails with an undefined symbol unless something else supplies it.
- `@library("name")` works on all three OSes, and only for declarations that the program reaches (see "Reachability pruning" below):
  - Windows: the compiler generates an import library for each named DLL from the declared symbols (with `llvm-dlltool`, so no Windows SDK is needed) and passes it to `lld-link`.
  - macOS: each used library name is passed as `-l<name>`, with `-syslibroot` set to the SDK from `xcrun --show-sdk-path`, so `@library("System")` links `libSystem`.
  - Linux: each used library name is passed as `-l<name>` after the objects. The link is static, and the compiler adds no search path, so the archive must be found by the linker or named on the command line.
- OS libraries may be declared in any stdlib area (for example `std/thread` may create a thread through a library call); user code reaches them only through stdlib functions.

## Reachability pruning

Before code generation the compiler removes every function and global that no root reaches (`src/hir/prune.cpp`). The roots are `@entry`, every `@init` and `@fini` function, every `register(role)` function, the hooks codegen calls by name (`panic`, `alloc`, `free`, `unwind`), every vtable and interface method, the C functions LLVM may call implicitly (`memcpy`, `memmove`, `memset`, `memcmp`, `bcmp`, `bzero`), and, for libraries and objects, every `export` and `export(c)` symbol. An executable linked with prebuilt objects or libraries (`xlc main.xl peer.o`) keeps every `export(c)` function as well, since that code may call back into it. Everything else is kept only if reachable from a root through calls, function values, constructors, globals and cleanup bodies. The `@library` imports of the removed functions are never linked. The stdlib panic path writes through `sysWriteFile`, which does not reach the Windows socket code, so a program that does not use sockets does not import `ws2_32`.

---

## Static and shared output

- `--emit=static` archives the program's objects in-process (no `ar`).
- `--emit=shared` links a shared library (`-shared`, `-dylib` or `/dll`); no entry stub is added.
- `--emit=header` writes a C header for `export`ed items.
- `export(c)` keeps a symbol name unmangled so C code can link to it, and it uses the target's C calling convention, so the header's by-value structs match the code: System V AMD64 ([psABI 3.2.3](https://gitlab.com/x86-psABIs/x86-64-ABI)) on Linux and macOS x86-64, [AAPCS64](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst) on arm64, and the [Microsoft x64 convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention) on Windows x86-64. `declare` imports use the same convention.

---

## Related documents

| Document | Role |
|----------|------|
| [Language Reference](/language/) | `declare`, `@library`, `export(c)`, entry points |
| [The xl tool](/compiler/cli/) | `xl build`, the build environment |
| [Packages](/compiler/packages/) | Dependencies from git repositories |
