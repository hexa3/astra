# Astra reference sync server

This directory is the complete identity-free protocol 1 server. It stores opaque
client-encrypted blobs and has no account, email, OAuth, database, telemetry, or
Astra-operated dependency.

Run `docker compose -f sync-server/compose.yaml up -d --build` from the repository
root. See [the deployment and threat model](../SYNC.md) before exposing it beyond
loopback, especially the TLS requirement and metadata/rollback limitations.
