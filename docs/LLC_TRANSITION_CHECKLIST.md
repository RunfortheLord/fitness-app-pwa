# Individual-to-LLC Publication Transition Checklist

- **Current operator:** Adam Shugart, individual, Texas
- **Target operator:** Owner-approved Texas limited liability company
- **Product:** Vigorune Version 1, free U.S.-only release
- **Last reviewed:** August 20, 2026

This is the execution checklist for forming the LLC and making it—not merely a
brand name—the contracting publisher and service operator. Formation alone
does not transfer source code, domains, contracts, vendor accounts, user data,
or App Store seller identity.

Complete entity, tax, and privacy steps with qualified Texas business counsel
and a tax professional. Keep certificates, EIN records, banking data,
credentials, contracts, identity documents, and signed assignments outside
this repository.

## Rule for Apple publication timing

If the intended App Store seller name is the LLC, do not enroll and publish as
an individual merely to move faster. Apple lists an individual member's legal
personal name as seller. An organization must be a legal entity, have a D-U-N-S
Number, use an organization-domain work email and functional public website,
and be enrolled by someone with authority to bind it.

If an individual Apple Developer membership or app record already exists,
contact Apple Developer Support before submission to determine whether to
convert the membership or transfer the app. Preserve the bundle identifier
`com.adamshugart.fitnesslog` and all application/persistence identifiers.

## Phase 1: Decisions before filing

- [ ] Select the exact Texas LLC legal name after Texas availability and
      trademark/confusion review. A state filing acceptance is not trademark
      clearance.
- [ ] Decide whether `Vigorune` is the final product mark and whether it will be
      owned by the LLC. Do not rename bundle, database, storage, backup, OAuth,
      or URL-scheme identifiers for a marketing-name change.
- [ ] Select the registered agent and Texas registered office with affirmative
      consent; decide whether the public address is appropriate.
- [ ] Decide member-managed versus manager-managed structure, initial member,
      organizer, business purpose, mailing/principal address, and effective date.
- [ ] Have counsel prepare/review the certificate of formation, operating
      agreement, initial consent/resolutions, IP assignment, and assignment or
      assumption of pre-formation contracts and liabilities.
- [ ] Have a tax professional confirm federal tax classification, Texas
      franchise-tax obligations, accounting method, owner contributions, and
      whether any election is appropriate. Do not default to an S-corporation
      election without tax advice.
- [ ] Choose the organization's public domain, website, work email, support
      email, legal/privacy email, and mailing address. Apple requires a work
      email associated with the organization domain and a functional public
      website for organization enrollment.
- [ ] Decide the effective cutover date on which the LLC becomes service
      operator/data controller and signs new agreements.

## Phase 2: Form the company

- [ ] File Texas Form 205, Certificate of Formation—Limited Liability Company,
      through the Texas Secretary of State/SOSDirect using reviewed information.
- [ ] Save the filed/stamped certificate, filing receipt, entity file number,
      registered-agent consent, and final governing documents.
- [ ] Sign the operating agreement and initial company consent/resolutions.
- [ ] Obtain the EIN directly from the IRS after formation; the IRS application
      is free. Save the EIN confirmation letter.
- [ ] Establish the Texas Comptroller account/Webfile access and calendar every
      franchise-tax/public-information filing requirement, even if no tax is
      due. Confirm current due dates and thresholds with the Comptroller/CPA.
- [ ] Have counsel confirm the then-current federal beneficial-ownership
      reporting rule and whether a FinCEN filing is required. Do not rely on an
      old checklist because this requirement has changed repeatedly.
- [ ] Create a W-9 and consistent legal-name/EIN record for vendors.
- [ ] Open a business bank account and bookkeeping ledger. Keep company and
      personal funds, subscriptions, reimbursements, and app expenses separate.
- [ ] Obtain appropriate general, cyber/privacy, and technology errors and
      omissions coverage, or document the owner-approved uninsured risk after
      broker/counsel advice.

## Phase 3: Transfer ownership and authority

- [ ] Execute an IP assignment to the LLC covering the source code, designs,
      documentation, app icon/brand assets, domain, product mark rights,
      screenshots, original copy, and other owner-created release assets.
- [ ] Inventory third-party/open-source licenses and content rights; transfer
      only rights that are assignable and obtain consent where required.
- [ ] Assign or replace pre-formation service contracts, DPAs, licenses, and
      vendor terms. Record which provider accepted the LLC as customer and the
      effective date.
- [ ] Transfer/control the domain registration, DNS, organization email,
      password manager, code-hosting organization, recovery methods, and
      administrator access. Keep at least two tested recovery paths where
      possible.
- [ ] Adopt written authority for Adam to accept Apple, Google, Supabase,
      Vercel, Upstash, OpenAI, banking, and other contracts for the LLC.
- [ ] Record company ownership of the production secrets and rotate credentials
      that remain tied to personal accounts when rotation can be done safely.

The assignment packet must identify the exact pre-formation assets and whether
the LLC assumes related obligations. Do not rely on a generic statement that
“the app belongs to the LLC.”

## Phase 4: Apple organization enrollment

- [ ] Confirm the LLC's Texas record is active and its legal name/address are
      consistent across state, IRS, bank, domain, and D&B records.
- [ ] Search for an existing D-U-N-S Number, then request/update one using the
      exact LLC legal name and headquarters address. Save verification records.
- [ ] Allow D&B/Apple propagation time before enrollment; do not create
      inconsistent duplicate records to work around a delay.
- [ ] Enable two-factor authentication on the Apple Account used for the
      Account Holder role.
- [ ] Enroll as an **Organization** using the LLC legal name, D-U-N-S Number,
      organization-domain work email, functional company website, and Adam's
      legal binding authority.
- [ ] Complete Apple's legal-entity/compliance verification and retain accepted
      agreements and membership ID.
- [ ] Create the App Store Connect app record with the existing bundle ID and
      intended seller entity.
- [ ] Complete agreements, tax, banking, DSA/trader, App Privacy, users/roles,
      and recovery contacts with LLC information.
- [ ] Keep Account Holder access controlled by the LLC. Add a second trusted
      administrator only when appropriate; never share one Apple Account.

If conversion/transfer from an individual account is needed:

- [ ] Obtain Apple's current written instructions before changing membership or
      initiating transfer.
- [ ] Inventory certificates, identifiers, capabilities, Sign in with Apple,
      Services IDs, keys, TestFlight builds, users, agreements, and app-transfer
      eligibility.
- [ ] Follow Apple's required Sign in with Apple user-transfer process if
      applicable; do not assume App Transfer moves every identifier or key.
- [ ] Verify production OAuth, push, bundle signing, account deletion, and
      existing-user access after the change.

## Phase 5: Vendor and platform cutover

For every row, change the contracting/billing entity, owner/admin/recovery
access, tax record, support contact, DPA/privacy contact, and incident contact
where the provider supports it. Preserve prior invoices and agreements.

| System                            | Required cutover                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Apple Developer/App Store Connect | Organization membership or approved conversion/transfer; LLC agreements, tax, banking, roles             |
| Google developer/OAuth            | LLC publisher profile, consent-screen/developer contact, organization verification, credentials/recovery |
| GitHub/source hosting             | LLC-owned organization/repository authority and recovery controls                                        |
| Domain/DNS/email                  | LLC registrant/control, domain work email, monitored support/privacy aliases                             |
| Vercel                            | LLC team, billing, DPA/contact, production domains, administrators                                       |
| Supabase                          | LLC organization/project ownership, billing, DPA/contact, auth provider configuration, administrators    |
| Upstash                           | LLC account/team, billing, DPA/contact, Redis/QStash administrators                                      |
| OpenAI                            | LLC organization/project, billing, DPA/data-control settings, API-key ownership, incident contact        |
| USDA FoodData Central             | LLC contact and API-key ownership where applicable                                                       |
| Open Food Facts                   | Accurate app-identifying user agent/contact and attribution                                              |
| D&B                               | Exact LLC name/address/status for Apple verification                                                     |
| Bank/accounting/insurance         | LLC legal name/EIN, app revenue/expenses, policy coverage                                                |
| Support/feedback provider         | LLC workspace, retention, privacy disclosure, administrators; keep disabled until confirmed              |

Rotate API keys only through a staged process: add new LLC-owned credential,
deploy and validate it, revoke the old credential, then record completion. Never
print or commit secret values.

## Phase 6: Legal and privacy cutover

The current canonical documents name Adam Shugart as an individual. Before the
LLC becomes the public operator:

- [ ] Have counsel update the Terms, Privacy Policy, Consumer Health Data
      Privacy Policy, support, account-deletion, and consent text with the exact
      LLC legal name, jurisdiction, public address if required, email, and
      effective date.
- [ ] Describe the transfer from Adam to the LLC and provide any transaction,
      assignment, consumer notice, or consent required for existing account or
      consumer-health data. Do not silently relabel the controller.
- [ ] Confirm the LLC assumes the published deletion, privacy-rights, security,
      incident-response, retention, and no-sale/no-ad obligations.
- [ ] Publish the new documents before or at cutover; preserve the individual
      versions, hashes, effective dates, app version, and deployment evidence.
- [ ] Update in-app legal links, acceptance version, AI/OpenAI disclosure, App
      Store URLs, privacy label, review notes, website footer, and support
      responses.
- [ ] Decide with counsel whether existing users need notice, renewed Terms
      acceptance, or a separate consumer-health-data consent. A material change
      cannot retroactively expand an earlier consent.
- [ ] Replace the operator name in privacy request and health-breach procedures,
      then test the monitored mailbox and escalation contacts.
- [ ] Execute/update DPAs and vendor incident-notice contacts in the LLC's name.

Do not publish the existing Adam-as-individual policies as though they already
name the LLC, and do not backdate the LLC effective date.

## Phase 7: Final cutover verification

- [ ] Texas, IRS, bank, D&B, Apple, domain, website, vendor, policy, and support
      records use one consistent LLC legal name and approved address.
- [ ] App Store seller, copyright, agreements, tax/banking, support, privacy,
      and DSA/trader fields match the LLC and the selected U.S.-only release.
- [ ] No personal billing account, personal secret, or sole-person recovery path
      remains without an explicit migration plan.
- [ ] Source/IP assignment and provider-contract acceptance are signed and
      stored in the company record book.
- [ ] Public legal pages and in-app assent name the correct operator.
- [ ] Privacy rights request and incident-response tabletop tests pass using the
      LLC contacts.
- [ ] Production authentication, cloud backup, restore, AI consent, food lookup,
      notifications, exports, and deletion pass after credential/account changes.
- [ ] The App Store reconciliation checklist and full signed-build release gate
      pass after cutover.
- [ ] Owner, counsel, tax professional, and release engineer record dated
      sign-offs for their respective areas.

## Company record index

Maintain a restricted index of:

- certificate of formation, operating agreement, initial consents, registered
  agent record, EIN letter, Comptroller/FinCEN records;
- IP assignment, contract assignments, provider agreements/DPAs, insurance;
- D-U-N-S and Apple organization verification;
- domain, source-host, platform, and credential ownership inventory;
- legal-document versions and consumer cutover notices;
- release evidence and privacy/incident procedure test records; and
- annual state, tax, vendor, insurance, domain, and Apple renewal dates.

## Official maintenance references

- [Texas Secretary of State business forms, including Form 205](https://www.sos.state.tx.us/corp/forms_boc.shtml)
- [IRS: Get an employer identification number](https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number)
- [Texas Comptroller: Franchise Tax](https://comptroller.texas.gov/taxes/franchise/)
- [Apple Developer organization enrollment](https://developer.apple.com/help/account/membership/program-enrollment)
- [Apple Developer D-U-N-S Number requirements](https://developer.apple.com/help/account/membership/D-U-N-S/)

Revalidate state, federal, Apple, and vendor requirements immediately before
each filing or transfer. This checklist records the sequence and control points;
it is not legal or tax advice.
