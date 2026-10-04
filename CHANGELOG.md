# Changelog

## Unreleased

- Prevent stale attendance data by marking the remote JSON response as
  non-cacheable in `data/.htaccess` and adding a per-request cache-busting
  parameter in both UI variants.
- Return explicit non-cacheable headers from the local FastAPI status endpoint.
