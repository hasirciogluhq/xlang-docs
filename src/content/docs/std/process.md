---
title: Processes
---

`std/os/process` starts and controls child processes on Linux, macOS and Windows (x86-64 and arm64). `std/os/env` reads and builds environments, and `std/io/stream` gives the buffered pipe type `Stream`. The OS calls live in `std/sys/spawn`; the numbers and layouts are recorded in [System calls](/std/syscalls/).

```xlang
from "std" import String, optionIsSome, print
from "std/os/process" import Command, Stdio

@entry fn main() -> i32 {
    local git: Command = Command(String("git"))
    git.arg(String("status"))
    git.arg(String("--short"))
    git.cwd(String("/work"))
    if optionIsSome(git.output()) { return 1 }   // the child could not start
    print(&git.outText)                           // git.status.code is its exit status
    return 0
}
```

## Command

One `Command` describes a child and, after `start`, holds it. Builder methods return nothing and may be called in any order before `start`.

| Method | Meaning |
|---|---|
| `arg(String)` | Append an argument. The program name is `argv[0]`. |
| `env(String, String)` | Set a variable in the child's environment. |
| `clearEnv()` | Start from an empty environment instead of the parent's. |
| `cwd(String)` | Working directory of the child. |
| `stdin(Stdio)`, `stdout(Stdio)`, `stderr(Stdio)` | `Inherit` (default), `Piped` (a `Stream` on the parent side: `inPipe`, `outPipe`, `errPipe`) or `Null` (the null device). |
| `redirect(String)` | Send stdout and stderr to a file. |
| `start() -> Option<ProcessError>` | Spawn. `None` means the child runs. |
| `id()`, `isRunning()` | Process id and liveness. |
| `wait() -> ExitStatus`, `tryWait() -> Option<ExitStatus>` | Block, or poll without blocking. |
| `signal(Signal)`, `terminate()`, `kill()` | Deliver a signal, ask the child to stop (`SIGTERM`), force it to stop (`SIGKILL`). |
| `collect() -> ExitStatus` | Drain stdout and stderr into `outText` and `errText` while waiting; both pipes are polled together, so a child that fills either pipe cannot deadlock. |
| `run()`, `output()` | `start` plus inherited streams and `wait`; `start` plus piped output and `collect`. |
| `release()` | Drop the OS handle of a child that is not waited for. |

`ExitStatus` is `{ code, signal, success }`: `code` is the exit status, `signal` the terminating signal on POSIX (0 otherwise), `success` is true for a normal exit with code 0. `ProcessError` is `{ kind, code }` with `kind` one of `NotFound`, `PermissionDenied`, `AlreadyStarted`, `Other` and `code` the OS error number. A failed `exec` is reported to the parent: `start` returns the error, there is no half-started child.

The program is looked up on `PATH` of the parent (default `/usr/bin:/bin` when it is unset) unless it contains a path separator.

## Functions without a child

`id()` (own process id), `exists(pid)`, `signal(pid, sig)`, `terminate(pid)`, `kill(pid)`, `isElevated()` (root on POSIX; an elevated token on Windows) and `executable() -> Option<String>` (path of the running program).

`std/os/env`: `list() -> Vec<String>` (`NAME=value` entries), `lookup(env, name)`, `get(name)`, `set(env, name, value)`. Names compare case-insensitively on Windows.

## Streams

`Stream` wraps a descriptor or handle with an internal buffer: `readLine() -> Option<String>`, `readAll() -> String`, `readSome(out)`, `write(*String) -> bool`, `close()`, `isOpen()`. `stdin() -> *Stream` is the process's standard input.

## Per OS

| | Linux | macOS | Windows |
|---|---|---|---|
| Spawn | `clone(SIGCHLD)`, then `execve` over the `PATH` candidates; a close-on-exec pipe carries the child's `errno` back | `posix_spawn` with file actions, `POSIX_SPAWN_CLOEXEC_DEFAULT` so only the wired descriptors are inherited | `CreateProcessW` with `STARTUPINFOEXW` and `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, so only the three wired handles are inherited |
| Wait | `wait4` | `wait4` | `WaitForSingleObject`, `GetExitCodeProcess` |
| Signals | `kill` | `kill` | none: every signal is `TerminateProcess` (exit code 1) |
| Pipe readiness | `ppoll` | `poll` | `PeekNamedPipe` polling |
| Elevation | `geteuid() == 0` | `geteuid() == 0` | `TokenElevation` of the process token |
| SIGPIPE | ignored once; reset to default in the child | `F_SETNOSIGPIPE` on the pipes; reset in the child | not applicable |

The per-OS one-time state (the SIGPIPE disposition, the Windows command buffer) is set up inside the spawn function; user code never calls a setup function.
