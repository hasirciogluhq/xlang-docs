---
title: Archives (tar, zip)
---

`std/archive/tar` reads and writes tar archives held in memory (a `String`) and extracts to or creates from a directory. `std/archive/zip` reads and extracts ZIP archives ([below](#zip)).

```
from "std/archive/tar" import list, contents, extract, create, Entry, Kind, Error
```

| Item | Meaning |
|---|---|
| `list(archive) -> Result<Vec<Entry>, Error>` | every entry with its metadata |
| `contents(archive, entry) -> String` | the data of one entry |
| `extract(archive, dest) -> Result<usize, Error>` | unpacks into `dest`, returns the number of entries written |
| `create(dir) -> Result<String, Error>` | packs a directory tree into an archive |
| `Writer` | builds an archive entry by entry |

`Entry` holds `name`, `linkName`, `kind` (`File`, `Dir`, `Symlink`, `Hardlink`, `Other`), `mode`, `size`, `mtime` and the data `offset`. `Error` is `Truncated`, `Invalid`, `Checksum`, `UnsafePath` (an entry name that would leave the destination) or `Io` (a file or directory could not be created, written or read).

## Format

POSIX.1-1988 ustar ([pax specification](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html)) plus what real archives use:

- pax extended headers (`x` for the next entry, `g` global): `path`, `linkpath`, `size`, `mtime`, so long names and sizes of 8 GiB or more work.
- GNU long names (`L`, `K`).
- Numeric fields in octal, and the GNU base-256 form.
- The archive is padded to a 10240-byte record when written. Every header checksum is checked when read.

`extract` refuses absolute paths, `..` segments, drive letters and backslashes. A `.tar.gz` is `gunzip` from [Compression](/std/compress/) followed by `list`.

## Not done

Device nodes, FIFOs and sparse files are listed as `Other` and skipped. Symbolic and hard links are listed, not created. Permissions, ownership and times are stored in written archives but not applied on extraction.

## Zip

```
from "std/archive/zip" import list, contents, extract, Entry, Error
```

| Item | Meaning |
|---|---|
| `list(archive) -> Result<Vec<Entry>, Error>` | every entry of the central directory |
| `contents(archive, entry) -> Result<String, Error>` | the uncompressed data of one entry, CRC-32 and size checked |
| `extract(archive, dest) -> Result<usize, Error>` | unpacks into `dest`, creating directories, returns the number of entries written |

`Entry` holds `name`, `dir` (the name ends in `/`), `method`, `flags`, `crc`, `size`, `packed` (compressed size), `mode` (Unix permission bits, 0 when the archive was not made on Unix) and the local header offset. `Error` is `Truncated`, `Invalid`, `Checksum`, `Unsupported`, `UnsafePath` or `Io`.

The format is [PKWARE APPNOTE 6.3.10](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT): the end of central directory record is searched backward past a comment of up to 65535 bytes, the central directory is authoritative, and ZIP64 (the zip64 end record and the `0x0001` extra field) is read. Methods 0 (stored) and 8 (deflate, [Compression](/std/compress/)) are supported. Encrypted entries, other methods and multi-disk archives are `Unsupported`. `mode` is listed, not applied. `extract` refuses the same unsafe names as tar. Writing ZIP archives is not implemented.
