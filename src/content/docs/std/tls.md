---
title: TLS
---

`std/tls` is a TLS client and server for TLS 1.3 ([RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)) and TLS 1.2 ([RFC 5246](https://www.rfc-editor.org/rfc/rfc5246)) on the raw TCP calls of `std/sys`. As in rustls, only forward-secret ECDHE key exchange with AEAD ciphers exists. TLS 1.1 and older, RSA key transport, finite-field DHE, CBC, RC4 and 3DES are not implemented on purpose. The HTTP client and server (`https://`, `RunTLS`) use it; see [HTTP](/std/http/).

## What is negotiated

| | TLS 1.3 | TLS 1.2 |
|---|---|---|
| Cipher suites, in preference order | `TLS_CHACHA20_POLY1305_SHA256`, `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384` | `ECDHE_{ECDSA,RSA}_WITH_CHACHA20_POLY1305_SHA256` ([RFC 7905](https://www.rfc-editor.org/rfc/rfc7905)), `…_AES_128_GCM_SHA256`, `…_AES_256_GCM_SHA384` ([RFC 5289](https://www.rfc-editor.org/rfc/rfc5289)) |
| Key exchange | x25519 (no HelloRetryRequest) | x25519, secp256r1, secp384r1 ([RFC 8422](https://www.rfc-editor.org/rfc/rfc8422)) |
| Signature schemes | `ecdsa_secp256r1_sha256`, `ecdsa_secp384r1_sha384`, `rsa_pss_rsae_sha256/384/512` | the same, plus `rsa_pkcs1_sha256/384/512` |
| Extensions | `supported_versions`, `key_share`, `signature_algorithms`, `server_name` | `extended_master_secret` ([RFC 7627](https://www.rfc-editor.org/rfc/rfc7627)), `renegotiation_info` ([RFC 5746](https://www.rfc-editor.org/rfc/rfc5746)), `ec_point_formats`, `server_name` |

TLS 1.3 is preferred. A client offers both versions unless told otherwise; a server takes the highest version both sides allow and the first suite in the client's order that its certificate can sign. An ECDSA server certificate also needs its curve in the client's group list (RFC 8422 section 5.1).

Downgrades are refused in both directions. A TLS 1.3-capable server that negotiates TLS 1.2 puts `DOWNGRD\x01` in the last 8 bytes of its random, and the client fails with `TLS_ERR_DOWNGRADE` when it sees it while 1.3 was allowed (RFC 8446 section 4.1.3). A server rejects a ClientHello with the fallback SCSV when it supports a higher version ([RFC 7507](https://www.rfc-editor.org/rfc/rfc7507)). Renegotiation is refused with a `no_renegotiation` warning; TLS 1.3 KeyUpdate is answered.

The client always validates the chain against the OS root store (`std/tls/truststore`) and checks the host name against subjectAltName. There is no switch to skip validation.

## API

| Function | Does |
|---|---|
| `tlsConnect(&c, ip, port, host) -> i32` | connects to `ip:port` (host-order IPv4), sends `host` as SNI and verifies the certificate for it; TLS 1.2 or 1.3 |
| `tlsConnectVersions(&c, ip, port, host, min, max) -> i32` | the same with the version range `min..=max` (`TLS_1_2`, `TLS_1_3`) |
| `tlsConnectHost(&c, host, port) -> i32` | resolves `host` with `std/net/dns`, then `tlsConnect` |
| `tlsListen(ip, port) -> i32` | a listening TCP socket for `tlsAccept` (`0` = every interface), or -1 |
| `tlsAccept(listenFd, &credentials, &c) -> i32` | accepts one connection and runs the server handshake |
| `tlsWrite(&c, data, n) -> bool` | sends application data, split into records of at most 2^14 bytes |
| `tlsRead(&c, buf, cap) -> isize` | the next application data; 0 at end of stream (`c.closedByPeer` tells a clean `close_notify` from a bare TCP close), a negative `TLS_ERR_*` on failure |
| `tlsClose(&c)` | sends `close_notify`, closes the socket and frees the record buffers; safe after a failed connect |
| `tlsErrorText(code) -> *u8` | a fixed English text for a `TLS_ERR_*` code |

Every function that can fail returns `TLS_OK` (0) or a negative `TLS_ERR_*` code. After a handshake, `c.version` holds the protocol version (`TLS_1_2` or `TLS_1_3`) and `c.suite` the IANA cipher suite code; `tlsVersionName` and `tlsCipherSuiteName` in `std/tls/names` turn them into text. On `TLS_ERR_ALERT`, `c.alert` is the peer's alert description; on `TLS_ERR_CERT`, `c.trust` is the `TRUST_*` code of the chain check.

### Server credentials

| Function | Does |
|---|---|
| `tlsLoadCredentials(&cr, certPath, keyPath) -> i32` | loads a PEM chain (leaf first) and its PEM key from two files |
| `tlsLoadCredentialsPem(&cr, certPem, certLen, keyPem, keyLen) -> i32` | the same from memory |
| `tlsFreeCredentials(&cr)` | releases the chain and wipes the key |

The key is PKCS#8, PKCS#1 RSA or SEC1 EC (RSA up to 4096 bits, P-256, P-384) and must match the leaf certificate. `TlsCredentials.minVersion` and `maxVersion` default to `TLS_1_2` and `TLS_1_3`; set them after loading to narrow what the server accepts.

### Error codes

| Code | Name | Meaning |
|---|---|---|
| -1 | `TLS_ERR_IO` | socket failure, or the peer closed during the handshake |
| -2 | `TLS_ERR_PROTOCOL` | a malformed or unexpected message |
| -3 | `TLS_ERR_ALERT` | the peer sent a fatal alert (`c.alert`) |
| -4 | `TLS_ERR_VERSION` | no protocol version in common |
| -5 | `TLS_ERR_CERT` | the chain was rejected (`c.trust`) |
| -6 | `TLS_ERR_SIGNATURE` | the CertificateVerify or ServerKeyExchange signature failed |
| -7 | `TLS_ERR_FINISHED` | the Finished MAC did not match |
| -8 | `TLS_ERR_ENTROPY` | the OS random source failed |
| -9 | `TLS_ERR_MEMORY` | a buffer could not be mapped |
| -10 | `TLS_ERR_RETRY` | the server sent a HelloRetryRequest (not supported) |
| -11 | `TLS_ERR_UNSUPPORTED` | no cipher suite, group or signature scheme in common |
| -12 | `TLS_ERR_CLOCK` | the clock could not be read for the validity check |
| -13 | `TLS_ERR_DNS` | the host name did not resolve |
| -14 | `TLS_ERR_AEAD` | a record failed authentication |
| -15 | `TLS_ERR_CREDENTIALS` | the server certificate or key is missing, malformed or mismatched |
| -16 | `TLS_ERR_DOWNGRADE` | a version downgrade was detected |

## Layout

| File | Contents |
|---|---|
| `tls.xl` | the public API above (re-exports) |
| `conn.xl` | `TlsConn`, the error codes, the suite tables and their properties |
| `wire.xl` | big-endian encoding, constant-time compare, full socket reads and writes |
| `keys.xl` | the transcript hash, HKDF-Expand-Label and the TLS 1.3 key schedule, the TLS 1.2 PRF, master secret, key block and Finished; SHA-256 and SHA-384 |
| `record.xl` | record protection for both versions (`sealRecord`, `openRecord`), alerts, KeyUpdate, `tlsRead`, `tlsWrite`, `tlsClose` |
| `handshake.xl` | the handshake message reader, ECDHE key shares, the certificate list |
| `sign.xl` | signature schemes: offer, pick, sign and verify |
| `credentials.xl` | `TlsCredentials` and the loaders |
| `client.xl`, `client13.xl`, `client12.xl` | the ClientHello and ServerHello, then the per-version client flights |
| `server.xl`, `server13.xl`, `server12.xl` | the ClientHello choice, then the per-version server flights |
| `truststore.xl` | the OS root store and chain validation |
| `names.xl` | IANA version and cipher suite names |

The key derivations and the record layer have no OS calls and are unit tests (`test/unit/tls.test.xl`: PRF, master secret and key block vectors, the TLS 1.3 schedule for both hashes, a seal and open round trip for every suite). The handshakes need sockets and are the e2e `tlsserver` / `tlsclient` pair, run once per key type and version.

What is not implemented (HelloRetryRequest, P-256/P-384 key shares in TLS 1.3, resumption, 0-RTT, client certificates, ALPN, SNI-based virtual hosting) is listed in [Known limitations](/known-limitations/).
