# Privacy Rights Request Operations

- **Owner:** Adam Shugart
- **Public intake:** `adamshugart31@gmail.com`
- **Applies to:** Vigorune Version 1, free U.S.-only release
- **Last reviewed:** August 20, 2026

This is the internal procedure for privacy, consumer-health-data, deletion, and
appeal requests. It implements the commitments in the canonical
`docs/legal/PRIVACY_POLICY.md` and
`docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY.md`. If this procedure and a
published policy conflict, stop and obtain counsel's direction before denying,
limiting, or extending a request.

Do not put request emails, identity evidence, exports, or case files in this
repository. Store them in a restricted case folder available only to the owner
and retained counsel.

## Service levels and deadline rules

- Record every request on the day received and acknowledge it within five
  business days.
- Track both the receipt date and the authentication date. The published
  consumer-health policy promises a substantive response without undue delay
  and within 45 calendar days after an authenticated covered request.
- Do not delay authentication to move the deadline. If another applicable law
  starts the clock at receipt, use the earlier deadline.
- A single additional 45-calendar-day extension may be used only when
  reasonably necessary and legally permitted. Send the extension notice before
  the original deadline and state the reason and new date.
- Decide a covered appeal within 45 calendar days.
- Complete covered Washington backup/archive deletion no later than six months
  after authentication, even when active-system deletion finishes earlier.
- Never charge unless counsel confirms a fee is permitted for a manifestly
  unfounded, excessive, or repetitive request. Never retaliate or discriminate.

The case tracker must show calendar-day deadlines, not business-day estimates.
If a deadline falls on a weekend or holiday, treat the preceding business day
as the internal send target unless counsel directs otherwise.

## 1. Intake and triage

1. Create case ID `PRIV-YYYY-NNN` in the restricted tracker.
2. Preserve the original message and attachments without altering metadata.
3. Record:
   - date and time received;
   - sender and requested response channel;
   - subject used: Privacy Request, Consumer Health Data Request, Privacy
     Appeal, or Consumer Health Data Appeal;
   - request type: confirmation, access, portability, correction, deletion,
     consent withdrawal, recipient list, appeal, or other;
   - claimed state of residence;
   - whether an authorized agent is involved; and
   - whether the message also alleges a security incident. If it does, open the
     health-breach runbook immediately and keep the two case records linked.
4. Calculate provisional day 45 and day 90 dates from receipt. Recalculate and
   record the authenticated-request dates when verification is complete.
5. Send an acknowledgment that repeats the understood scope, gives the case
   ID, explains any verification still needed, and warns the requester not to
   email passwords, provider codes, tokens, meal photos, GPS history, or other
   unnecessary health information.

Route an appeal as a new case linked to the original case. Do not have the same
decision-maker simply repeat the earlier denial without fresh review.

## 2. Authentication and authorized agents

Use the least intrusive method reasonably capable of preventing disclosure or
deletion of another person's data.

### Signed-in account data

Prefer these checks in order:

1. Match the requester's email to the email on the Supabase account.
2. Send a single-use verification message to that account email, or ask the
   requester to initiate the in-app account/cloud deletion control while signed
   in when that fully satisfies the request.
3. If provider relay or masked Apple email makes the match unclear, request only
   the minimum non-health account facts needed to locate the account. Never ask
   for an Apple/Google password, access token, recovery code, or identity
   document unless counsel determines it is necessary and lawful.

Record the method, result, and authentication timestamp. Do not retain a
single-use code after verification.

### Local-only data

Vigorune cannot remotely see, export, correct, or delete data that never left a
device. Explain the signed-out controls:

- export from the app for access/portability; and
- **Settings -> Data -> Clear all data** on every installation for deletion.

Do not claim that server searches prove no local data exists. A local-only
response can still be fulfilled without collecting identity evidence that has
no operational purpose.

### Authorized agents

Obtain proof that the person authorized the agent, then authenticate the person
whose data is at issue unless applicable law allows a different method. Record
the agent's contact details and authority separately from the consumer's data.
If authority cannot be verified, explain what is missing and keep the request
open while a reasonable cure is possible.

## 3. Scope and system search

Use this map for every authenticated request and mark each row searched, not
applicable, or awaiting a provider response.

| System or recipient  | Potential data                                                                    | Search or action                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth        | Provider identifier, email, profile/session metadata, timestamps, security events | Search by verified user ID; export, correct where supported, or delete account                                                                                         |
| Supabase app tables  | Replaceable fitness snapshot and account-linked daily nutrition rows              | Search only by verified user ID; export or delete live rows                                                                                                            |
| Device installation  | IndexedDB fitness records, GPS samples, settings, credentials, exports            | Not remotely accessible; give in-app export/clear instructions                                                                                                         |
| Vercel               | Limited runtime/network logs and request metadata                                 | Search only when a reliable case identifier exists and the request legally covers the record; do not infer health records from logs                                    |
| Upstash Redis/QStash | Short-lived OAuth relay, rate-limit counters, optional push jobs                  | Cancel identifiable live push jobs and delete identifiable records where supported and required                                                                        |
| Support destination  | Feedback text and app/device context, if feedback was enabled                     | Search the disclosed destination using verified identifiers and its retention controls                                                                                 |
| OpenAI               | Meal photos, optional note, response, and metadata retained under provider rules  | Vigorune intentionally sends no account ID; document whether a request can be located, and send a covered recipient request when a reliable provider identifier exists |
| USDA/Open Food Facts | Search term, barcode, language, provider record ID, request metadata              | Normally not account-linked; document inability to locate rather than claiming deletion occurred                                                                       |
| Apple/Google         | Authentication-provider records                                                   | Explain that provider access is controlled separately; do not represent Vigorune deletion as provider-account deletion                                                 |

Also search any incident evidence hold or legal hold that counsel says is in
scope. Never delete evidence subject to a valid hold; document the legal basis,
segregate the data, restrict use, and explain any lawful limitation.

## 4. Fulfillment by request type

### Confirmation, access, and portability

- Describe whether app-controlled cloud/account data was found.
- Provide responsive records in a common, readable format through a secure
  transfer method. Do not email an unencrypted fitness snapshot as an ordinary
  attachment.
- Exclude secrets, provider credentials, information about another person, and
  security details that would create a risk. Record every redaction and basis.
- For local-only records, direct the requester to the app's JSON/fitness-data
  export and explain why the operator cannot generate it remotely.

### Correction

- Correct account metadata or app-controlled cloud data only where the change
  can be made safely and the requested value is verifiable.
- Explain that local authoritative records must be corrected on each device.
- Do not rewrite completed workout history merely to make a cloud export look
  different; preserve the product's historical-snapshot rules.

### Consent withdrawal

- Record which optional future processing the person is withdrawing from.
- Stop that future collection or sharing when the consent is the applicable
  basis. Explain any feature that will no longer work.
- Withdrawal does not erase past data by itself. Ask whether deletion is also
  requested, without making deletion harder.

### Deletion

1. Confirm whether the request covers local data, cloud data, the app account,
   provider access, or all app-controlled data.
2. Export only if the requester asks; warn before destructive account/cloud
   actions.
3. Delete the live Supabase snapshot and daily nutrition rows when in scope.
4. Delete the Supabase authentication account when account deletion is in
   scope. Confirm that local data is intentionally not erased remotely.
5. Cancel identifiable QStash/web-push work and remove other active-system
   records when required and technically possible.
6. Send deletion instructions to covered processors, contractors, or third
   parties when law requires recipient notification. Require written
   confirmation or record the provider ticket, request date, scope, and stated
   completion date.
7. Add any delayed backup/archive item to the six-month maximum tracker. Verify
   completion at the next deletion cycle or upon restoration, whichever comes
   first.
8. Give local-data clearing and Apple/Google provider-revocation instructions
   separately. Never say those operations were performed when they remain the
   user's action.

If OpenAI, a food provider, or an operational log cannot locate an earlier
unlinked request, state exactly that Vigorune did not send an account identifier
and lacks a reliable lookup key. Do not convert “not locatable” into “deleted.”

### Recipient list

Use the actual production configuration and case-period records, not only the
policy's possible-recipient list. Provide available contact information when
applicable law requires it. Distinguish:

- a recipient that actually received this person's identifiable data;
- a provider used by the product but not for this person; and
- a provider request that cannot be linked back to the person.

## 5. Decision and response

Before sending, use a second-person review by counsel or another qualified
reviewer for any denial, partial denial, extension, appeal, or request involving
another person's information.

The final response must:

- identify the case ID and request types completed;
- state what was found and what actions were taken, with completion dates;
- distinguish local, cloud, account, and provider data;
- identify any unfulfilled part and the factual/legal reason;
- give the appeal method and deadline if any part was refused;
- provide the applicable state attorney general complaint method after a denied
  covered appeal; and
- use a secure delivery channel appropriate to the records.

Close the case only after delivery is confirmed and every delayed deletion or
recipient notice is either complete or in a separately tracked follow-up.

## 6. Appeals

1. Link the appeal to the original case and preserve both records.
2. Record the appeal receipt date and 45-calendar-day deadline.
3. Assign a reviewer who did not make the original decision when practicable.
4. Recheck identity, scope, system searches, exemptions, provider responses,
   and whether new facts cure the original problem.
5. Send the written outcome within 45 days. If denied, explain the reasons and
   provide the applicable attorney general contact or complaint method.

## 7. Case closure and evidence

Retain a minimal case record containing:

- case ID, receipt/authentication/deadline dates, request and state scope;
- verification method and result, without unnecessary identity documents;
- systems searched, query date, operator, and result;
- exports/redactions, deletion confirmations, recipient notices, and provider
  ticket IDs;
- every acknowledgment, extension, final response, and appeal outcome; and
- closure date and any six-month backup-deletion follow-up.

Limit case-file access and set a documented retention schedule with counsel.
Do not retain health data merely to prove that it was deleted.

## Per-case control sheet

- [ ] Case ID assigned; original request preserved.
- [ ] Receipt, authentication, day 45, possible day 90, and six-month dates recorded.
- [ ] Acknowledgment sent within five business days.
- [ ] Identity/agent authority verified using minimum necessary information.
- [ ] Local-versus-cloud scope explained.
- [ ] Every system-map row dispositioned.
- [ ] Export/correction/deletion/withdrawal action completed.
- [ ] Covered recipient notices sent and tracked.
- [ ] Extension sent before deadline, if legally permitted and necessary.
- [ ] Second-person review completed for adverse or partial decision.
- [ ] Secure final response delivered.
- [ ] Appeal instructions included when required.
- [ ] Backup/archive follow-up scheduled and completed by the applicable maximum.
- [ ] Case record minimized, access restricted, and closure recorded.

## Authority and maintenance references

- Canonical Vigorune Privacy Policy and Consumer Health Data Privacy Policy in
  `docs/legal/`.
- [Washington My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [Nevada NRS Chapter 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html)

Review this procedure with qualified U.S. privacy counsel before publication
and whenever the app adds a state, data category, recipient, consent, or new
request channel.
