UI MIGRATION RULES
-----------------
- Vite code is treated as UI-only donor code.
- No Vite runtime, routing, env, or data logic is allowed in Next.
- All imported UI must be:
  - Client components
  - Props-driven
  - Side-effect free during render

ENFORCEMENT
-----------
- UI code must NOT import:
  - next/navigation
  - supabase
  - app/api
  - process.env
  - window during render

VIOLATION POLICY
----------------
If any rule is violated:
- Reject the change
- Revert immediately


📌 This document is immutable.
