# Self-hosted, identity-free sync

Astra syncs bookmarks, history, and workspace IDs/names to a server you choose.
There is no Astra account, email address, hosted identity provider, default cloud,
or discovery request. Merely configuring sync makes no network request: exchange
happens only when the user presses **Sync now** and supplies the passphrase.

## Run the reference server

The server is one dependency-free Node.js file, an MPL-2.0 Dockerfile pinned by
digest, and a hardened Compose definition. From a source checkout:

```sh
docker compose -f sync-server/compose.yaml up -d --build
curl http://127.0.0.1:8787/health
```

The response is `{"status":"ok","protocol":1}`. The named Docker volume
`astra-sync-data` is the only durable server state. Back up that volume to retain
encrypted device envelopes. There is no user database to export.

The container runs as the unprivileged `node` user, drops all Linux capabilities,
uses a read-only root filesystem and `no-new-privileges`, and writes only `/data`.
Set `ASTRA_SYNC_PORT` before the Compose command to change the published port.

For access beyond the same machine, put port 8787 behind a TLS reverse proxy you
control and use its `https://` URL in Astra. The browser rejects cleartext HTTP
except for `localhost`, `127.0.0.1`, and `::1`, because the request authentication
key must not cross an unencrypted network. Do not expose the reference HTTP port
directly to the internet.

The server can also run without Docker on Node.js 24 or newer:

```sh
ASTRA_SYNC_DATA_DIR=/absolute/path/to/data \
ASTRA_SYNC_HOST=127.0.0.1 \
ASTRA_SYNC_PORT=8787 \
node sync-server/server.mjs
```

## Pair devices

1. Open **Encrypted storage settings** in Astra.
2. Enter the server endpoint, a short allowlisted device ID, and a unique
   passphrase of at least 16 characters. Leave Realm empty on the first device.
3. Press **Set up sync**, then **Sync now**. Copy the displayed Realm.
4. On another device, enter the same endpoint, Realm, and passphrase with a
   different device ID. Press **Set up sync**, then **Sync now**.

The 43-character Realm is random pairing metadata, not an account name or a
secret. `sync.toml` also contains a verifier that detects mistyped passphrases;
the verifier cannot authenticate to the server or decrypt content, but—like any
password verifier—it permits offline guessing. Use a long, unique passphrase and
do not publish `sync.toml` if the passphrase is weak. The passphrase, authentication
token, and content key are never written to the config directory or sent to Astra.
There is no recovery service: retain the Realm, endpoint, and passphrase yourself.

Disabling sync removes pairing metadata from this device. It does not delete
server blobs or affect another device. Server-side device deletion is intentionally
an administrative filesystem operation in protocol 1; stop the service, remove
the selected `<namespace>/<device>.json`, and restart it.

## What the server sees

The client applies scrypt to the passphrase and random Realm, then HKDF derives
separate 256-bit authentication and content keys. The server receives the
authentication key over TLS, hashes it into an opaque namespace, and never stores
that key. Browser data is JSON encrypted with AES-256-GCM under the separate
content key, with the protocol version, device, and sequence bound as authenticated
context. Each upload uses a fresh nonce.

Server storage contains only:

- a SHA-256 namespace directory;
- an allowlisted device ID, protocol version, and monotonic sequence;
- randomized authenticated ciphertext.

It does not contain the Realm, passphrase, email, auth key, content key, URLs,
titles, workspace names, or plaintext records. The implementation tests scan the
actual server files for representative private content and both keys.

A fully compromised server or TLS endpoint can observe timing, blob sizes, device
IDs, IP addresses, and the authentication key used for requests. It can deny
service, delete blobs, or replay an older valid blob. It still cannot derive the
separately derived content key, decrypt records, or forge a modified ciphertext
that clients accept. Protocol 1 does not claim traffic-analysis protection,
anonymity, multi-server consensus, or rollback detection.

## Protocol 1

| Request | Purpose |
| --- | --- |
| `GET /health` | Unauthenticated liveness and protocol version |
| `GET /v1/sync` | List this key's opaque per-device envelopes |
| `PUT /v1/sync/:device` | Replace that device envelope with a higher sequence |

Authenticated requests use `Authorization: AstraSync <base64url-auth-key>`.
There is no registration route. Possession of a derived key creates/accesses its
own otherwise unenumerable namespace. Requests and ciphertext are bounded; each
namespace is limited to 32 devices and 32 MiB. Replayed or non-increasing device
sequences are rejected.

Clients validate and authenticate every envelope before merging. Entries are
deduplicated by record ID/time, history is capped at 2,000 records, and workspace
IDs are merged deterministically. A sync failure leaves the local dataset intact
and is shown in the UI.
