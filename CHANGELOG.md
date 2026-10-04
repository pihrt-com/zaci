# Changelog

## Unreleased

- Prevent stale attendance data by adding a per-request cache-busting parameter in both UI variants and documenting the required WEDOS CDN cache exemption for the public JSON.
- Return explicit non-cacheable headers from the local FastAPI status endpoint.
