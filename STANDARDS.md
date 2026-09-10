# Standards discipline

Astra will not add proprietary JavaScript, CSS, markup, network, or device APIs to ordinary web pages. A site opened in Astra must not need Astra-specific code, and a feature built for Astra must not make the public web depend on Astra.

This is a permanent engineering policy. It applies to first-party code, optional components, extensions shipped by the project, experiments, and vendor integrations.

## Enforced boundary

All tabs and Peek views are untrusted web content. They are created through the single policy in `src/core/web-boundary.ts`: Chromium's sandbox and web security remain enabled; Node integration and `<webview>` are disabled; and, critically, there is no preload script. `window.astra` therefore does not exist on websites.

The versioned `window.astra` Core API exists only inside Astra's packaged `file:` chrome document. Main-process authorization independently rejects IPC from every other URL. This is a private browser-shell interface, not a web-platform API.

`tests/standards.test.ts` fails if a second page-view construction bypasses the central policy, if another source file exposes a context bridge, or if an audited custom surface is missing. Browser E2E tests also assert that remote pages see neither Node nor `window.astra`.

## Current audit

The complete, machine-readable inventory is [`docs/standards-audit.json`](docs/standards-audit.json). The Phase 1 and Phase 2 custom surfaces have these dispositions:

| Surface | Implementation | Web-platform result |
| --- | --- | --- |
| Boosts | User-requested CSS and JavaScript applied by browser chrome to one hostname | Uses existing CSS, ECMAScript, and DOM behavior; exposes no API to the page |
| Resource/privacy panel | User-agent request observations shown in browser chrome | Exposes no API to the page |
| Local AI assistant | Explicit browser action reads rendered text into a local provider | Exposes no API to the page and does not alter DOM contracts |
| Peek | A second ordinary sandboxed browsing context | Same standards surface as a normal Astra tab |
| Core API | Versioned IPC for packaged shells | Restricted to trusted local chrome; not a web API |
| Sync | Documented HTTPS service protocol between client and chosen server | Not reachable as a privileged web API |

No audited capability creates a genuinely novel web-platform primitive, so inventing a W3C/WHATWG proposal for one would misclassify browser UI as web platform. The proposals directory records this conclusion and is ready for future proposals.

## Change rule

Any change that could alter a website-visible surface must:

1. add or update an entry in the machine-readable audit;
2. include an interoperability and fingerprinting review;
3. prefer an existing interoperable standard;
4. remain behind browser chrome while a standard does not exist; and
5. if a new primitive is genuinely necessary, publish a concrete proposal in `docs/standards-proposals/` before enabling it by default and pursue it in the appropriate W3C/WHATWG venue.

Experimental website-visible behavior must be off by default, clearly labeled, and removable. Shipping an unreviewed vendor-prefixed API is prohibited.

## Verify it

```sh
npm test -- --test-name-pattern standards
npm run test:e2e
```

The first command checks the structural policy and inventory. The second launches real Electron pages and verifies the runtime isolation boundary.
