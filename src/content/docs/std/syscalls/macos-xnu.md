---
title: macOS (XNU) BSD system call numbers
---

Source: `bsd/kern/syscalls.master` from the apple-oss-distributions/xnu main branch, read at
https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/kern/syscalls.master.
The table is per XNU release; any value used by code must be checked again against the release
that the target macOS ships. The release tag of the table read is not yet recorded in this file: todo.

arm64 BSD calls (read from `bsd/dev/arm/systemcalls.c`, function `arm_get_syscall_number()`):
- The number is taken from the register named by the macro `ARM64_SYSCALL_CODE_REG_NUM`. That macro is not defined in the file read; its definition (expected to be `x16`) must be read from the arm64 headers before the register is written in code: todo.
- If that register holds zero, the code uses `x0` as the number and the first argument moves to `x1` (indirect syscall).
- Errors: `x0` holds the errno, `x1` is set to 0 and the carry bit (`PSR64_CF`) of `cpsr` is set. Success: the result is in `x0` and `x1` is always written: `uu_rval[1]` for `int`/`uint` return types, 0 for `off_t`, `user_addr_t` (`mmap`), `size_t`, `ssize_t` and `uint64_t`; only `_SYSCALL_RET_NONE` leaves it. The carry bit is cleared before the call. `x1` is therefore clobbered by every call, also when it carried the second argument (function `arm_prepare_u64_syscall_return()`).
- x86-64 (read from `bsd/dev/i386/systemcalls.c`, function `unix_syscall64()`): the same rule with `rax`/`rdx` and the carry flag `EFL_CF` of `rflags`; success writes `rdx` (`uu_rval[1]` or 0), so `rdx` is clobbered by every call, also when it carried the third argument. The `syscall` instruction itself clobbers `rcx` and `r11`.
- The compiler's `syscall` builtin therefore declares `x1` (arm64) and `rdx` (x86-64) as outputs of the call on macOS, tied to the argument they carry, so no value lives in them across a call (https://github.com/apple-oss-distributions/xnu/blob/main/bsd/dev/arm/systemcalls.c, https://github.com/apple-oss-distributions/xnu/blob/main/bsd/dev/i386/systemcalls.c).
- The trap instruction and its immediate (`svc #0x80` is the value commonly used, not yet read from the source): todo.
- `ERESTART` moves the program counter back by 4 bytes (one `svc`).
- There is no BSD `mprotect` entry in this table: the guarded mapping uses BSD number 74, as recorded in the comment in `std/sys/macos.xl`.

Mach traps are a separate table (`osfmk/mach/syscall_sw.h`) and are not recorded here: todo.

## Verified numbers

| Name | Number |
|---|---|
| read | 3 |
| write | 4 |
| open | 5 |
| close | 6 |
| access | 33 |
| mmap | 197 |
| accept | 30 |
| socket | 97 |
| connect | 98 |
| bind | 104 |
| listen | 106 |
| ioctl | 54 |
| select | 93 |
| poll | 230 |
| shm_open | 266 |
| psynch_mutexwait | 301 |
| workq_kernreturn | 368 |
| kqueue | 362 |
| kevent | 363 |
| kevent64 | 369 |
| thread_selfid | 372 |
| getentropy | 500 |

Also verified in the same table: munmap 73, bsdthread_create 360, bsdthread_terminate 361, unlink 10, lseek 199, gettimeofday 116, exit 1, read 3, write 4, open 5, close 6. The socket calls are in the table too: socket 97, connect 98, bind 104, setsockopt 105, listen 106, accept 30 (used by `std/sys/sock.xl`).

Process spawning (`std/sys/spawn`) calls the libSystem interface (`posix_spawn` with file actions, `wait4`, `kill`, `poll`, `geteuid`, `getpid`) and one raw call, fcntl 92 (`int sys_fcntl(int fd, int cmd, long arg)`; fcntl is variadic in C, and on arm64 Darwin variadic arguments go on the stack, so an `@library` declaration with fixed parameters would pass them wrongly). `pipe` is the libSystem call `int pipe(int fds[2])`: the raw call returns both descriptors in registers (rax/rdx on x86-64, x0/x1 on arm64) and its number is easy to get wrong (66 is `vfork`). Read from `bsd/kern/syscalls.master`: wait4 7, getpid 20, geteuid 25, kill 37, pipe 42, fcntl 92, poll 230, chdir 12, close 6. Constants, read from `bsd/sys/fcntl.h`: `F_DUPFD` 0, `F_GETFD` 1, `F_SETFD` 2, `FD_CLOEXEC` 1, `F_DUPFD_CLOEXEC` 67, `O_CLOEXEC` 0x01000000; from `bsd/sys/spawn.h`: `POSIX_SPAWN_SETSIGDEF` 0x4, `POSIX_SPAWN_SETSIGMASK` 0x8, `POSIX_SPAWN_CLOEXEC_DEFAULT` 0x4000; from `bsd/sys/poll.h`: `POLLIN` 0x1, `POLLERR` 0x8, `POLLHUP` 0x10 and `struct pollfd { int fd; short events; short revents; }`; from `bsd/sys/wait.h`: the low 7 bits of a wait status are the terminating signal (0 for a normal exit), bits 8 to 15 the exit status, `WNOHANG` 0x1. `bsd/sys/fcntl.h` also has `F_SETNOSIGPIPE` 73 ("No SIGPIPE generated on EPIPE", per descriptor). A signal set (`sigset_t`) is a 32-bit mask on Darwin, so SIGPIPE (13) is bit 12 (0x1000). Availability, read from the macOS SDK header `usr/include/spawn.h`: `posix_spawn_file_actions_addinherit_np` since macOS 10.7; `posix_spawn_file_actions_addchdir_np` since 10.15, deprecated in 26.0 in favor of `posix_spawn_file_actions_addchdir`, which exists from 26.0 only. The module uses the `_np` name because it exists on every supported release and is still exported.

`sched_yield` is absent by name from this table; the former `SYS_SCHED_YIELD = 331` in `std/sys/macos.xl` was removed because no entry was verified. Yield on macOS is a no-op until a verified call is recorded.

Checked and absent at the number tried: `__sysctl` (the entry at that position is ntp_adjtime, 527),
and `accept_nocancel` (366 is bsdthread_register). Numbers 16 and 366 are not the calls they are
on other systems, so do not assume a Linux or FreeBSD number carries over.

Links, permissions and times (`std/io/files`) call libSystem, whose interface Apple keeps stable, rather than raw numbers: `chmod(path, mode)`, `utimensat(AT_FDCWD, path, times, 0)` with `AT_FDCWD` = -2 and two `timespec` (access, modification), `symlink(target, linkpath)` and `readlink(path, buf, size)` (the length without a NUL, or -1). Man pages: chmod(2), utimensat(2), symlink(2), readlink(2).
