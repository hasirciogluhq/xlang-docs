---
title: Compression
---

`std/compress` reads and writes DEFLATE (RFC 1951), zlib (RFC 1950) and gzip (RFC 1952). Every function takes a `*String` to borrow and returns a `String` to give; a packet or buffer is a `String`.

```
from "std/compress" import gzip, gunzip, CompressError
from "std/collections/result" import Result
```

| Function | Specification |
|---|---|
| `deflate(data, level) -> String` | raw DEFLATE, RFC 1951 |
| `inflate(data, limit) -> Result<String, CompressError>` | raw DEFLATE: stored, fixed-Huffman and dynamic-Huffman blocks |
| `zlibCompress(data, level) -> String` | zlib: header, DEFLATE, Adler-32 |
| `zlibDecompress(data, limit) -> Result<String, CompressError>` | zlib: header check, Adler-32 checked; a preset dictionary is `Unsupported` |
| `gzip(data, level) -> String` | gzip member: header with mtime 0 and no name, DEFLATE, CRC-32 and ISIZE |
| `gunzip(data, limit) -> Result<String, CompressError>` | gzip: header flags, every member (concatenated members are joined), CRC-32 and ISIZE checked |
| `inflateAt(data, start, out, limit, end) -> i32` | the streaming core of `inflate`: decodes from `start`, appends to `out`, writes the end offset to `end`, returns a `STATUS_*` code |

## Levels

`level` is 0 to 9; other values are clamped.

- 0: stored blocks only.
- 1 to 9: LZ77 with 3-byte hash chains (32 KiB window), lazy matching, and dynamic Huffman blocks with length-limited codes (15 bits for literals and distances, 7 bits for the code-length alphabet). A block uses the smaller of the stored, fixed and dynamic encodings. Higher levels search longer chains.

## Errors and limits

`CompressError` is `Truncated` (input ends inside the stream), `Invalid` (bad header, block, code, distance or field), `Checksum` (CRC-32, Adler-32, length), `Limit` (the output would exceed `limit` bytes) and `Unsupported`.

The decoders take the largest output size they may produce. A stream that would produce more stops with `Limit`, so a small hostile input cannot expand to exhaust memory (zip bomb). Pass the size the application can afford.

## Interoperability

The unit suite round-trips empty, one-byte, repetitive and random inputs at every level and decodes fixed, dynamic and stored fixtures. The `archive` e2e test checks our gzip output with `gzip -t` and decodes `gzip -9` output.
