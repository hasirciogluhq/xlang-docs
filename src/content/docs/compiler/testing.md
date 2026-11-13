---
title: Testing
---

The tests of the standard library live in the `xl-std` repository (`xl-std/test/`) and are built with the standalone compiler `xlc`, which takes the library as a module root (`-M std=<xl-std> --import std -DfeatureDefaultAllocator=true`). There are two suites. The library is also type-checked as a whole: `xlc index.xl --check -DfeatureDefaultAllocator=true [--target <triple>]`.

One rule decides where a test goes: when the code under test reaches an OS-specific call (a syscall or an OS library: files, sockets, processes, clocks, threads, entropy, stdout/stderr, abort, unwinding, the loader), it is an end-to-end program; otherwise it is a unit suite, and only that.

## Language unit tests (`*.test.xl`)

```
xl-std/test/unit/run.sh [xlc] [name-regex]   # build and run every suite (or the matching ones) on the host
xl run xl-std/test/unit/for.test.xl          # one file, with the installed toolchain
```

`xl-std/test/unit/` holds suites written in xlang itself, using `std/testing`. A file is a test when it is named `*.test.xl` and has an `@entry fn main() -> i32` that ends in `suiteRun(&s)`; a non-zero exit status fails the file. `run.sh` takes the compiler (default `$XLC`, else `xlc` on `PATH`) and an optional extended regular expression matched against the file name without `.test.xl`.

```xlang
from "std/testing" import Suite, T, suiteInit, test, suiteRun, expectEq

fn addWorks(t: *T) { expectEq(t, 1 + 2, 3) }

@entry fn main() -> i32 {
    local s: Suite
    suiteInit(&s)
    test(&s, "add works", addWorks)
    return suiteRun(&s)
}
```

The matchers are typed functions (`expect`, `expectTrue`, `expectEq`, `expectEqUInt`, `expectEqStr`, `expectNear`, `expectGt`, `expectNil`, ...). There is no discovery and no chained matcher syntax. These suites run on the host only; the cross-OS legs belong to the e2e programs.

The suites `slices.test.xl` and `for_iter.test.xl` cover slices (`[]T`, `[]mut T`, `buffer[lo..hi]`) and the iterating `for` (`for x in s`, `for x, i in s`).

## End-to-end programs

```
xl-std/test/e2e/run.sh [xlc]
```

`xl-std/test/e2e/` holds one `.xl` program per feature. Besides `run.sh` (below), the runner `xl-std/test/e2e/runner.xl` is itself an xlang program. It reads the table `tests.txt` (`run|name|exit code|output substring` and `diag|name|flag|diagnostic code or ok`), builds each program with the compiler under test, runs it with `Command.output()` from `std/os/process` (see [Processes](/std/process/)), and checks the exit code and one substring of the output. It runs natively on Linux and macOS, one entry at a time, and takes an optional name filter (a plain substring of the table line):

```
xlc xl-std/test/e2e/runner.xl -M std=xl-std --import std -DfeatureDefaultAllocator=true -o e2e-runner
./e2e-runner xlc xl-std xl-std/test/e2e                # <xlc> <stdlib root> <e2e dir> [filter]
./e2e-runner xlc xl-std xl-std/test/e2e sched          # the entries whose line contains "sched"
```

The cross-target legs below and the TLS and HTTPS server/client pairs are run by the shell script `xl-std/test/e2e/run.sh`, which takes the compiler path as its first argument (default `$XLC`, else `xlc` on `PATH`). Each program is cross-built and run on the other targets the host can reach:

| Target | How |
|---|---|
| the host | built natively, run directly |
| Linux aarch64 and x86_64 | cross-built, run in a Docker container (`alpine:3`) |
| Windows x86_64 | cross-built, run under CrossOver or Wine when `cxrun` is on `PATH` |

A Docker registry failure is reported as a skip, not a failure: `alpine:3` is pulled once with three attempts, and a container that never starts is retried once.

### Running part of the suite

A full run takes a while, because every program is built four times. While working on one area, run only what changed:

```
XLANG_E2E_FILTER=print xl-std/test/e2e/run.sh          # every test whose name contains "print"
XLANG_E2E_FILTER='^process$' xl-std/test/e2e/run.sh    # exactly one test
XLANG_E2E_FILTER='^(try|sched)$' xl-std/test/e2e/run.sh
XLANG_E2E_FILTER=diag/ xl-std/test/e2e/run.sh          # the compile-time diagnostic cases
```

The filter is a POSIX extended regular expression matched against the test name, not against the target label, so one name selects all four legs of that test. `run.sh` also takes the compiler path as its first argument: `xl-std/test/e2e/run.sh xlc`.

The independent legs run in a pool of workers, one per CPU by default. `XLANG_E2E_JOBS=1` serialises them, which is easier to read when a failure is being traced, and a larger value helps on a machine with many cores. The server and client pairs (TLS, HTTPS) stay sequential: each needs a free port.

### Environment switches

| Variable | Effect |
|---|---|
| `XLANG_E2E_FILTER` | run only the tests whose name matches the regular expression |
| `XLANG_E2E_JOBS` | concurrent legs (default: the CPU count) |
| `XLANG_E2E_NET=1` | adds the tests that need the Internet (`https`) |
| `XLANG_E2E_S3=1` | adds `s3`, which needs an S3-compatible server on `127.0.0.1:18333` |

Run the full suite once at the end of a large change, and the single relevant program while working. A new e2e program is added to the `tests` array in `run.sh`, where the fields are the name, the expected exit code, a substring of the expected output, whether the program uses OS threads, and whether it can run on Windows.

## The xl tool

```
test/run.sh <xl> <xlc> <stdlib dir>
```

`test/run.sh` in the xlang repository checks every command of [xl](/compiler/cli/) against a built `xl`, a compiler and a stdlib checkout, without the network: packages are local git repositories (`source = "<dir>"`, one of them with CRLF line ends), and `xl lc` and `xl self-update` read releases from a directory through `$XLANG_MIRROR`. It runs in temporary directories with its own `$XLANG_HOME`, so the installed toolchain is never touched. CI runs it on Linux and macOS (x86-64 and arm64) and on Windows x86-64 (Git Bash).
