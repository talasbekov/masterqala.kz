# Shared reviewed creation recovery extraction

First bounded prerequisite for Vite mobile-client recovery, not the Vite integration itself.

Reviewed pure owner/session draft store, exact UUID/submitted snapshot validation/transport and React hooks move from Next-specific paths into the existing shared UI package. Hook transport/navigation were already injected; they remain framework-neutral and have no Next/router/API module import. Next files become explicit thin reexports, preserving existing consumers and storage/event contracts. No duplicate store/controller, new package/dependency, tariff/API payload, legacy-marker upgrade or fallback route is introduced.

New shared-entry regressions observed RED when exports were absent; after extraction they exercise real owner-scoped store, exact request identity/payload replay, local-only unknown refusal and injected dedicated endpoint transport. Existing Next mounted hook/storage/logout/remount/late-response regressions remain authoritative and are rerun. Initial new test fixture had an invalid category identifier; it was corrected to a UUID without relaxing production validation.

Vite AuthProvider/logout/RequireAuth/login/new-order integration is still pending. Existing Vite /orders POST remains unchanged in this extraction. Router-specific status Link adapter, safe auth return and mounted MemoryRouter tests are the next separately reviewed slice. Native SMS/reload/routing/geometry, Vite map-center synchronization, missing dictionaries and whole-project parity remain unverified/incomplete.

Pinned Node22.12.0/pnpm9.15.0 verification:55shared/66client tests pass; shared/client/master/operator/site TypeScript passes; client and Vite web production builds pass. Web build emits a nonblocking large-chunk warning. Direct source comparison confirms pure store unchanged byte-for-byte and hooks changed only their relative store import. Native behavior and actual Vite integration are not proven by these checks.
