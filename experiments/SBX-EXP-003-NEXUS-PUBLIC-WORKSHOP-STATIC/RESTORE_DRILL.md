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
  `941deed827981831709c2109ff0fe38a167f04bf`
- Bundle verification: complete history, `PASS`
- Restored build: `PASS`
- Restored tests: `16/16`
- Receipt comparison: byte-identical
- Elapsed time in the local test environment: `1` second
- Bundle SHA-256:
  `5791a56753917d3320d05a82ca4cb89338b8910082a13752d2714fc372c02f0a`
- Restored public receipt file SHA-256:
  `4a9e19e4cfde5194d4f3d47fefb901f4e2ed9b128d5afc8be39447b86e003579`

## Boundary

This proves the recovery procedure and source completeness. The temporary
bundle used for the drill is not claimed as a durable backup. Two encrypted
copies in separate failure domains, plus the administrative recovery records,
must still be created when the dedicated canonical repository and domain are
established.
