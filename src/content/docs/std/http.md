---
title: HTTP
---

`std/http` has an HTTP/1.1 server and client over plain TCP or TLS 1.3. The parts live next to each other:

| File | Contents |
|---|---|
| `engine.xl` | `Engine`, `RouterGroup` and `Route`: routing, groups and dispatch |
| `context.xl` | `Context`: the request and the response of one exchange |
| `server.xl` | `routerServe` and `routerServeTls`: the connection loop |
| `middleware.xl` | `Logger`, `Recovery`, `Cors` |
| `client.xl` | `Client`, `Request`, `Response`: sending, redirects, retries and body framing |
| `transport.xl` | the `Transport` interface, `NetConn` (TCP or TLS 1.3) and `Wire`, the buffered reader |
| `headers.xl` | `Headers` and `Header` |
| `url.xl` | `Url`, `parseUrl`, `decimal`, and the client's `HttpError` with `errorText` |
| `multipart.xl` | multipart form parsing |
| `util.xl` | byte helpers of the server |

## Server

```xlang
from "std" import Engine, Context, Logger, println

fn hello(c: *Context) {
    c.String(200, "hello\n")
}

@entry fn main() -> i32 {
    local e: Engine = Engine()
    e.Use(Logger)
    e.GET("/hello", hello)
    return e.Run(8080)
}
```

### Engine

| Member | Meaning |
|---|---|
| `Engine()` | an engine with no routes |
| `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` | register a route: `(path, fn(*Context))` |
| `Any(path, handler)` | register a route for every method |
| `Handle(method, path, handler)` | register a route for one method token |
| `Use(mw)` | add middleware to every route registered after it |
| `Group(prefix)` | a `*RouterGroup` with that prefix, copying the middleware in effect |
| `NoRoute(handler)`, `NoMethod(handler)` | replace the 404 and 405 handlers |
| `Serve(c *Context)` | route one request (the handler the connection loop calls) |
| `Run(port)`, `RunTLS(port, &credentials)` | serve until the process ends |
| `redirectTrailingSlash`, `redirectFixedPath`, `handleMethodNotAllowed` | fields that turn the matching rules below on and off |

A `RouterGroup` has the same route methods and `Use`/`Group`, all relative to its prefix.

### Matching

- Static routes win over `:name` and `*name`; `:name` matches one segment and `*name` the rest of the path (its value includes the leading `/`).
- `HEAD` is a route method of its own; a `HEAD` request is answered by the matching `HEAD` route (if any) and the body is not written.
- A path that differs from a route only by a trailing slash is redirected (301 for `GET`, 307 for the other methods).
- A known path with another method is only told apart when `handleMethodNotAllowed` is `true` (it is `false` in a fresh engine, so such a request gets 404); otherwise the answer is 404.
- Registering two routes of one method that differ only in parameter names (`/user/:id` and `/user/:name`) stops the program at start-up, as Gin does.

### Middleware

Middleware is `fn(*Context)`.

```xlang
fn auth(c: *Context) {
    if c.GetHeader("Authorization").len == 0 {
        c.AbortWithStatus(401)
        return
    }
    c.Next()
}
```

`Next()` runs the rest of the chain and then continues after it; `Abort()` and `AbortWithStatus(code)` stop it; `IsAborted()` reports whether it was stopped.

### `Context`

| Group | Members |
|---|---|
| Request | `Method()`, `Path()`, `Body()`, `Param(name)`, `Query(name)`, `DefaultQuery(name, fallback)`, `PostForm(name)`, `GetHeader(name)`, `FormValue`, `FormFile`, `FormFileName`, `FormFileType` |
| Response | `Status(code)`, `String(code, text)`, `JSON(code, text)`, `HTML(code, text)`, `Data(code, contentType, bytes)`, `Redirect(code, location)`, `SetHeader(name, value)` |
| Chunked | `StreamStart()`, `WriteChunk(bytes)`, `EndStream()` |
| Chain | `Next()`, `Abort()`, `AbortWithStatus(code)`, `IsAborted()`, `Responded()` |

The examples on the [Examples](/examples/) page are the routing examples of the Gin documentation, written with `std/http`, and are included straight from `docs/examples/`.

## Client

The client speaks HTTP/1.1 ([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112)) over plain TCP for `http://` and TLS 1.3 for `https://`. Every call returns `Result<Response, HttpError>`: an `Err` means no complete response arrived, and any HTTP status, 4xx and 5xx included, is an `Ok`.

```xlang
from "std" import String, Result, Client, Request, Response, HttpError, errorText, println

fn run() -> Result<bool, HttpError> {
    local c = Client()
    local url = String("https://example.com/api")
    local req = Request("POST", &url)
    req.headers.set("Content-Type", "application/json")
    req.body = String("{}")
    local resp = c.send(&req)?
    println("{} {}", resp.status, &resp.body)

    // A large body: `stream` hands it to the sink piece by piece instead of keeping it.
    local file = String("https://example.com/big.tar.gz")
    local get = Request("GET", &file)
    local total: u64 = 0
    local r = c.stream(&get, |head: *Response, chunk: *String| {
        total += chunk.length() as u64
        return true            // false stops the transfer with HttpError.Aborted
    })?
    println("{} bytes from {}", total, &r.url)
    return Result.Ok(true)
}

@entry fn main() -> i32 {
    switch run() {
        case Result.Ok(done) { return 0 }
        case Result.Err(e) { println(errorText(e).asStr()) }
    }
    return 1
}
```

| Type | Members |
|---|---|
| `Client` | `send(&req)`, `stream(&req, sink)`, `get(&url)`, `head(&url)`, `post(&url, contentType, &body)`, `put(&url, contentType, &body)`, `delete(&url)`; `sendVia(t, &req)` and `streamVia(t, &req, sink)` over your own `Transport`; fields `timeoutMs` (30000, the read timeout; 0 waits forever), `maxRedirects` (10), `retries` (2), `userAgent` |
| `Request` | `Request(method, &url)`; fields `method`, `url`, `headers`, `body` |
| `Response` | `ok()` (a 2xx status), `header(name)`; fields `status`, `reason`, `headers`, `body` (empty after `stream`), `url` (the URL that answered, after redirects) |
| `Headers` | `add(name, value)`, `set(name, value)` (replaces every value), `remove(name)`, `get(name)` (the first value, empty when absent), `has(name)`, `length()`, `writeTo(&out)`; names compare case-insensitively; field `items` |
| `Url` | `parseUrl(&text) -> Result<Url, HttpError>`; `resolve(&ref)` (RFC 3986 section 5.2, with dot segments removed), `authority()`, `origin()`, `path()`, `toString()`; fields `https`, `host` (lowercased), `port`, `target` (path and query) |
| `Transport` | interface: `connect(&url, timeoutMs) -> Result<bool, HttpError>`, `read(&into) -> isize`, `write(&data) -> bool`, `close()`. `NetConn` is the TCP/TLS one; a proxy tunnel, a Unix socket or a scripted test peer implements the same four methods |

The sink of `stream` is a function or a closure `(head: *Response, chunk: *String) -> bool`. It sees the status and the header fields in `head`; a body is never kept, so a download of any size passes through constant memory.

Behavior:

- **Body framing** follows RFC 9112 section 6.3: no body for `HEAD`, 1xx, 204 and 304; chunked transfer coding (chunk extensions and trailer fields are read and ignored); `Content-Length`; otherwise the body runs until the server closes. Interim 1xx responses before the final one are skipped. A body shorter than its `Content-Length` is `HttpError.Io`.
- **Redirects** 301, 302, 303, 307 and 308 with a `Location` are followed up to `maxRedirects`; with `maxRedirects = 0` the 3xx response itself is returned. The `Location` is resolved against the current URL. 303, and 301 or 302 after a `POST`, continue as a `GET` without the body and its `Content-*` fields (RFC 9110 section 15.4). `Authorization`, `Proxy-Authorization` and `Cookie` go only to the origin of the first URL.
- **Retries:** a connection that fails before the response head arrives (refused, reset, closed early, timed out) is tried again `retries` times for the idempotent methods (RFC 9110 section 9.2.2: all but `POST` and `PATCH`). Once a head has arrived, nothing is retried.
- **Request head:** `Host`, `Connection: close` and `Content-Length` are the client's own; a `User-Agent` in the request replaces the client's. A header name or value holding CR or LF is refused with `HttpError.Request` before anything is sent, so a request cannot be split in two.

| `HttpError` | Meaning |
|---|---|
| `Url` | not an `http://` or `https://` URL, or malformed |
| `Dns` | the host name could not be resolved |
| `Connect` | the TCP connection could not be made |
| `Tls` | the TLS handshake or the certificate check failed |
| `Io` | a write failed, or the connection ended or stalled past `timeoutMs` before the response was complete |
| `Protocol` | the response is not valid HTTP/1.1 |
| `TooLarge` | a response line is over 64 KiB, or the head has over 256 fields |
| `Redirect` | more than `maxRedirects` redirects, or a `Location` that is not a usable URL |
| `Request` | a request header holds a line break |
| `Aborted` | the sink returned `false` |

Limits are listed in [Known limitations](/known-limitations/).
