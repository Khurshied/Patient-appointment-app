# Patient appointment app — v1 spec

Living product spec for a **solo dentist** appointment product. Locked decisions come from the interactive workshop. Implementation is out of scope for this document; this file is the source of truth for what v1 should do.

**Primary success metric:** a registered patient can request a slot without calling the practice.

---

## 1. Goals

- Let patients register (email or mobile number) and **request** an in-person appointment.
- Give the dentist and an admin a way to **confirm or decline** requests so the calendar does not commit a slot until a human approves it.
- Let the practice configure behaviour in **settings** (types, hours, policies, reminders, auth, intake, completion rules) rather than hardcoding clinic rules.
- After confirmation, remind the patient on **email, SMS, and push** using admin-defined offsets.
- Ship **web (including PWA push)** and **native iOS/Android** on day one, with the same v1 capabilities.

## 2. Non-goals (v1)

- Video / telehealth visits.
- Payments, deposits, or insurance claims.
- Clinical records: charting, treatment notes, prescriptions, X-rays, medical history beyond what is needed to identify the patient and optional intake fields.
- Marketplace or multi-doctor / multi-location scheduling.
- Receptionist as a distinct role (front desk is not a v1 persona).
- HIPAA/GDPR-grade clinical compliance program (v1 is booking + reminders only; still treat contact data as personal data in implementation).
- Walk-in queue management.

---

## 3. Product snapshot

| Topic | v1 decision |
| --- | --- |
| Practice | One dentist, one location, in-person only |
| Specialty | Dentistry |
| Users | Patient, doctor, admin. One login **may** hold doctor + admin (solo dentist can be the only admin). |
| Registration | Mobile number **or** email |
| Auth proof | Admin-configured: password, OTP, or both |
| Booking | Request → doctor or admin confirms |
| Same-slot contention | Admin-configured; exactly one policy active (see §6) |
| Slot lengths | Mixed; driven by admin-defined visit types |
| Working hours | Admin-configured: weekly template and/or exceptions |
| Cancel / reschedule | Configurable; exactly one policy active |
| First-visit fields | Admin-configured (identity + slot minimum; extra fields optional) |
| Complete / no-show | Admin-configured: required vs optional |
| Timezone / language | Admin-configured |
| Platforms | Native iOS + Android **and** web with PWA push on day one |
| Money | None |
| Reminders | Email + SMS + push; offsets admin-configured |
| Tech stack | Chosen in this spec (workshop: leave it to engineering) — see §15 |

---

## 4. Personas and permissions

### Patient

- Register and sign in with **email or mobile number**, using the practice’s active auth mode(s).
- Browse **open slots** for active appointment types.
- Submit an appointment **request** (not an instant booking), filling any **required intake fields** the admin enabled.
- See own appointments and request status.
- Cancel and/or reschedule **only if** the active clinic policy allows it.
- Receive notifications (request received, decision, reminders, cancellation).

Patients cannot: change clinic hours, appointment types, or policies; see other patients; confirm their own requests.

### Doctor

- See a calendar of confirmed appointments and pending requests.
- Confirm or decline requests.
- Block time (unavailable) so those intervals are not offered as open slots.
- Optionally cancel/reschedule any appointment (staff override), regardless of patient-facing policy.
- Mark visits as completed or no-show (lightweight; no clinical note required). Whether this is **required** is an admin setting (§8).

The doctor does not need a separate “practice settings” surface if they are not also admin, but the doctor **must** be able to work the inbox and calendar without a second person present.

### Admin

- All doctor calendar/inbox actions, plus the **practice settings catalog** (§5).
- Manage users (invite/disable doctor and admin accounts; disable a patient account if needed).

**One login, two roles:** a user may be tagged `doctor`, `admin`, or **both**. A solo dentist can run the practice with a single staff account that is doctor+admin. Extra admin-only accounts are allowed but not required.

There is no receptionist role in v1.

---

## 5. Practice settings catalog

Everything below is **admin-configured**. Suggested defaults exist so a new practice can go live without filling a blank form. Changing a setting applies going forward unless a section says otherwise.

| Setting | Shape | Suggested default |
| --- | --- | --- |
| Appointment types | List of `{ name, durationMinutes, active }` | Empty list; admin must add at least one before patients can request |
| Same-slot contention | One of `queue_until_confirm`, `hold_first_request`, `hide_on_request` | `hide_on_request` |
| Cancel / reschedule | One of `until_start`, `cutoff_24h`, `cancel_only`, `staff_only` | `cutoff_24h` |
| Reminder offsets | Ordered list of offsets before start (e.g. `24h`, `1h`); each reminder still uses email+SMS+push | `24h` and `1h` |
| Notification channels | Email, SMS, push on/off at practice level | All on |
| Timezone | IANA timezone for the practice (slot times stored in UTC, displayed in this zone) | Admin must set (e.g. `Asia/Kolkata`); no silent guess in production |
| Languages | One or more UI locales; one default | Default `en`; admin can add more locales the app actually ships |
| Auth modes | Flags: `password`, `otp` (SMS and/or email codes); at least one must be on. `both` = patient may use either, or password + OTP if admin requires 2FA — see §9 | `otp` on email/SMS to the identifier they registered with |
| Working hours mode | `weekly_template`, `exceptions_enabled`, or both | Weekly template **and** exceptions enabled |
| Weekly hours | Per weekday: closed or one or more open intervals | Unset until admin saves a template |
| Exceptions | Dated overrides: extra open intervals and/or closures (holidays, every-other Saturday as dated opens) | None |
| Intake fields | Ordered fields with `required` / `optional` / `off`. Built-ins: display name, date of birth; admin may add simple extra text/date fields later | Display name **required**; DOB **off**; identity (email or phone) always required |
| Complete / no-show | `optional` (staff may leave confirmed after end time) or `required` (staff must mark `completed` or `no_show` by a deadline) | `optional`; if `required`, deadline = **end of the calendar day** in practice timezone after the visit |

Admin UI is a single **Settings** area with these groups: types, hours, policies, reminders, auth, intake, locale, users.

---

## 6. Appointment types (admin-defined)

There is **no hardcoded** list (check-up, cleaning, etc.). Admin defines types.

Each type has:

- Display name (e.g. “New patient exam”).
- Duration in minutes (positive integer; UI may offer 15-minute increments).
- Active / inactive.

**Rules**

- Only **active** types appear when a patient requests a visit.
- Open slots are generated from duration: a 45-minute type needs a contiguous free window of at least 45 minutes inside working hours, with no confirmed appointment and no blocked time overlapping that window. Pending requests may also block or share that window, depending on the **same-slot contention** policy (§7).
- Inactive types remain on historical appointments; they cannot be newly requested.
- Duration changes apply to **new** requests only; already requested/confirmed appointments keep the duration they were booked with.

---

## 7. Availability and open slots

**Inputs**

- Recurring **weekly template** (if enabled): e.g. Mon–Fri 09:00–17:00, lunch as a gap or a block.
- **Exceptions** (if enabled): dated extra opens (Saturday clinic) and dated closures (holiday). Exception **closure** wins over the weekly template for that date; exception **open** adds availability that the template would not have.
- One-off blocked time (personal, procedure overflow) — always available to doctor/admin, independent of the weekly/exceptions toggle.
- Confirmed appointments (occupy the calendar).
- Pending requests, interpreted through the active **same-slot contention** policy (below).
- Appointment type duration.
- Practice timezone (all “day” boundaries use this zone).

If only the weekly template is enabled, dated extra opens are not offered. If only exceptions are enabled, there is no repeating week — admin must add dated opens (unusual; allowed because the mode is a setting). Suggested default enables **both**.

**Open slot** = a start time where `[start, start + duration)` sits entirely inside resolved working hours and does not overlap blocked time or a **confirmed** appointment, and also satisfies the active contention policy versus pending requests.

Patients never type a free-form time; they pick from generated slots.

### Same-slot contention (admin-configured)

Admin selects **exactly one** active policy. The options are mutually exclusive. Changing the policy applies to **new** requests; existing `requested` rows keep their times until confirmed, declined, or cancelled.

| Policy id | Behaviour |
| --- | --- |
| `queue_until_confirm` | Multiple patients may request the same (or overlapping) window. The time stays visible as open until someone is **confirmed**. First confirmation occupies the window; remaining overlapping `requested` appointments are **auto-declined** and those patients are notified. |
| `hold_first_request` | The first request **holds** the window. Other patients cannot request an overlapping time until that request is declined or cancelled. The slot may still appear as unavailable / held rather than confirmed. |
| `hide_on_request` | As soon as anyone successfully requests a window, that time **disappears** from the open list (same occupancy rule as a hold). Other patients never see it as bookable. If two submits race, the first persisted request wins; the second patient gets “slot no longer available.” |

Overlap is measured on `[start, start + duration)` for the requested type, so a 60-minute hold at 10:00 also hides 10:00 for a 30-minute type.

If a held or hidden request is **declined** or **cancelled** before confirm, the window becomes an open slot again (unless another confirmed visit or block still covers it).

---

## 8. Booking state machine

```
requested → confirmed | declined
confirmed → cancelled | completed | no_show
requested → cancelled   (if the requester or staff withdraws before a decision)
```

| Status | Meaning |
| --- | --- |
| `requested` | Patient asked for a slot; not on the confirmed calendar. May still hide or hold open slots per contention policy. |
| `confirmed` | Doctor or admin accepted; slot is occupied; reminders may fire. |
| `declined` | Doctor or admin rejected, or the system auto-declined because another overlapping request was confirmed under `queue_until_confirm`. |
| `cancelled` | Confirmed or requested visit will not happen. |
| `completed` | Visit happened (doctor/admin marks it). |
| `no_show` | Patient did not attend (doctor/admin marks it). |

**Confirm / decline**

- Only doctor or admin can confirm or decline.
- Confirming occupies `[start, start + duration)` for that dentist. Under `queue_until_confirm`, overlapping pending requests are auto-declined at this moment.
- Patient sees status on “My appointments”; they are notified of the decision.

**Complete / no-show (admin-configured)**

- Always available as actions on a confirmed visit (no clinical note).
- If setting is `optional`, a visit may stay `confirmed` after its end time; calendar still shows it as historic confirmed.
- If setting is `required`, doctor or admin must set `completed` or `no_show` by the configured deadline (default: end of that local calendar day). Overdue items appear in a **Needs close-out** list. v1 does not auto-change status when the deadline passes; it only nags staff.

### Cancel and reschedule policy

Admin selects **exactly one** active policy. The options are mutually exclusive:

| Policy id | Patient can |
| --- | --- |
| `until_start` | Cancel or reschedule until the appointment start time. |
| `cutoff_24h` | Cancel or reschedule only until 24 hours before start. |
| `cancel_only` | Cancel (subject to a cutoff of “until start” unless later specified); reschedule is doctor/admin only. |
| `staff_only` | Neither cancel nor reschedule; doctor/admin only. |

**Reschedule** (when allowed) means: cancel the current confirmed (or requested) appointment and create a **new request** for a different slot of the same type, unless staff reschedules directly onto a new confirmed slot. Patient-initiated reschedule always goes through **request → confirm** again so the dentist still approves the new time.

Doctor and admin can always cancel or move a visit, independent of the patient-facing policy.

Evaluate the policy **live** at cancel/reschedule time.

---

## 9. Auth

Patients and staff sign in against the same practice. Identifier is **email or mobile number**.

Admin enables at least one of:

| Mode | Behaviour |
| --- | --- |
| `password` | Register/set a password; sign in with identifier + password. |
| `otp` | One-time code sent to email and/or SMS matching the identifier. |
| both enabled | Patient may complete sign-in with **either** method (not mandatory 2FA). |

If admin later requires two factors, that is a future flag; v1 “both” means **either** password or OTP is enough.

Staff (doctor/admin) use the same modes the practice enabled.

---

## 10. Notifications

Channels in v1: **email, SMS, and push** (native APNs/FCM **and** web push via PWA). Same event is sent on all practice-enabled channels the user can receive (email address, phone, or a device/browser with push permission).

| Event | Audience |
| --- | --- |
| Request submitted | Patient (acknowledgement); doctor and admin (inbox alert) |
| Request confirmed | Patient |
| Request declined | Patient |
| Reminder | Patient, only if status is `confirmed` |
| Cancelled | Patient; doctor/admin if the patient cancelled |
| Reschedule requested | Doctor and admin (same as a new request) |

**Reminders** fire only after confirmation, at each **admin-configured offset** before start (suggested default: 24 hours and 1 hour). If an offset is already in the past when the visit is confirmed (e.g. confirmed 30 minutes before a 1-hour reminder), skip that offset; still send any remaining future offsets. Cancelled/declined visits drop pending reminders.

If a channel fails, other channels still send; failures are logged. No marketing messages in v1.

---

## 11. Data we store vs do not store

**Store**

- Identity: role(s), display name, email and/or mobile number, auth identifiers, password hash if password mode is used.
- Practice settings (full catalog in §5), including timezone, locales, reminder offsets, intake schema.
- Intake answers on the appointment or patient profile for enabled fields (e.g. DOB if required).
- Appointments: patient, type, start, duration snapshot, status, actor who last changed status, timestamps.
- Notification delivery records (channel, event, status, time).
- Audit of confirm/decline/cancel (who, when).
- Push device/web-push subscriptions.

**Do not store in v1**

- Treatment notes, diagnoses, odontograms, images, prescriptions.
- Payment instruments, invoices, insurance IDs.
- Video session data.
- Other doctors’ calendars or other clinic locations.

Contact and intake fields exist to authenticate, notify, and book — not as a medical record.

---

## 12. v1 screens

Shared: sign in / register (email or phone, per auth setting), sign out, language from practice locales.

**Patient**

- Home / upcoming appointment.
- Request: pick type → fill required intake if missing → pick date → pick generated slot → submit.
- My appointments: list + detail (status, time, type, policy-aware cancel/reschedule actions).

**Doctor** (and admin when acting as doctor)

- Inbox: pending requests (confirm / decline).
- Calendar: day/week of confirmed visits and blocks; add blocked time.
- Appointment detail: mark completed / no-show; staff cancel or move.
- Needs close-out (only if complete/no-show is `required`).

**Admin**

- Everything on doctor, plus **Settings** covering the catalog in §5, and Users (roles, including combined doctor+admin, disable).

**Clients:** responsive web (installable PWA with web push), native iOS app, native Android app. Same capabilities on all three; doctor/admin must be fully usable on web; patients must be fully usable on native and web.

---

## 13. Booking flow (happy path)

1. Patient registers with email or mobile number (password and/or OTP per settings).
2. Patient chooses an active appointment type (duration comes from that type) and supplies required intake fields.
3. Patient picks an open slot (hours resolved from template + exceptions + timezone) and submits a **request**. Availability already applied the active contention policy. If a race occurs, show “slot no longer available.”
4. Doctor or admin is notified and confirms or declines.
5. If confirmed, the slot is occupied; patient is notified; reminders are scheduled at configured offsets on email, SMS, and push (native + web).
6. Patient attends; doctor marks completed or no-show if they choose, or if the required-close-out setting demands it.

---

## 14. Platforms

v1 ships **all** of:

- **Web app** usable in a browser, installable as a PWA, **web push** enabled.
- **Native iOS** app with APNs.
- **Native Android** app with FCM.

One API backend; three clients. Do not defer native apps or web push to a later version.

---

## 15. Recommended tech stack

Workshop instruction: leave the stack to engineering. Choice for v1:

| Layer | Choice | Why |
| --- | --- | --- |
| API + web | **TypeScript**, **Next.js** (App Router) | One language; web app and API routes; PWA-capable |
| Persistence | **PostgreSQL** + **Prisma** | Relational appointments/settings; migrations |
| Auth | Custom practice-settings-driven password (hashed) + OTP; sessions/JWT | Must match §9 without forcing a single IdP |
| Native | **Expo (React Native)** | Share TypeScript types/API client with web; iOS + Android from one codebase |
| Push | **Web Push** + **Expo notifications** (APNs/FCM) | Day-one native and PWA |
| Email | Transactional provider (e.g. Resend or SES) | Request/confirm/remind |
| SMS | Provider such as Twilio (or equivalent for the practice country) | OTP + reminders |
| Time | Store instants in **UTC**; display in practice IANA timezone | Settings-driven locale |

Hosting and CI can be decided at implementation time. Swap notification vendors without changing product behaviour.

---

## 16. Remaining gaps (optional polish)

Round 2 product questions are **locked**. Only implementation details remain if we want them before coding:

1. First production timezone and extra locales to ship besides `en`.
2. OTP length, expiry, and rate limits.
3. Exact SMS/email vendor accounts for the practice country.
4. App store / bundle identity for iOS and Android.

None of these block writing the domain model or settings UI.

---

## 17. Revision history

| Date | Change |
| --- | --- |
| 2026-09-22 | Initial v1 spec from workshop answers (solo dentist, request/approve, configurable types and cancel policy, web+mobile, email/SMS/push, no payments). |
| 2026-09-22 | Same-slot contention is admin-configured (`queue_until_confirm`, `hold_first_request`, `hide_on_request`); suggested default `hide_on_request`. |
| 2026-09-22 | Round 2 locked: reminders, timezone/language, auth, hours, intake, complete/no-show are settings-driven; dentist may be sole admin on one login; stack chosen (Next.js, Postgres, Expo); native iOS/Android **and** web PWA push on day one. |
