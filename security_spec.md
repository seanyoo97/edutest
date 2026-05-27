# Security Spec

## Data Invariants
- `responses` collection only allows create. No Read, Update, Delete for non-admins.
- `responses` create requires validation:
   - score: number
   - answers: array (size 10, numbers)
   - submittedAt: string (timestamp equal to request.time)
   - metaVersion: "v1.0"
- Admin read (list, get) allowed if user email is present in `admins` collection.

## The "Dirty Dozen" Payloads
1. Create Response - Missing fields (Fail)
2. Create Response - Invalid score type (string) (Fail)
3. Create Response - Ghost fields (Fail)
4. Create Response - Valid (Success)
5. Read responses as unauthenticated (Fail)
6. Read responses as authenticated non-admin (Fail)
7. Read responses as auth admin (Success)
8. Update Response (Fail)
9. Delete Response (Fail)
10. Create Admin Document (Fail)
11. Spoof Admin Email (Fail)
12. Read Admin collection as unauthenticated (Fail)
