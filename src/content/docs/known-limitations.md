---
title: Known limitations and open decisions
---

Each entry is one intentional gap or one open decision. Everything not listed here works as the reference describes.

## Platforms and distribution

- **No Windows arm64:** there is no Windows arm64 entry stub, so there is no Windows arm64 release of `xl` or `xlc`.
- **Unsigned releases:** a release is checked against the SHA-256 in its own `checksums.txt`, which detects corruption but not a compromised host.
- **No shell integration:** `xl` has no shell completion and no Homebrew formula.
- **Windows is verified under Wine only:** the Windows e2e programs run under CrossOver/Wine, never on real Windows, and `threads` and `panics` are not run there.
- **Windows threads are unverified:** `std/thread` on Windows (`CreateThread`, `WaitOnAddress`) is cross-built only and has not run under Wine or on Windows yet.
- **Windows paths are Latin-1:** the file API widens a path byte by byte; only `fsListDir` converts UTF-8 to UTF-16.
- **A Windows fd is a truncated handle:** it is the low 32 bits of the handle, and a socket fd carries bit 30.
- **Windows links and permissions:** only the read-only attribute is mapped, a symbolic link's file or directory kind is fixed when it is created, creating one needs Developer Mode, and `readLink` does not read junctions.
- **No `DllMain`:** a DLL built with `--emit=shared` runs neither its `@init` and `@entry` on load nor its `@fini` on unload, so the host calls `_xl_initAll` and `_xl_finiAll`.
- **No `try` on Windows:** the register snapshot of `try` is not written for Windows, so `try` is an error there.
- **macOS dylib `@fini` needs an unload:** `__mod_term_func` runs only when the image is unloaded, which neither a process exit nor the stdlib does.
- **Linux hooks are checked in Docker only:** the Linux `_start` stub and the `.init_array`/`.fini_array` hooks run only in the Docker e2e legs, and the shared-library load test runs on macOS only.
- **Linux links statically:** `-l<name>` needs a static archive on the linker's search path, and dynamic linking (PT_INTERP, PLT/GOT) is not implemented.

## Language and compiler

- **C convention through pointers:** a `fn(...)` value and a virtual method of an `@repr(c)` class use the xlang convention, so a struct by value through either does not match C or C++ (a C function that passes one cannot be a value, `E0778`).
- **No Itanium typeinfo:** the vtable of an `@repr(c)` class has a `null` typeinfo slot and no `_ZTI...` symbol.
- **Interface escape check is `return`-only (`E0760`):** an interface over a stack object that escapes through a global, a field, an out-parameter or a variable is not detected.
- **No owning interface:** an interface over a `new` object cannot be deleted through the interface, so the owner keeps the concrete pointer.
- **No explicit base constructor call:** a derived `init` runs only the base's argument-less `init`.
- **Arrays do not drop their elements:** an array whose element needs drop is `E0721` (`E0759` for a payload enum), and a droppable payload enum cannot be a global or a struct field (`E0758`).
- **Generic gaps:** type parameters have no constraints, a generic method outside a class is `E0733`, overloaded generic methods are `E0405`, and an overlap of two impl templates (`E0731`) is found only when an instance that matches both is used.
- **Generic code reaches an operator, not a method:** inside `fn f<T>(a: T, b: T)` the operators `==` and `<` resolve on the instantiated `T` and find a `fn ==(*T, *T)` / `fn <(*T, *T)` for a user type, and a free generic function `fn hash(a: T)` is reached the same way (each is looked up as a call after monomorphization, so every type used with the generic needs the operator or the reason is `E0709`/`E0404`). An **interface** method on a bare `T` does not resolve (`E0404`): a generic that needs one must take the interface as a parameter (`fn f<T>(v: T, h: Hash)`), or carry the operation as a `fn(T, ...) -> R` value. `<T: Hash>` is not grammar (`E0002`). A method cannot be taken as a value (`&v.method` is `E0709`).
- **A generic function sees an operator only if its own module imports the declaring module:** an operator function is resolved per instantiation against the imports of the module that declares the *generic*, not of the module that calls it. `Vec.sort` therefore only compiles for a type whose `fn <` is reachable from `collections/vec` (it imports `str/string` for the `String` operators), and a type declared elsewhere without that import is `E0709` there and must use `sortBy`.
- **An interface cannot be implemented on a primitive (`E0706`):** `impl Hash for i32 { }` is rejected because only a struct or a class has `impl`. A container keyed by hash therefore keys on a struct (the stdlib ships `I32Key`, `U64Key`, `I64Key` wrappers and `String`), and a container that must hold a primitive carries the hasher as an object and hashes the raw bytes.
- **A generic class field is not dropped (`E0758` for a payload-enum field, a silent leak for a plain `V`):** `needsDrop` resolves the fields of the *generic declaration*, where `V` is never droppable, so `class Slot<V> { value: V }` leaks a `value` that is a `String`. A container that stores a generic value in a class field must drop it in its own `drop` with `__builtin_drop(&self.value)`, which works for a type needing drop and is a no-op for one that does not.
- **No thread-local storage:** there is no `thread_local` attribute, no `__thread`/`_Thread_local` marker and no per-thread global, so the stdlib keeps no `errno`-style per-thread state and an allocator cache cannot be per-thread; only `struct` state guarded by an atomic or a lock is available.
- **`f<T>(x)` is decided by the next token:** `<...>` is a type-argument list when the `>` is followed by `(`, `{`, `)`, `]`, `,`, `;` or a line end, so `i < j > (k)` is a generic call.
- **`F` is not inferred from an untyped closure:** `apply(x, |v| v * 2)` with `fn apply<F>(x: i32, f: F)` is `E0724`; write `|v: i32| v * 2`.
- **`T` is not inferred from a slice argument:** `fn f<T>(s: []T)` or `fn f<T>(s: []mut T)` called as `f(a[0..n])` is `E0404` (and in some positions `E0706`), because the slice is not a type the inference uses to bind `T`. An explicit type argument, `f<i32>(a[0..n])`, works. The stdlib slice algorithms in `std/collections/slice` take a function pointer, not a generic `F`, for the same reason.
- **A generic return type is not inferred through an `F` parameter:** `fn map<U, F>(self: *Option<T>, f: F) -> Option<U>` cannot bind `U` at a call (`E0724` even with explicit type arguments), because `F` is still an unresolved parameter when `U` is solved. The stdlib writes such an adaptor as `f: fn(*T) -> U`, which infers `U` from a non-capturing closure or a named function and is what `Option.map`/`andThen`/`okOr`, `Result.map`/`andThen`/`mapErr` and `Vec.sortBy` use; a **capturing** closure has no generic adaptor form and must be hoisted to a named function or a `for` loop.
- **Overloaded calls give no expected type:** an array literal passed to an overloaded or generic call needs a typed local.
- **Virtual methods are not overloadable (`E0405`).**
- **Variadic packs are compile-time only:** each argument list is a separate instance, a pack cannot be indexed or used as a value, and a pack function cannot be `export(c)`, `declare`, virtual, generic or a method (`E0736`).
- **Tuples:** nested destructuring, destructuring in a `for` header and `&` of an element of a temporary tuple are not implemented.
- **Payload enums:** named payload fields, nested patterns, a payload pattern next to other variants in one `case`, `==` and `switch` through a pointer without `*` are not implemented, and the tag is always `i32`.
- **A generic variant needs a target type:** `Result.Ok(1)` without a typed local, argument or `return` is `E0756`.
- **`?` has no error conversion:** the error type of the callee and the caller must be the same.
- **`resultTake`/`resultTakeErr` need a plain payload:** they switch through a pointer, which only lends the payload (`E0720` on a move), so a droppable payload must be taken by value (`resultOrElse`, `?`, or a `switch` on an owned value).
- **Slices have no borrow rules:** a `[]mut T` marks intent only, with no alias or lifetime guarantee.
- **`for` over `str` yields bytes:** a rune form is not decided.
- **`str` does not own its bytes:** the caller keeps them alive, and writing through the `*u8` of a literal is undefined behavior.
- **`const` is not a compile-time constant:** it cannot be an array length, a `staticAssert` operand or a `define` argument, and its initializer cannot read another `const`.
- **No address of a temporary and no static methods:** a method result must be stored before another method is called on it (`a.add(&b).normalized()` is `E0709`).
- **The missing-return check (`E0764`) is syntactic:** a path ends only at `return`, a `while true` without `break`, a `-> never` call or a `switch` that covers every variant, so a loop whose condition is always true in another form still needs a `return` after it.
- **`a--b` is not `a - -b`:** `++` and `--` are tokens.
- **`~x` in a constant is untyped:** in a `define` or a global initializer `~x` is `-x - 1`; cast the result.
- **HIR does not fold constants:** `N * 2` is folded only in code generation.
- **Gaps met while writing `xl`:** a `define` cannot hold an array of `str`, and `for x in [&a, &b]` yields `**T`, which method calls do not dereference.
- **`try` unwinds by frame pointers:** foreign frames and separately compiled modules are not unwound, a function with cleanup keeps its locals in memory and is not inlined, and a cleanup that panics while unwinding is not handled.
- **One init table per executable:** a prebuilt archive's `@init` functions run only when the host calls that archive's `_xl_initAll`; per-archive tables are an open decision.
- **Reachability roots are coarse:** every vtable and interface method is a root, so a used class or impl is kept whole, and a reachable path keeps its `@library` imports.
- **Debug info has no struct or class types.**
- **`--incremental` caches objects only:** semantic analysis still runs for every module.

## Packages (`xl pkg`, `xlang.toml`, `xlang.lock`)

[Packages](/compiler/packages/) is the reference; these are the decisions it rests on.

- **Git is the registry:** packages are tags fetched with the `git` executable, and there is no hosting API, search or publish command.
- **Builds never fetch:** only `xl pkg` downloads packages.
- **Integrity is the commit hash:** `xlang.lock` has no content checksum or signature, so a compromised host or a force-pushed first download is not detected.
- **No version solving:** one copy per repository per build, the project's own entry wins, and two different required versions are `E0743`.
- **Only exact tags:** a branch or a commit is `E0742`, and a pre-release or test tag is never `latest` (`E0744`).
- **No major-version paths:** `v2.0.0` and `v1.9.0` of one repository cannot coexist.
- **Source only:** a package cannot ship prebuilt objects, and a project cannot pin a stdlib in `xlang.toml`.
- **No package metadata beyond dependencies:** there is no compiler-version requirement, `dev-dependencies`, optional dependency, build hook, feature flag or `-D` forwarding.
- **`xlang.local.toml` is read in the project root only.**
- **Identity is the repository path:** a moved repository needs a `source` override, and git submodules and LFS files are not fetched.
- **The cache is per project:** `.xlang/cache` is never pruned automatically, and a failed `install` can leave sources in it.

## Runtime and memory

- **Allocator replacement is not tracked per block:** after `currentAllocator = v`, a block allocated before is freed through `v`, and a user `alloc` without a user `free` frees through the stdlib `free`.
- **`stdin()` is not thread-safe:** the shared `Stream` and its buffer have no lock.

## The `xl` tool

- **`xl new` asks with a line prompt:** the main-or-lib question reads one line from the terminal; there is no up-down menu, because the stdlib has no raw terminal mode (termios on Unix, console input on Windows).
- **`xl fmt` is token-level:** it re-indents by brace depth and normalizes whitespace, but does not reflow long lines and does not normalize operator spacing (a unary `-` and a binary one are not told apart without a parser); an AST formatter in the compiler is a later step.

## Testing

- **No test discovery:** a test file registers its tests with `test(&s, "name", fn)` and returns `suiteRun`.
- **No chained matchers:** the matchers are typed functions (`expectEq`, `expectEqStr`, `expectNear`, ...).
- **A panic ends the file's run:** `std/testing` does not use `try` yet.
- **`xl test` has no per-file timeout and no regular-expression patterns:** the stdlib has no timed wait for a child process and no regular expressions; patterns are files, directories, globs and substrings. A glob has no `[...]` class (`globMatch` has none), and a directory with more than 4096 entries is searched only in part (`fsListDir` reads into a fixed buffer).
- **The native e2e runner is unix-only:** Windows is covered by `run.sh` under CrossOver and by the CI job that runs `process.xl`, and the runner has no per-test timeout.

## Stdlib text, data formats and files

- **`view` and `asStr` return `str` on purpose:** they are the zero-copy views inside the stdlib; every other function returns text as a `String`.
- **`*u8` buffers remain in `std/http` and `std/tls`:** parts of both still pass a pointer and a length.
- **`JsonWriter.valueString` takes `str`, not `*String`.**
- **Glob has no escape:** `globMatch` cannot match a literal `*` or `?`, and bracket classes are not implemented.
- **JSON is not a tree:** `jsonPointerGet` and `jsonSkipRaw` return raw views, and there is no typed object model.
- **CSV reads one line at a time:** a quoted field across lines needs the caller to join the lines.
- **TOML:** validation does not catch duplicate keys or table redefinitions, `tomlGet` does not process escapes in quoted keys, and a repeated `[[array]]` returns its first occurrence.
- **CBOR, MessagePack and protobuf are partial:** the CBOR and MessagePack readers check and skip without building values, and protobuf has primitives only.
- **Base58 has input caps:** 512 bytes to encode, 800 bytes decoded.
- **Fixed output buffers:** the decoders and writers report overflow instead of growing.
- **Fixed-Huffman compression only:** dynamic Huffman, lazy matching, compression levels, zstd, brotli, LZ4 and Snappy are not implemented.
- **Tar extraction ignores modes, times and links:** the stdlib readers write regular files, and `xl` sets the executable bit on the binaries it installs.
- **No time zones in `std/time`:** it is UTC only, RFC 3339 is the only parsed form, and the zone module does not evaluate the POSIX DST footer (RFC 8536 section 3.3) or find zone files itself.
- **No version ranges:** `std/semver` compares versions only.

## Stdlib networking and HTTP

- **No IPv6 sockets or address types:** the public network layer on top of `std/sys/sock` is not written.
- **The HTTP server is sequential:** one connection at a time with a blocking `accept` and `Connection: close`, so a slow client stalls others for up to the 20 s receive timeout.
- **HTTP request limits:** request bodies need `Content-Length`, and the server has no keep-alive, panic recovery, body binding or static-file helpers.
- **Fixed router sizes:** a route pattern and a group prefix are at most 128 bytes and a chain at most 8 handlers; a longer pattern stops the program.
- **The router matches linearly:** static routes first, no radix tree, no case-insensitive redirect and no forwarding to another route.
- **Open HTTP rules:** several differing `Content-Length` values (the first is used) and the absolute-URI and `*` target forms ([HTTP audit](/std/http-audit/)).
- **The HTTP client is minimal:** no cookie jar, keep-alive, decompression, proxy, IPv6, HTTP/2, `Expect: 100-continue` or streamed request body, and the read timeout covers each read.
- **TLS 1.2 and 1.3, ECDHE with AEAD only (the rustls set):** TLS 1.1 and older, RSA key transport, finite-field DHE, CBC and RC4 suites are not implemented on purpose. TLS 1.3 offers and accepts x25519 key shares only (TLS 1.2 also has P-256 and P-384) and has no HelloRetryRequest; neither version has resumption, 0-RTT, client certificates, ALPN or SNI-based virtual hosting.
- **TLS server keys:** PKCS#8, PKCS#1 RSA or SEC1 EC (RSA to 4096 bits, P-256, P-384), with no Ed25519 or encrypted keys and a chain of at most 60000 bytes.
- **Certificate checks:** revocation, nameConstraints, extended key usage, critical extensions, policies and IP SANs are not checked.
- **Root stores:** macOS reads `/etc/ssl/cert.pem` (not the keychain), Windows reads the `ROOT` store without on-demand roots or policy stores, and the root bundle is cached without a lock.
- **Handshake limits:** 64 KiB per message and 8 certificates.
- **Readiness polling on Windows is WSAPoll:** it reports sockets only, holds at most 256 watches per process, returns at once on an empty set, and is not run on real Windows.
- **IOCP and io_uring are not wired in:** a completion backend does not fit the readiness API, and `std/sys/uring` stops at a NOP round trip (Docker's seccomp profile refuses it).
- **Protocol messages are builders and parsers only:** NTP is one query, SOCKS5 has no authentication, syslog has no transport, MQTT has no connection loop, DNS answers are not parsed into records, the IP/TCP builders need raw sockets that are not wrapped, and TCP has no state machine.
- **Address configuration is a pure state machine:** DHCP, DHCPv6 and SLAAC do no I/O, and they omit the ARP probe, IA_TA, prefix delegation, rapid commit, reconfigure and privacy addresses.
- **No OAuth token exchange:** `std/auth/oauth` builds the authorization URL and PKCE values only.
- **JWS and JWT:** ES384, RS384, RS512 and PS256 are not verified, JWK sets are not read, and claims are not validated.
- **Punycode has no nameprep:** callers pass prepared labels.

## Stdlib processes and system information

- **Windows has no signals:** `signal`, `terminate` and `kill` all call `TerminateProcess` with exit code 1.
- **macOS pipes are not atomically close-on-exec:** `pipe` has no `O_CLOEXEC` form, so a child spawned by a foreign thread in the gap may inherit an end.
- **macOS keeps `posix_spawn_file_actions_addchdir_np`:** the unsuffixed name exists only from macOS 26.
- **Environment snapshots:** Linux `env.list()` reads the environment at exec time, and Windows does not re-sort the block when `Command.env` adds entries.
- **Windows system information is partial:** `hwProductName` and `gpuDrmDevices` return 0, the CPU name is the `PROCESSOR_IDENTIFIER` text, and arm64 reports no SHA-3, SHA-512 or CRC32 flag.
- **Untested Windows calls:** `fsListDir` and `sysMapGuarded` are type-checked only, and a symlinked directory reports kind 4.
- **macOS has no directory listing or GPU enumeration:** `getdirentries` is not in the verified XNU table, and Metal and IOKit are deferred.
- **The DRM success path is untested:** no container has a DRM driver.

## Stdlib cryptography, mathematics and identifiers

- **Not constant-time:** AES, bignum arithmetic, RSA key generation, ECDSA and secp256k1 signing and TLS server signing branch or index on secret data.
- **AES modes:** XTS needs whole blocks, and CBC does not pad.
- **Not implemented on purpose:** AES-CFB, AES-OFB, AES-OCB, DES and 3DES, RC4, Blowfish, Twofish, Camellia, SM4, ARIA, SEED, CAST5, IDEA, RC2, RC5, RC6, Serpent, Kuznyechik, BLAKE3, RIPEMD, Whirlpool, Tiger, SM3, GOST, Streebog, Argon2, bcrypt, DSA, SM2, OCSP requests, PKCS#8 and PKCS#12 encryption, QUIC and DTLS.
- **Unchecked against vectors:** `concatKdf`, `x963Kdf` and keyed BLAKE2 have no published test vector in the tests.
- **HKDF rejects BLAKE2:** BLAKE2 has no HMAC block size here.
- **No streaming HMAC:** `hmac` takes the whole message.
- **RSA keys use e = 65537 only.**
- **Ed448 is slow and pure only:** it reduces through `bigintDivMod`, and Ed448ph and contexts are not implemented.
- **CSR and CRL are read only:** attributes and extensions are not read, nothing is signed, and RSA private keys cannot be written.
- **Floating point is checked to 1e-9:** the functions are not correctly rounded, the trigonometric reduction loses accuracy beyond about 1e6, and `pow` with a non-integer exponent loses about |y log x| ulps.
- **`BigInt` is bounded at 4160 bits:** a larger result panics, `modPow` needs an odd modulus, and `sub` panics when the result would be negative.
- **Identifiers without host data:** cuid v1 and XID use random per-process machine bytes, and cuid v2 hashes with SHA-256 instead of SHA-3.
- **Time is the caller's:** every identifier generator takes the time as a parameter.
- **Snowflake-family layouts are project conventions,** and Sqids and Hashids are not implemented because neither has a specification.
