# Funding Astra without selling its users

## Current status

Astra has received **USD 0** and currently has no donation processor, fiscal host, foundation bank account, paid search agreement, or enterprise-support contract. The authoritative public balance is `governance/treasury/ledger.csv`. This is a closed-intake default: proposals are open, but nobody is authorized to collect money in Astra's name until the recipient, payment rail, terms, and reporting have passed the protected public process in `GOVERNANCE.md`.

This avoids a common governance fiction: a funding button controlled by one person's private account is not a community treasury.

## Three permitted funding paths

### 1. Astra Community Fund donations

Unrestricted individual donations may support shared infrastructure, accessibility testing, security review, signing certificates, and contributor grants. To activate this path, propose a nonprofit fiscal host or project-controlled multi-party account with the funding proposal form. The RFC must publish fees, custody, refund policy, legal recipient, jurisdictions served, and exportable transaction reporting. After approval, this file and `.github/FUNDING.yml` will link the processor and every settled payout will be entered in the ledger.

Donors receive thanks and receipts where the legal recipient can issue them—not feature priority, governance seats, private telemetry, default placement, or influence over privacy policy. Anonymous public attribution is allowed, but maintainers handling compliance may need to know a payer's identity.

### 2. Public-interest grants

Foundations, universities, public agencies, and other grant makers can open a funding proposal before an application is accepted. It must name the grantor, amount or range, deliverables, reporting burden, intellectual-property terms, and restrictions. Acceptance requires the protected funding vote. Allowed grants fund work that remains available under Astra's open license; prohibited terms include exclusivity, closed deliverables, user-data access, vendor lock-in, paid defaults, or control of releases and governance.

### 3. Optional enterprise support

An organization may request paid installation help, deployment review, accessibility assistance, security-response coordination, training, or a support-time SLA through the enterprise support form. The public proposal records the organization, scope, price or range, term, assigned provider, and any effect on maintainers' available time. Personal contacts and security details can move to a private contract channel, but the material commercial terms and any project payment remain public.

Support is a service around the same open software everyone receives. It cannot purchase an exclusive feature, delayed public fix, proprietary edition, roadmap vote, telemetry, certification favoritism, or weaker defaults. Until an approved legal recipient and provider are recorded, Astra offers community support only and no contributor may imply they contract on behalf of the project.

## Permanently excluded revenue

Astra does not accept:

- search-engine placement or default-service payments;
- advertising, affiliate tracking, lead sales, or behavioral-data revenue;
- sale, licensing, or disclosure of browsing data;
- sponsorship conditioned on weakening privacy or security;
- paywalled browser features, proprietary core modules, or private early security fixes;
- funds that buy appointments, votes, release authority, or exclusive roadmap control.

Changing these exclusions is a protected governance change, not an ordinary maintainer edit. MPL 2.0 remains the legal fork backstop if future governance violates the policy.

## Proposal-to-ledger flow

1. Open the public funding proposal and disclose all requested fields.
2. Complete the protected review and record each vote and conflict recusal.
3. Merge the accepted RFC before signing or collecting funds.
4. Use only the legal recipient and payment rail named in that RFC.
5. Add each settlement or expense to the append-only ledger within seven days, linking public evidence. Correct errors with reversing entries, never history rewrites.
6. Publish a quarterly reconciliation even when the balance is zero.

Payment credentials, bank details, home addresses, tax identifiers, sync keys, and user data never belong in Git or the public ledger.
