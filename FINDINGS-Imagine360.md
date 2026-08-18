# Imagine360 — Large-File Memory Issue: Root Cause & Fix

## Summary
The Intake app runs out of memory (and stalls concurrent processing) when handling
the large enrollment files (~40–50 MB zips that expand to ~250 MB of XML). We
reproduced the failure in an isolated app, identified the exact cause from a JVM
heap dump, and verified a fix that processes the same 250 MB file with flat memory.

---

## Root cause
The failure is **not** the DataWeave transform logic and **not** solved by adding
more heap. It is **whole-file materialization in memory** at two points in
`enrollment-prebr-ob-trigger-common-flow` / `-transform-common-flow`:

1. **`compression:decompress` (zip) inflates the entire file into a single heap byte array.**
   Heap-dump evidence: one `byte[]` of 128 MB doubling toward 256 MB — i.e. the
   whole 250 MB decompressed payload held in RAM. The connector's zip decompressor
   does not stream to disk; adding `repeatable-file-store-stream` / `inMemorySize`
   around it does not change this.

2. **The transform uses `output application/java` and then wraps the whole result**
   (`requestObject ++ { payload: payload }`). `output application/java` cannot
   stream — it builds the full in-memory object list — and the wrap pins it again.

Because each in-flight file holds ~250 MB+, the 16 GB heap masks it for a single
file but collapses under **concurrency**: multiple large files stack 250 MB
allocations, exhaust the heap, trigger GC thrash, and other threads/requests stall.
This matches the reported "stalls with concurrent processing."

---

## Proof (isolated reproduction, identical file & runtime)
Two flows, same 250 MB file (`enroll-250mb.zip`), same worker:

| Flow | What it does | Result |
|------|--------------|--------|
| **Customer pattern** | `compression:decompress` → `output application/java` → wrap payload | **Crash / 502 in ~8s** (worker OOM); app then unavailable ~60s while it restarts |
| **Streaming fix** | streaming unzip to disk → streaming transform → write to sink | **200 OK**, completes, flat memory |

The OOM'd worker returning 502 for ~60s *is* the "concurrent processes stall"
symptom — one large file taking down the whole worker.

---

## The fix (three changes)
1. **Stream the decompression instead of using the connector's in-memory inflate.**
   Read the zip entry through a bounded 64 KB buffer straight to a temp file on
   disk (e.g. a small `java.util.zip.ZipInputStream` script), so the inflated
   bytes never accumulate on the heap. Then read that file back as a
   repeatable-file-store-stream.

2. **Make the transform stream.** On the DataWeave transform use:
   - `input payload application/xml streaming=true`  (read records as a
     forward-only cursor, not a full DOM)
   - `output application/json deferred=true`         (produce output lazily)
   - keep the body a forward-only `map` — avoid `sizeOf`, `orderBy`, `groupBy`,
     last-index `[-1]`, and any operation that needs the whole set at once.

3. **Write the transformed output straight to the outbound sink** (SFTP/S3 per
   vendor) instead of building `output application/java` and wrapping it in
   `requestObject.payload`. Nothing accumulates in memory.

### Supporting measures
- If the upstream can change format, **gzip streams far better than zip** in Mule.
- On the S3 write-back, set `contentLength` explicitly so the S3 connector does
  not buffer the whole body to compute the length.
- Cap `maxConcurrency` on the large-file flow so a burst can't stack multiple
  large allocations.

---

## Bottom line
- The memory problem is caused by **fully loading the file into memory** at the
  unzip and transform steps — a streaming defect, not an under-sized heap.
- Raising heap only delays it and fails under concurrency (their exact symptom).
- Streaming the unzip + transform (and writing directly to the sink) processes the
  same 250 MB file with **flat, small memory**, verified on the same worker where
  the current pattern crashes.
