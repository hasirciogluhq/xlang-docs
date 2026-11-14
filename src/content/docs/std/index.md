---
title: Standard library
---

The standard library is written in xlang and lives in its own repository, [`hasirciogluhq/xl-std`](https://github.com/hasirciogluhq/xl-std). `xl std install` installs a release per user, and every `xl` build passes it to the compiler as the module root `std` (see [The xl tool](/compiler/cli/#the-build-environment)). A program imports it with `from "std" import ...`, or a module by path, for example `from "std/str" import replace`.

## Modules

- `std/str`: byte views (`fromParts`, `view`), comparison and glob matching, and the owned `String` type with the text functions. See [Strings](/std/strings/).
- `std/collections`: `Vec<T>`. See [Collections](/std/collections/).
- `std/random`: OS entropy, a ChaCha20 generator, Xoshiro and SplitMix generators, UUIDs of every version and other identifiers. See [Random and identifiers](/std/random/).
- `std/sys`: the operating system layer. See [System calls](/std/syscalls/).
- `std/encoding`: hexadecimal, Base64, Base32, Base58, Base85, PEM, DER, UTF-8, CSV, JSON, TOML, CBOR, MessagePack, Protocol Buffers wire primitives, and Punycode. See [Encodings](/std/encoding/).
- `std/compress`: DEFLATE, gzip and zlib, decoding and encoding (dynamic Huffman, levels 0 to 9). See [Compression](/std/compress/).
- `std/archive`: tar reading, writing, extraction and creation. See [Archives](/std/archive/).
- `std/os/args`, `std/io/files`: command-line arguments on every OS, and file and directory helpers. See [Files and arguments](/std/files/).
- `std/auth`: HS256 JWS tokens and AWS SigV4 signing. See [Authentication tokens](/std/auth/).
- `std/time`: calendar arithmetic and RFC 3339 timestamps. See [Date and time](/std/time/).
- `std/semver`: Semantic Versioning 2.0.0 parsing and precedence. See [Versions](/std/semver/).
- `std/net/proto`: NTP, syslog and SOCKS5 messages. See [Network protocol messages](/std/protocols/).
- `std/crypto`: SHA-1, SHA-2, SHA-3, MD4, MD5, BLAKE2, HMAC and the MAC interface; AES modes (CBC, CTR, ECB, CCM, XTS), AES-GCM, ChaCha20-Poly1305 and Salsa20; HKDF, PBKDF2 and scrypt; X25519 and X448; RSA, ECDSA, Ed25519 and Ed448; X.509, CRL, CSR, SPKI and key parsing. See [Cryptography](/std/crypto/).
- `std/checksum`: CRC-32, CRC-32C, Adler-32 and FNV-1 and FNV-1a. See [Encodings](/std/encoding/).
- `std/net`, `std/tls`, `std/http`: sockets, TLS 1.2 and 1.3, and the HTTP server and client. See [TLS](/std/tls/), [HTTP](/std/http/) and [Event polling](/std/event-loop/).
- `std/math`: integer and float helpers, fixed-width big integers, and the geometry types `Vec2`, `Vec3`, `Vec4`, `Rect`, `Mat2`, `Mat3`, `Mat4`, `Quaternion` and `Transform`. See [Mathematics](/std/math/).
- `std/io`: `print`, `println`, `fprint` and the other output functions, whole-file helpers, directory listing and file status.
- `std/mem`: `memcpy`, `memmove`, `memset` and `memcmp`, the `Allocator` interface, the default heap and `currentAllocator`.
- `std/thread`: threads, `Mutex`, `Cond`, `RwLock`, `Once`.
- `std/os`: child processes (spawn, pipes, signals, elevation check) and the environment. See [Processes](/std/process/).
- `std/cpu`, `std/gpu`, `std/hw`: CPU feature flags, GPU device discovery, and hardware facts the OS publishes. See [CPU features](/std/cpu/) and [System information](/std/system/).
- `std/cloud`: an S3 client. See [Cloud storage](/std/cloud/).
- `std/runtime`: panic, unwinding and stack switching. See [Runtime](/compiler/runtime/).
- `std/testing`: the test framework. See [Testing](/compiler/testing/).
- `std/sys`: the native OS layer (system calls on Linux and macOS, library calls on Windows). User code reaches it only through the areas above. See [System calls](/std/syscalls/).

Every function is documented in its file header, which names the specification it implements (RFC number or official page).
