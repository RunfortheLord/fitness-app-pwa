# FTC Health Breach Notification Incident Response

- **Incident owner:** Adam Shugart
- **Incident mailbox:** `adamshugart31@gmail.com`
- **Applies to:** Vigorune Version 1 and its production providers
- **Last reviewed:** August 20, 2026

Use this runbook for any suspected unauthorized access to, acquisition of, or
disclosure of identifiable fitness, nutrition, bodyweight, running, account, or
related health information. A breach can be a configuration mistake or
unauthorized disclosure—not only a malicious intrusion.

Treat this runbook as an emergency checklist, not a conclusion that a notice is
or is not legally required. Engage qualified breach counsel promptly. Counsel
must evaluate the FTC Health Breach Notification Rule, every affected state's
laws, contracts, insurance notice requirements, and law-enforcement requests.

## Contacts to establish before launch

These are the only unavoidable owner fill-ins. Complete and test them before
production publication; keep the filled contact sheet outside the repository.

| Role                                  | Required contact                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Qualified U.S. privacy/breach counsel | **OWNER:** firm, attorney, 24-hour phone, secure email                                               |
| Cyber-insurance carrier/broker        | **OWNER:** policy number, hotline, notice email; write `not insured` only after an explicit decision |
| Independent forensic support          | **OWNER:** firm/on-call contact or counsel-approved procurement path                                 |
| Public incident contact               | `adamshugart31@gmail.com` plus **OWNER:** second contact method usable in a notice                   |
| Substitute-notice phone provider      | **OWNER:** toll-free activation path capable of remaining live for at least 90 days                  |
| Hosting/authentication                | Vercel and Supabase security/support escalation channels                                             |
| Queue/rate limiting                   | Upstash security/support escalation channel                                                          |
| AI processing                         | OpenAI security/support escalation channel                                                           |
| Sign-in providers                     | Apple and Google security/developer escalation channels                                              |

Do not store credentials, policy numbers, personal phone numbers, or incident
evidence in Git.

Before launch, have counsel give each provider that can access unsecured
identifiable health information written notice that Vigorune is treating itself
as subject to the Health Breach Notification Rule. Designate Adam as the
official who receives provider breach notices, require acknowledgment and
identification of potentially affected people, and contract for notice far
sooner than the federal 60-day ceiling (target: immediately and within 24 hours
of discovery). Record any provider that will not accept these terms as a launch
risk for counsel's decision.

## The first hour

1. Assign incident ID `SEC-YYYY-NNN`, incident commander, evidence custodian,
   and note taker. For a one-person operation, explicitly record when Adam holds
   more than one role.
2. Record the earliest date/time the event became known or reasonably should
   have been known. This is the provisional legal discovery time; do not reset
   it when the investigation becomes more certain.
3. Preserve evidence before changing systems:
   - alerts, request IDs, audit logs, provider notices, configuration history,
     deployments, relevant database records, and screenshots;
   - UTC timestamps, source, collector, hash where practical, and every custody
     transfer; and
   - a copy in a restricted incident repository outside this code repository.
4. Contain the exposure without destroying evidence:
   - revoke or rotate affected secrets and sessions;
   - disable only the affected API, backup, feedback, AI, push, or auth path;
   - correct row-level access or deployment configuration;
   - stop further disclosure; and
   - preserve the exact vulnerable build/configuration for counsel and forensic
     review before replacing it.
5. Contact breach counsel and the cyber-insurer before hiring vendors or making
   admissions when the policy requires insurer approval.
6. Use a privileged counsel-directed channel for legal analysis. Keep factual
   incident notes separate, accurate, and free of speculation.

Never wipe a database, delete logs, contact an attacker, pay a demand, promise
notification, or make a public statement without incident-command approval.

## First 24 hours

### Determine the affected boundary

Inventory actual and reasonably possible exposure across:

- Supabase authentication accounts, cloud snapshots, and daily nutrition rows;
- Vercel functions, runtime logs, deployments, environment variables, and
  access history;
- Upstash Redis/QStash OAuth relay, rate-limit, or push-job records;
- OpenAI meal-analysis requests, images, notes, responses, and metadata;
- food-search/barcode requests and caches;
- Apple/Google authentication configuration;
- support or feedback destination;
- source-control, CI, administrator devices, and exported backups; and
- local-only data only if evidence shows it actually left the device.

For each affected or possibly affected person, record only what is necessary:
identifier, U.S. state/territory, data types, acquisition/disclosure evidence,
contact method on file, and confidence. Keep unknown counts as ranges; never
delay containment while seeking a perfect number.

### Apply the FTC trigger screen

Escalate as a potential FTC Health Breach Notification Rule matter when all may
be true:

1. Vigorune is acting as a vendor of personal health records or related covered
   entity for the affected records;
2. the information is unsecured, identifiable health information in or from a
   covered personal health record; and
3. it was acquired without the person's authorization.

Under the current rule, unauthorized access creates a presumption of
unauthorized acquisition unless reliable evidence shows there was not and
could not reasonably have been an acquisition. An unauthorized disclosure can
also be a breach. Document the evidence supporting either conclusion; do not
close a matter because no download was observed.

## First 72 hours

- Obtain provider preservation and incident statements, including access times,
  affected resources, actor identifiers, and remedial steps.
- Determine root cause, affected versions, duration, and whether exposure is
  still possible.
- Validate person count and residents by state/territory without collecting
  unnecessary new health data.
- Decide whether outside forensics, law enforcement, identity/credit support,
  or a call center is needed.
- Have counsel create a deadline matrix for FTC, individual, media, state
  attorney general, insurer, contract, and other regulator notices.
- Prepare a plain-language holding statement. Do not publish it unless needed.
- Open a linked privacy-request case for any person who asks for access or
  deletion during the incident; an incident does not suspend privacy rights.

## FTC deadline matrix

The following is the operational floor under the current federal rule; counsel
must add state and contractual requirements that are shorter or broader.

| Notice                       | Trigger                                                                                                      | Deadline                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Affected individuals         | U.S. citizen/resident whose unsecured covered information was acquired                                       | Without unreasonable delay and no later than 60 calendar days after discovery                                                           |
| FTC, 500 or more people      | Covered breach affects at least 500 people                                                                   | Contemporaneously with individual notice, without unreasonable delay, and no later than day 60                                          |
| FTC, fewer than 500 people   | Covered breach affects fewer than 500 people                                                                 | Log each breach; submit to FTC no later than 60 calendar days after the end of the calendar year in which it was discovered             |
| Media                        | At least 500 residents of one state, D.C., territory, or possession affected or reasonably believed affected | Prominent media serving that locale, without unreasonable delay and no later than day 60; this supplements individual notice            |
| Service provider to Vigorune | Provider discovers a covered breach                                                                          | Provider must notify the designated Vigorune official and obtain acknowledgment; contract should require a shorter operational deadline |

Day 60 is a maximum, not a waiting period. Send when the required facts and a
useful notice are ready. If an authorized law-enforcement official directs a
delay because notice would impede a criminal investigation or harm national
security, preserve the direction and have counsel document its form, scope, and
end date.

Use the FTC's current [Notice of Breach of Health Information](https://www.ftc.gov/business-guidance/health-breach-form)
process. Preserve the submitted form, secure-submission instructions, payload,
confirmation, and submission timestamp.

## Individual notice controls

Counsel must approve the audience, method, content, timing, translations, and
state-law additions.

### Method

- Use the person's specified primary communication method when available.
- Under the current federal rule, email notice is email combined with at least
  one of: text message, in-app message, or electronic banner. If email is not
  available or not specified as primary, first-class mail may be used at the
  last known address.
- Add urgent telephone or other contact when imminent misuse makes it
  appropriate; this supplements the written notice.
- After reasonable contact efforts, if information for 10 or more people is
  insufficient or stale, provide a conspicuous 90-day homepage posting or
  qualifying major-media notice. Include a toll-free number active for at least
  90 days.

### Required content

Use a clear, conspicuous, plain-language notice containing, to the extent
possible:

- what happened; breach date and discovery date, if known;
- the identity of a third party that acquired the information, if known, unless
  identification itself creates a risk;
- the specific types of information involved, including use of the app when
  relevant;
- practical steps the person can take to reduce harm;
- investigation, containment, mitigation, future-protection, and person-support
  steps Vigorune is taking; and
- at least two contact methods from toll-free phone, email, website, in-app, and
  postal address.

Do not include secrets, exploit details that increase risk, unsupported claims,
or “no evidence of misuse” when the evidence shows only that misuse is unknown.

## Communications and support

- Maintain one approved fact sheet and update it as facts change.
- Give support the exact notice, identity-verification script, escalation path,
  and prohibited statements.
- Log inbound reports without asking people to resend exposed health data.
- Correct a material error promptly through the same channels as the original
  notice.
- Coordinate App Store, website, in-app, social, media, provider, and regulator
  communications so dates and facts agree.

## Recovery and closure

1. Verify containment with independent evidence, not only the change author.
2. Rotate related secrets, invalidate sessions, patch every affected
   environment, and test row-level isolation and protected routes.
3. Review data minimization, logging, retention, vendor contracts, and alerting.
4. Complete every regulator, individual, media, insurer, and contract notice;
   preserve proof of timing and delivery.
5. Track returned mail, failed email, substitute notice, support commitments,
   and remediation to completion.
6. Write a factual post-incident report: timeline, root cause, affected data and
   people, decisions, evidence, notices, fixes, validation, and follow-ups.
7. Update this runbook, threat model, provider inventory, privacy disclosures,
   and App Store privacy answers when facts or processing changed.

Retain the incident record and notification proof under a counsel-approved
schedule. As an internal minimum, preserve the final decision record and proof
of required notices for six years unless counsel requires longer or orders an
earlier lawful deletion. Minimize duplicate exposed health data inside that
record.

## Incident control sheet

- [ ] Incident ID, commander, evidence custodian, and discovery time recorded.
- [ ] Evidence preserved with sources and timestamps.
- [ ] Exposure contained without destroying evidence.
- [ ] Counsel and insurer contacted.
- [ ] Provider preservation/escalation requests sent.
- [ ] Affected systems, data types, people, and state counts documented.
- [ ] FTC trigger and unauthorized-acquisition presumption analyzed.
- [ ] Federal, state, contract, and insurer deadline matrix approved.
- [ ] Individual notice method/content approved and sent without unreasonable delay.
- [ ] FTC notice/log completed at the correct threshold deadline.
- [ ] Media and substitute notice completed if triggered.
- [ ] Delivery and failed-contact evidence preserved.
- [ ] Root cause remediated and independently validated.
- [ ] Privacy/store disclosures reconciled.
- [ ] Post-incident review and remaining actions closed.

## Authority and maintenance references

- [16 CFR Part 318—Health Breach Notification Rule](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-318)
- [FTC: Complying with the Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [FTC breach reporting form](https://www.ftc.gov/business-guidance/health-breach-form)

Counsel must revalidate the rule and deadlines when this runbook is activated;
regulatory text, forms, state overlays, and penalty amounts can change.
