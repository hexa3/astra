# Astra governance

## Status and purpose

Astra is currently an unincorporated, community-governed open-source project. It is not yet a legal foundation or nonprofit, and no company owns a special roadmap vote. This charter supplies a foundation-style public process now; forming or joining a legal nonprofit requires a public RFC under the protected-change rules below.

The project's duty is to users: preserve private, inspectable, forkable browser software. Maintainers administer that duty. They do not own it.

## Participation and proposals

Anyone may report a problem, submit a pull request, or open a Request for Comments (RFC). Use the public RFC issue form and copy `governance/rfcs/0000-template.md` into a pull request for proposals that change architecture, policy, data handling, compatibility, funding, or this charter. Ordinary fixes can proceed through normal review.

An RFC stays open for at least 14 days. Its author must record alternatives, privacy and accessibility effects, compatibility impact, funding conflicts, and the final tally. Decisions and dissent remain in Git history. Security vulnerabilities use the repository's private security-reporting channel until coordinated disclosure; they are not litigated in a public issue before users can patch.

## Maintainers and the bootstrap period

The recorded project author, GitHub user `@hexa3`, is the bootstrap steward and release signer. That role exists because Astra does not yet have three eligible independent maintainers; it is not a permanent casting vote.

A contributor becomes eligible for nomination after at least three accepted, substantive contributions across 60 days, or six months of sustained issue triage, testing, documentation, translation, or community support. Anyone may nominate an eligible contributor using the public nomination form. After a 14-day comment period, active maintainers vote. A simple majority elects a maintainer; during bootstrap, a nomination also requires two public endorsements from contributors other than the nominee and steward. Maintainers may resign at any time and may be removed by a two-thirds vote for inactivity, abuse, undisclosed conflict, or repeated charter violations, after a documented chance to respond.

Bootstrap ends automatically when three independent maintainers are active. From then on, no person or employer may hold more than one-third of maintainership seats. If employment changes break that rule, the affected maintainers select who becomes non-voting emeritus within 30 days.

## Decisions, disputes, and appeals

Routine changes need one approving maintainer and passing required checks. Architecture, release, policy, or spending RFCs need a majority of non-recused active maintainers. Protected changes need three-quarters of non-recused active maintainers, at least two affirmative votes, and a 30-day public review. During bootstrap, protected changes additionally require three public contributor endorsements; the steward cannot approve one alone.

Disputes begin with a written summary of agreed facts and disputed tradeoffs on the RFC. A maintainer who did not author the proposal mediates. Any participant may appeal once, triggering a seven-day maintainer vote with individual votes and reasons recorded in `governance/votes/`. Ties preserve the status quo. Conduct and safety disputes may redact personal information, but the outcome and policy basis remain public.

The following are protected changes:

- licensing or governance rules;
- collection, sale, sharing, or monetization of user data;
- search placement, advertising, sponsorship, or default-service contracts;
- weakening privacy or security defaults;
- spending, accepting restricted funds, or forming/choosing a legal entity;
- removing the stable core/shell interface or reproducible-release requirement.

## Conflict of interest and money

Maintainers disclose financial or organizational interests relevant to a decision and recuse from its discussion and vote. Recused votes do not count toward the denominator. Funding proposals disclose the payer, amount or range, restrictions, deliverables, and decision makers before acceptance. The public treasury ledger records money received and spent; invoices may redact personal addresses or bank details, never the counterparty organization, amount, purpose, or material terms.

Astra will not accept search-engine placement payments, advertising revenue, behavioral-data revenue, paid default placement, or contracts requiring weakened privacy, closed features, exclusivity, or preferential governance. Enterprise support purchases service levels and expertise only. Donations and grants buy no roadmap vote. These commitments are protected changes, but MPL 2.0 ensures that if future governance abandons them, the existing covered code remains available for an open community fork.

## Releases and custody

Releases require passing tests, reproducibility evidence, a published checksum manifest, and approval by a maintainer who did not create the release candidate once two maintainers exist. Until then, the bootstrap steward may release only when CI independently rebuilds and verifies the candidate. Signing keys, repository administration, domains, and funds must move to multi-party custody when a legal nonprofit or three-maintainer council exists. No maintainer may make a private release from project infrastructure.

The authoritative governance record is this repository: RFC files, vote records, the treasury ledger, pull requests, and Git history. A hosting-platform outage does not invalidate cloned records or MPL rights.
