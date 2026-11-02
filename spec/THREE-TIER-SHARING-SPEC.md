# Three-Tier Purpose-Bound Sharing, design proposal

Status: proposed architecture, not an implemented three-tier deployment. The current single-process local/cloud gateway is specified in [PRIVACY-GATEWAY-SPEC.md](PRIVACY-GATEWAY-SPEC.md). This proposal does not change that API or claim the legacy handoff scenarios are implemented. Normative words below describe future requirements, not verified behavior.

## Goal and trust boundaries

Keep personal context and methods at the employee device, release only an approved work deliverable to the company, and release an independently approved reduced subtask to a cloud provider only when necessary. Do not recursively upload private memories.

1. **Employee device boundary:** device-side assistant, local inference and request-scoped private mappings. A company-managed laptop is not confidential against its administrator, monitoring, backup or endpoint software. Deployment must disclose this boundary rather than promise hidden privacy.
2. **Company boundary:** authenticated company ingress, authorized company-local model and company business context. It receives the approved deliverable, not employee raw context or device mappings.
3. **Cloud boundary:** explicitly allowed provider, endpoint and model. It receives only the second approved payload. Both upstream mapping sets remain at their originating boundary.

A company-local model is not employee-local. Sending employee originals to a centrally deployed existing gateway already discloses them to the company. Device-side reduction must precede company ingress. Endpoints must have independently verified identity, transport protection, access authorization, retention and egress controls. A hostname labeled local is not evidence of locality or non-forwarding.

## Information classes, not ownership adjudication

`dataOwnerClass` is a handling declaration: `personal`, `employer_work`, `shared_deliverable`, or `mixed_unknown`. It is not a legal title. Storage location does not determine IP ownership. Employee-authored methods can have disputed ownership. Unknown or mixed classifications block sharing until an authorized review separates permitted content and restrictions.

Employer-owned or employer-controlled records must not be unlawfully concealed, appropriated or withheld under a personal-privacy label. An approved deliverable is a limited-use copy, not implied transfer of all IP or permission to train a model. The protocol does not override statutory retention, disclosure duties, contracts or employment rights. Resolve such conflicts transparently outside the protocol; obtain appropriate professional advice.

## Proposed request envelope

Strict schemas, bounded lengths and collection sizes, rejection of unknown fields, authenticated issuer and receiver identities, and tenant isolation are mandatory before deployment. The fields below are conceptual and are not accepted by the current gateway API.

| Field | Meaning and required constraint |
|---|---|
| `requestId`, `parentId` | Opaque per-hop identifiers; validated parent linkage, no private content in identifiers |
| `issuer`, `recipient` | Verified subject, device/service and tenant identities; no self-asserted authorization |
| `purpose` | Approved purpose identifier and bounded approved description; child purpose must be within the parent's machine-enforceable allowed task, never a model's similarity judgment |
| `dataOwnerClass` | Handling declaration above; cannot relabel to bypass inherited restrictions |
| `destinationAllowlist` | Exact permitted recipients and provider endpoint/model identities; a child takes a subset |
| `onwardSharing` | Explicit `deny` by default or bounded allowed onward destinations/actions; distinct from company cloud enablement |
| `actions` | Allowed operations, including separately controlled training, indexing, retention and forwarding; no implicit permissions |
| `expiresAt` | Absolute expiry; child expiry cannot exceed any applicable parent expiry |
| `revokeHandle` | Authenticated revocation lookup checked before every controlled use and dispatch; unavailable lookup fails closed |
| `contextRefs` | Opaque references resolved with the recipient's own permissions; never raw private payload, secret file paths or automatic access grants |
| `labeledEvidence` | Approved facts, inferences and unverified claims with permitted evidence references; no private notes or hidden model chain-of-thought |
| `deliverableRef`, `payloadHash` | Reference to the separately scoped immutable approved deliverable and its integrity binding; envelope is not a personal-context container |
| `approvalBinding` | Authenticated approving principal, exact canonical payload, scope, purpose, destinations, expiry, parent restriction digest and policy revisions |

Private local content and restoration mappings are never placed inside a handoff envelope or receipt. Approved necessary deliverables are separate payloads, not an exception allowing private-context dumps. References do not grant authority to retrieve source context.

## Authorization and independent approvals

Effective permission is the intersection of authenticated issuer authority, employee-granted scope, all applicable parent restrictions, company policy and recipient authorization. Each hop may narrow only. Company administrators and model outputs cannot widen employee-granted scope. Model classification is advisory and may block, never authorize.

Employee approval binds the first exact reduced payload and company destination. Consent to company use and consent to onward cloud sharing are separate controls. This is an application-level authorization, not a claim that employee consent is a sufficient legal basis for all workplace processing.

Company cloud dispatch requires a second independent approval of the exact further-reduced payload, system prompt, parameters, destination and model. Employee onward permission alone does not authorize dispatch. Company enablement alone does not authorize forwarding. A missing permission requires a new explicit grant from the relevant authority or local-only completion, not amendment of the existing grant by an administrator.

Derived outputs inherit source restrictions. Adding company context, summarizing, changing ownership labels or reissuing a request cannot launder a no-forward constraint. For mixed sources apply the intersection; if a source cannot be safely separated, deny the combined export. Source-authorized declassification requires a new explicit reviewed grant, never model inference.

Receipts must be unforgeable, short-lived, single-use and bound to immutable approval state. They contain only minimal binding metadata or opaque handles, never private text, mappings or context. Consume atomically before provider I/O. Revalidate identity, authorization, expiry, revocation and policy before use. Mutation of payload, recipient, purpose, provider, model or policy invalidates approval. Failure consumes the attempted dispatch; retry requires renewed inspection and approval. No implicit cloud fallback.

Revocation stops future controlled operations and invalidates descendants. Expiry cannot be extended through delegation. Neither can recall already copied data, reverse human knowledge or guarantee removal from provider training. Offline operation without fresh revocation assurance cannot claim immediate revocation enforcement.

## Return path, evidence and audit

Cloud output is untrusted data. Validate and combine with authorized company context within the company boundary. Restore only company-owned request mappings there. Return the approved result to the employee, who may optionally restore device-only mappings locally. A restored result is not automatically authorized for re-export.

Evidence may provide concise approved justification, fact citations and uncertainty labels. Do not request, harvest or disclose private human working notes or hidden model chain-of-thought. Fair contribution attribution should concern approved output and agreed outcomes, not surveillance of personal reasoning.

Audit contains coarse event, route, timestamp and permitted aggregate counts. Avoid personal payload, filenames, mappings, tokens and receipts in audit or logs, including proxies and providers. Approval metadata necessary for enforcement belongs in access-controlled, bounded state, not indiscriminate audit exports. Even hashes and pseudonymous IDs can reveal links or be guessed for low-entropy content; do not call them anonymous. Retention of employer records is a separate reviewed policy, not an excuse to retain personal context.

## Bounded execution

No organization-wide vault of employee private memories. Keep per-hop request state and mappings isolated, bounded and short-lived. Specify limits for bytes, refs, evidence items, depth, fan-out, per-user and per-tenant queue length, concurrent inference, timeout and budget. Apply admission control and backpressure before accepting excess work; refuse rather than silently outsource. Retry budgets must be finite and retries require valid fresh approvals.

Prefer device inference and company-local inference where sufficient. Use cloud only for an authorized necessary subtask. Measure total task success, latency, inference cost, disclosed bytes, approval burden and capacity under representative synthetic workloads. There is no unlimited scalability or performance guarantee. The current synchronous Rust scan and single-process request store are not a distributed queue or multitenant enforcement architecture.

## Synthetic example

Salesperson alice keeps personal conversation notes and negotiation methods on the device. She approves product A, quantity 10 and desired delivery timing for a company quotation, with a separate limited onward grant for anonymous wording help. Company-local processing calculates an authorized quote using its own pricing records. It independently approves only a wording task with PRICE and DATE placeholders, no identity, price book or private method. Cloud drafts text. The company checks it and fills its own price/date locally. Alice may add personal style on-device. Sending the final message is a separate authorized action. If local drafting suffices or onward permission is absent, do not call cloud.

## Implementation and verification gates

Existing gateway code provides bounded local/cloud inspection and exact-preview approval within one process. It does not yet provide the employee/company/cloud topology, federated identity, employee-specific consent, cross-hop policy inheritance, distributed revocation or tenant isolation. Do not advertise these from existing green gateway tests. Any standalone envelope helper would remain a policy component, not proof of an integrated three-tier runtime.

Future acceptance cases must demonstrate, with synthetic data:

- Personal originals and device mappings never reach company ingress; company mappings never reach cloud.
- Employee no-forward blocks cloud despite company enablement and administrator attempts to widen.
- Destination, action, purpose and expiry expansion fail; unknown/mixed classification fails closed.
- Derived and mixed-source tasks preserve every applicable restriction.
- Both approvals bind exact distinct payloads; tampering, replay and stale policy fail.
- Revocation/expiry before queued dispatch blocks it, including descendants; lookup outage fails closed.
- Cross-user, cross-device and cross-tenant receipt/ref use fails authentication or authorization.
- Prompt injection and model recommendations cannot alter authority.
- Saturated queues, provider errors and retries never trigger unapproved fallback or unbounded fan-out.
- Receipts, audit and error paths contain no private payload or restoration mapping.

Production readiness additionally requires threat modeling of endpoint administrators and malicious recipients, device isolation, authenticated transport, key management, provider retention review and operational testing. Technical controls cannot prevent an already authorized malicious recipient from copying visible data outside a cooperative protocol.

## Non-goals and grounding

No ownership adjudication, legal advice, employment protection guarantee, zero leakage, universal privacy monopoly over knowhow, guaranteed revenue or universal model/performance support. Contribution recognition, bonuses and voluntary knowledge licensing are possible organizational incentives, not product guarantees.

NIST defines minimization around processing and retaining personal information necessary for an authorized purpose; this supports a design direction, not certification of this system. [NIST minimization glossary](https://csrc.nist.gov/glossary/term/minimization).

ICO guidance concerns UK workplace monitoring and emphasizes transparent, necessary monitoring. It motivates explicit device-control disclosures here, not a universal legal rule or an ownership conclusion. [ICO monitoring workers guidance](https://ico.org.uk/media/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers-1-0.pdf).
