# Clean bundle restore drill

Date: `2026-07-29`
Result: `PASS`

## Procedure

1. Created a complete `git bundle` from the clean Sites checkpoint.
2. Ran `git bundle verify`.
3. Cloned a new repository using only that bundle.
4. Installed from the zero-dependency lockfile with scripts disabled.
5. Ran the complete production build in the restored clone.
6. Re-ran all `16` tests.
7. Compared the restored public receipt byte-for-byte with the source
   checkpoint's receipt.

## Result

- Restored commit:
  `ed8c281d14914e20e1f2a5762fa11436edf06da0`
- Bundle verification: complete history, `PASS`
- Restored build: `PASS`
- Restored tests: `16/16`
- Receipt comparison: byte-identical
- Elapsed time in the local test environment: `1` second
- Bundle SHA-256:
  `a30b3dba785443eb3668f1beb02c86150004706a897a50c94df4f84ca6c8e5a6`
- Restored public receipt file SHA-256:
  `d9da2fde28ac9d3aa41d2090c3f72bbb40a1b2d1a14e1112681a353cd278ab94`

## Boundary

This proves the recovery procedure and source completeness. The temporary
bundle used for the drill is not claimed as a durable backup. Two encrypted
copies in separate failure domains, plus the administrative recovery records,
must still be created when the dedicated canonical repository and domain are
established.
