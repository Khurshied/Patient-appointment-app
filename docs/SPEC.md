# Patient appointment app — v1 spec

Living product spec for a **solo dentist** appointment product. Locked decisions come from the interactive workshop. Implementation is out of scope for this document; this file is the source of truth for what v1 should do.

**Primary success metric:** a registered patient can request a slot without calling the practice.

---

## 1. Goals

- Let patients register (email or mobile number) and **request** an in-person appointment.
- Give the dentist and an admin a way to **confirm or decline** requests so the calendar does not commit a slot until a human approves it.
- Let the practice configure **appointment types** (name + duration) and **one** cancel/reschedule policy.
- After confirmation, remind the patient on **email, SMS, and push**.
- Ship **web and mobile** for the same v1 capabilities.

## 2. Non-goals (v1)

- Video / telehealth visits.
- Payments, deposits, or insurance claims.
- Clinical records: charting, treatment notes, prescriptions, X-rays, medical history beyond what is needed to identify the patient.
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
| Users | Patient, doctor, admin |
| Registration | Mobile number **or** email |
| Booking | Request → doctor or admin confirms |
| Slot lengths | Mixed; driven by admin-defined visit types |
| Cancel / reschedule | Configurable; exactly one policy active |
| Platforms | Web + mobile |
| Money | None |
| Reminders | Email + SMS + push, after confirmation |

---

## 4. Personas and permissions

### Patient

- Register and sign in with **email or mobile number**.
- Browse **open slots** for active appointment types.
- Submit an appointment **request** (not an instant booking).
- See own appointments and request status.
- Cancel and/or reschedule **only if** the active clinic policy allows it.
- Receive notifications (request received, decision, reminders, cancellation).

Patients cannot: change clinic hours, appointment types, or policies; see other patients; confirm their own requests.

### Doctor

- See a calendar of confirmed appointments and pending requests.
- Confirm or decline requests.
- Block time (unavailable) so those intervals are not offered as open slots.
- Optionally cancel/reschedule any appointment (staff override), regardless of patient-facing policy.
- Mark visits as completed or no-show (lightweight; no clinical note required).

The doctor does not need a separate “practice settings” surface if admin covers it, but the doctor **must** be able to work the inbox and calendar without an admin present.

### Admin

- All doctor calendar/inbox actions, plus:
- Create/edit/deactivate **appointment types** (name, duration, active flag).
- Set **working hours** and practice timezone (timezone itself is an open question; see Round 2).
- Set the **single active** cancel/reschedule policy.
- Manage users (invite/disable doctor and admin accounts; disable a patient account if needed).
- Configure notification channels as on/off at practice level if a provider is unavailable (default: all three on).

There is no receptionist role in v1.

---

## 5. Appointment types (admin-defined)

There is **no hardcoded** list (check-up, cleaning, etc.). Admin defines types.

Each type has:

- Display name (e.g. “New patient exam”).
- Duration in minutes (positive integer; UI may offer 15-minute increments).
- Active / inactive.

**Rules**

- Only **active** types appear when a patient requests a visit.
- Open slots are generated from duration: a 45-minute type needs a contiguous free window of at least 45 minutes inside working hours, with no confirmed appointment and no blocked time overlapping that window.
- Inactive types remain on historical appointments; they cannot be newly requested.
- Duration changes apply to **new** requests only; already requested/confirmed appointments keep the duration they were booked with.

---

## 6. Availability and open slots

**Inputs**

- Recurring working hours for the single dentist (e.g. Mon–Fri 09:00–17:00, with a lunch break as blocked or as a gap in hours).
- One-off blocked time (holiday, personal, procedure overflow).
- Confirmed appointments (occupy the calendar).
- Appointment type duration.

**Open slot** = a start time where `[start, start + duration)` sits entirely inside working hours and does not overlap blocked time or a **confirmed** appointment.

**Pending requests** do not occupy the slot as confirmed. Whether two patients can request the same start time is an open question (Round 2). Until that is decided, the spec’s default for implementation discussion is: **allow multiple pending requests for the same window; first confirmation wins; remaining requests are auto-declined** with a notification. This default is not locked.

Patients never type a free-form time; they pick from generated slots.

---

## 7. Booking state machine

```
requested → confirmed | declined
confirmed → cancelled | completed | no_show
requested → cancelled   (if the requester or staff withdraws before a decision)
```

| Status | Meaning |
| --- | --- |
| `requested` | Patient asked for a slot; not on the confirmed calendar. |
| `confirmed` | Doctor or admin accepted; slot is occupied; reminders may fire. |
| `declined` | Doctor or admin rejected, or system rejected after another request was confirmed for an overlapping window (if that default is adopted). |
| `cancelled` | Confirmed or requested visit will not happen. |
| `completed` | Visit happened (doctor/admin marks it). |
| `no_show` | Patient did not attend (doctor/admin marks it). |

**Confirm / decline**

- Only doctor or admin can confirm or decline.
- Confirming occupies `[start, start + duration)` for that dentist.
- Patient sees status on “My appointments”; they are notified of the decision.

**v1 lightness:** completed and no_show exist so the calendar can close the day; they do not require clinical notes.

---

## 8. Cancel and reschedule policy

Admin selects **exactly one** active policy. The options are mutually exclusive:

| Policy id | Patient can |
| --- | --- |
| `until_start` | Cancel or reschedule until the appointment start time. |
| `cutoff_24h` | Cancel or reschedule only until 24 hours before start. |
| `cancel_only` | Cancel (subject to a cutoff of “until start” unless later specified); reschedule is doctor/admin only. |
| `staff_only` | Neither cancel nor reschedule; doctor/admin only. |

**Reschedule** (when allowed) means: cancel the current confirmed (or requested) appointment and create a **new request** for a different slot of the same type, unless staff reschedules directly onto a new confirmed slot. Patient-initiated reschedule always goes through **request → confirm** again so the dentist still approves the new time.

Doctor and admin can always cancel or move a visit, independent of the patient-facing policy.

Changing the policy applies to **future** patient actions; already-confirmed appointments use the policy in force at the time of the action (not a historical snapshot unless Round 2 says otherwise). Default: **evaluate the policy live at cancel/reschedule time**.

---

## 9. Notifications

Channels in v1: **email, SMS, and push**. Same event is sent on all enabled channels (patient must have a reachable address for that channel: email, phone, or a logged-in device with push).

| Event | Audience |
| --- | --- |
| Request submitted | Patient (acknowledgement); doctor and admin (inbox alert) |
| Request confirmed | Patient |
| Request declined | Patient |
| Reminder | Patient, only if status is `confirmed` |
| Cancelled | Patient; doctor/admin if the patient cancelled |
| Reschedule requested | Doctor and admin (same as a new request) |

**Reminders** fire only after confirmation. Exact offsets (e.g. 24h and 1h before) are Round 2.

If a channel fails, other channels still send; failures are logged. No marketing messages in v1.

---

## 10. Data we store vs do not store

**Store**

- Identity: role, display name, email and/or mobile number, auth identifiers.
- Appointment types, working hours, blocked time, active cancel/reschedule policy.
- Appointments: patient, type, start, duration snapshot, status, actor who last changed status, timestamps.
- Notification delivery records (channel, event, status, time).
- Audit of confirm/decline/cancel (who, when).

**Do not store in v1**

- Treatment notes, diagnoses, odontograms, images, prescriptions.
- Payment instruments, invoices, insurance IDs.
- Video session data.
- Other doctors’ calendars or other clinic locations.

Contact fields exist to authenticate and notify, not as a medical record.

---

## 11. v1 screens

Shared: sign in / register (email or phone), sign out.

**Patient**

- Home / upcoming appointment.
- Request: pick type → pick date → pick generated slot → submit.
- My appointments: list + detail (status, time, type, policy-aware cancel/reschedule actions).

**Doctor**

- Inbox: pending requests (confirm / decline).
- Calendar: day/week of confirmed visits and blocks; add blocked time.
- Appointment detail: mark completed / no-show; staff cancel or move.

**Admin**

- Everything on doctor, plus:
- Appointment types (CRUD, active flag).
- Working hours and blocked time (practice-level).
- Cancel/reschedule policy (single select).
- Users (roles, disable).

Web and mobile expose the same capabilities; layout may differ. Doctor/admin tools must be usable on web; patients must be usable on mobile and web.

---

## 12. Booking flow (happy path)

1. Patient registers with email or mobile number.
2. Patient chooses an active appointment type (duration comes from that type).
3. Patient picks an open slot and submits a **request**.
4. Doctor or admin is notified and confirms or declines.
5. If confirmed, the slot is occupied; patient is notified; reminders are scheduled on email, SMS, and push.
6. Patient attends; doctor marks completed (or no-show / cancelled per policy).

---

## 13. Round 2 — open questions

Ask these **one at a time** to tighten the spec. They are not locked.

1. **Pending overlap:** If two patients request the same slot, do we queue both until one is confirmed, hold the slot for the first request, or hide the slot as soon as anyone requests it?
2. **Reminder timing:** How many reminders, and how far before the visit (e.g. 24 hours and 1 hour)?
3. **Timezone / locale:** Practice city and timezone? Display language(s)?
4. **Auth proof:** Password vs OTP-only (SMS/email codes) vs both?
5. **Doctor vs admin:** Can the dentist also be the only admin (one login, two roles), or always two accounts?
6. **Working hours model:** Recurring weekly template only, or exceptions (e.g. every other Saturday)?
7. **New patient intake:** Any extra fields on first request (name, date of birth), or identity + slot is enough?
8. **No-show / complete:** Required before the next day, or optional hygiene for the calendar?
9. **Tech stack:** Any preference (e.g. React/Next + Postgres, Flutter vs React Native) or greenfield choice is fine?
10. **Push:** Same backend for iOS and Android; is a later PWA-only push acceptable for web, or native apps required on day one?

---

## 14. Revision history

| Date | Change |
| --- | --- |
| 2026-09-22 | Initial v1 spec from workshop answers (solo dentist, request/approve, configurable types and cancel policy, web+mobile, email/SMS/push, no payments). |
