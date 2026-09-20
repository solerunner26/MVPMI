> **Demo logins for the development preview only.** All names, numbers and
> passwords below are synthetic test data; never use real personal details.

## Main administrator

Hidden entrance: tap the **MVPMl sun logo 5 times quickly** on any screen, then:

- Gate code: **5831**
- Username: **admin**
- Password: **Preview@2026!**

The sun-tap entrance is sealed while a village-administrator session is signed
in, and village administrators never receive the gate code or main password.

## Village administrators (separate sign-in)

Use the visible **"ગામ એડમિન સાઇન ઇન / Village admin sign in"** button and sign in
with the phone number and password. The sign-in lasts 12 hours.

| Village                    | Name                | Phone      | Password         |
| -------------------------- | ------------------- | ---------- | ---------------- |
| થોરાળા / Thorala           | Jayaben Rathod      | 9001000001 | Thorala@2026     |
| સથરા / Sathra              | Rameshbhai Solanki  | 9001000002 | Sathra@2026      |
| તરેડી / Taredi             | Manishaben Bhimani  | 9001000003 | Taredi@2026      |
| લીલવણ / Lilvan             | Dipakbhai Gohil     | 9001000004 | Lilvan@2026      |
| દૂધાળા નં 1 / Dudhala No 1 | Saritaben Parmar    | 9001000005 | Dudhala@2026     |
| તલગાજરડા / Talgajarada     | Vijaybhai Chudasama | 9001000006 | Talgajarada@2026 |
| ઝીંજકા / Zinzaka           | Nitaben Makwana     | 9001000007 | Zinzaka@2026     |

## Sample data to explore

- **Pending village verification:** "Pending Patelia" (9002000001, Taredi) —
  sign in as the Taredi administrator to verify and forward, or reject.
- **Already verified, awaiting main approval:** "Forwarded Falia" (9002000002,
  Sathra) — sign in as the main administrator to approve or reject.
- **Change proposal awaiting the main decision:** Meera Gohil's new address —
  sign in as the Lilvan administrator ("My village members") or the main
  administrator ("Update requests").
- **Rejected application:** "Unknown Umbre" (9002000003) — visible to the main
  administrator in "Rejected / closed requests".
- **Removed member:** "Moved Mer" (9002000004) — main administrator, "Removed
  members" tab.

Reseed at any time on a fresh database with `node scripts/seed-demo.mjs`.
