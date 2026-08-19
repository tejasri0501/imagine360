# imagine360-streaming-largefile-demo

A minimal Mule 4 app that reproduces Imagine360's ETL — **read a large XML
extract → transform per-vendor in DataWeave → write an output file** — and
proves it runs at **flat heap with no manual file splitting**.

## Background (from the 2026-07-29 call)
On Mule 3, Imagine360 processed ~100 MB files fine. After the Mule 4 migration,
anything past ~20 MB fails, so the team splits a weekly ~4 GB file with a Python
script before Mule can handle it. The cause is **DataWeave indexing the whole
document into memory by default**. Two settings fix it — this app demonstrates
both and was verified to move a **351 MB file under a 512 MB heap cap** (it OOMs
without the fix).

## The fix (two DataWeave settings)
In the transform that reads the big file (`streaming-largefile-demo.xml`, flow
`process-big-file`):

```dataweave
%dw 2.0
input payload application/xml streaming=true   // fix #1 READ  — parse forward-only, do NOT index the DOM into heap
output application/xml deferred=true            // fix #2 WRITE — emit the result lazily, stream into file:write
---
{ VendorFeed: { (payload.Extract.*Record map (r) -> { Line: { recordId: r.id, ... } }) } }
```

- **`input ... streaming=true`** — the reader directive that stops the "memory
  indexing" Blake referenced. DataWeave parses the XML as a forward-only stream
  instead of building an in-memory tree. **This must live in the DataWeave
  header** — setting it as a connector `outputMimeType` alone does **not** stop
  the indexing (verified: that path still OOMs).
- **`output ... deferred=true`** — DataWeave produces the output lazily as the
  downstream `file:write` / `s3:put-object` / `sftp:write` consumes it, so the
  full output document never lives in heap.
- The `file:read` also wraps the raw bytes in a
  `<ee:repeatable-file-store-stream>` so the source stream spools to disk past
  `inMemorySize` and stays off-heap.

Read (`streaming=true`) **plus** Write (`deferred=true`) together = transform an
arbitrarily large file at flat heap. **The same two settings apply whether the
source/target is File, SFTP, or S3 — only the connector element changes.** The
File flow runs with no credentials; the S3/SFTP flows are wired to real endpoints
(see below).

## Streaming pass-through: SFTP → S3 via multipart upload (`sftp-to-s3-streaming.xml`)
**`GET /sftp-to-s3`** moves a large file from SFTP to S3 with no transform, using
an **S3 multipart upload**. This is the clean way to send a large object with
**no staging file** and **no `contentLength` buffering** (a single `put-object`
of an unknown-length stream makes the connector buffer the whole body into heap
to measure it — multipart avoids that entirely):

1. `sftp:read` as a `<ee:repeatable-file-store-stream>` with
   `outputMimeType="application/octet-stream"` — the content stays raw bytes on a
   seekable, disk-spooled cursor (forcing octet-stream matters: the `.xml`
   extension would otherwise make DataWeave parse it into an object and
   byte-slicing would fail).
2. `s3:create-multipart-upload` → an `uploadId`.
3. A `foreach` over the file in 10 MB parts (S3's min part size is 5 MB, except
   the last): each part is a byte slice `payload[start to end]` of the seekable
   stream, sent via `s3:upload-part` (`content` attribute, `contentLength` = part
   size). Each part's `{ partNumber, eTag }` is collected.
4. `s3:complete-multipart-upload` with the collected `<s3:completed-parts>`
   assembles the final object. `on-error` aborts the upload so no orphan parts
   are billed.

Only one 10 MB part is in heap at a time, so heap stays flat regardless of file
size.

**Verified:** 351 MB moved SFTP → S3 as **36 parts** in ~60s under `-Xmx512m`,
zero OOM. The assembled S3 object was **byte-for-byte identical to the source**
(matching MD5, 367,557,851 bytes). Override the file per call with `?file=<name>`.

## Pure streaming pass-through: S3 → SFTP (`s3-to-sftp-streaming.xml`)
The reverse move — **`GET /s3-to-sftp`** streams a file straight from S3 to SFTP,
again with no transform:

- `s3:get-object` returns the content as a `<ee:repeatable-file-store-stream>`
  (bytes spool to disk; heap stays flat).
- `sftp:write` streams that InputStream to the SFTP server. Unlike `s3:put-object`,
  `sftp:write` consumes the stream synchronously and does **not** buffer to measure
  length, so no `contentLength` is needed.

**Verified:** 351 MB moved S3 → SFTP in ~29s under `-Xmx512m`, zero OOM; the file
landed on SFTP at the exact source byte count (367,557,851 bytes). Override the
file per call with `?file=<name>`.

## Connector-accurate variants (S3 + SFTP)
`streaming-largefile-demo-connectors.xml` adds two flows that map 1:1 onto
Imagine360's real integration — input extract in **S3**, per-vendor delivery over
**SFTP**:

- **`GET /process-s3`** — read big XML from S3 → transform → write result to S3.
- **`GET /process-sftp`** — read big XML over SFTP → transform → write over SFTP.

Both use the same two DataWeave settings, then **stage the transformed output to
a local temp file and stream that file up** (the deferred DataWeave stream is
consumed synchronously by `file:write`, so staging stays flat-heap; the temp
file is deleted after upload).

Getting a large file through the S3/SFTP connectors surfaced **two connector
gotchas** that the File flow never hits — both verified to OOM or corrupt output
if omitted, on a 351 MB object under `-Xmx512m`:

1. **`outputMimeType="application/xml"` on `s3:get-object` / `sftp:read`.**
   Unlike `file:read` (which infers the type from the `.xml` extension), these
   return raw **Binary**, so `payload.Extract` fails and the deferred writer
   silently emits a **0-byte** file. Typing the read as XML fixes it.
2. **`contentLength` on `s3:put-object`.** Without it, the S3 connector (v7.x)
   calls `determineStreamLength()`, which buffers the **entire body** into a
   `ByteArrayOutputStream` to measure it — that alone **OOMs** on a large object
   even though read/transform/stage are all flat-heap. Passing the staged file's
   known size (`attributes.size`) streams directly. (SFTP write has no such
   buffering, so it needs no length.)

### Verified S3 / SFTP results (351 MB input, `-Xmx512m`)
| flow          | output              | time |
|---------------|---------------------|------|
| `/process-s3`   | 279 MB S3 object    | ~48s |
| `/process-sftp` | 279 MB SFTP file    | ~46s |

Both complete with **zero OutOfMemoryError** and valid XML output — the JVM
surviving a file far larger than its 512 MB heap is the proof that nothing is
buffered whole.

### Configure the S3/SFTP endpoints (`configuration.yaml`)
- `s3.accessKey` / `s3.secretKey` / `s3.region` / `s3.bucketName`
- `sftp.host` / `sftp.port` / `sftp.username` / `sftp.password` / `sftp.workingDir`
- `input.fileName` must already exist in the bucket / SFTP working dir; the
  output is written as `output.fileName`.

## Flows (`src/main/mule/streaming-largefile-demo.xml`)
1. **`GET /generate`** — builds the big test XML input file so you don't need the
   Python split script to create test data. Size is controlled by `gen.records`
   in `configuration.yaml` (2,000,000 ≈ 350 MB; raise to 20M+ for multi-GB).
   Uses a lazy range + `deferred=true`, so even a multi-GB file writes at flat heap.
2. **`GET /process`** — the ETL. Reads the big XML (streaming), transforms
   per-vendor (deferred output), writes `vendor-output.xml`. Logs a marker at
   start, after the read stream, and after the write (`[PROC] ...`). Under a low
   `-Xmx` it completes on a file much larger than heap — that is the proof.

## Configure (`src/main/resources/configuration.yaml`)
- `work.dir` — working folder for input/output (needs free disk for the test file)
- `input.fileName`, `output.fileName`
- `gen.records` — number of records the generator emits (controls file size)

## Run & prove it
```
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home   # JDK 17
mvn clean package -DskipTests
# deploy the target/*.jar to a Mule 4.9+ runtime with a LOW heap, e.g. -Xmx512m
curl http://localhost:8081/generate      # make a ~350 MB file
curl http://localhost:8081/process       # transform it — succeeds at flat heap
```

### Verified result (351 MB input, `-Xmx512m`)
~12s, 2,000,000 records, valid 267 MB output, **zero OutOfMemoryError**. With
`streaming=true` removed from the header, the same run **OOMs** (DataWeave builds
a ~1 GB DOM) — that is the customer's current failure, reproduced and fixed.
The proof is simply that the run finishes: a 351 MB file cannot pass through a
512 MB heap unless it is streamed, not buffered.

## Notes / what to watch
- **Pure MuleSoft — no custom Java.** The whole demo is connectors + DataWeave,
  so it drops straight into the customer's Studio project.
- **Disk**: RFSS and the file store spool to the runtime temp dir, so keep free
  disk ≈ the file size while streaming. On CloudHub size the worker disk to match.
- `inMemorySize="1" bufferUnit="MB"` is deliberately tiny to force disk spooling
  early and make the memory behaviour obvious; production would tune it up.
- To port to the customer's real flows: keep the two DataWeave header settings,
  swap `<file:read>`/`<file:write>` for their `<sftp:*>` or `<s3:*>` operations,
  and drop in their real per-vendor DataWeave mapping in place of the sample one.
```
