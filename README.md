# Patient appointment app

A **solo dentist** scheduling product: patients request in-person appointments; the doctor or admin confirms them; reminders go out by email, SMS, and push.

v1 is **booking + reminders only** (no clinical records, video visits, or payments). Clinic rules (hours, slot contention, cancel policy, reminders, auth, intake, locale) are **admin settings**, not hardcoded.

Clients on day one: **web (PWA + web push)**, **iOS**, and **Android**.

The product spec is in [docs/SPEC.md](docs/SPEC.md).
