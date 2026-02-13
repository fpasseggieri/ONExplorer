## Comparison scope

This document compares:

- Parent project: `aloccid-iata/ONExplorer` (`main`)
- Fork project: `fpasseggieri/ONExplorer` (`feature/implement-auth`)
- Compare URL: <https://github.com/aloccid-iata/ONExplorer/compare/main...fpasseggieri:feature/implement-auth>


## Functional differences

### 1. Authentication model changed

- **From**: manually stored JWT in Settings (`localStorage.token`).
- **To**: Keycloak login + token refresh (`keycloak-js`) and guest-mode fallback when Keycloak is unreachable.
- New auth module: `src/auth/keycloak.js`.
- API layer now resolves tokens asynchronously (`getAccessToken`) and sends versioned JSON-LD headers.

### 2. External server auth changed

- **From**: static per-server token.
- **To**: OAuth2 client-credentials with token endpoint/client id/secret, in-memory token cache, refresh buffer, request deduplication.
- New utility: `src/utils/externalAuth.js`.
- Settings UI updated to configure/test OAuth connection.

### 3. Runtime environment support added

- Runtime env injection through `window.__ENV__` (`public/env.js`, consumed by `src/utils/env.js`).
- Base API URL can be pre-seeded/forced via runtime env (`src/utils/runtimeSettings.js`).
- `public/index.html` now loads `env.js`.

### 4. Route protection and guest-mode UX

- Protected routes now gated by `isAuthenticated` in `src/App.js`.
- Guest mode warning banner appears when auth is unavailable.
- Database/actions are disabled in guest mode.
- Sidebar shows current auth user and Sign In/Sign Out actions.

### 5. Subscriptions and JSON-LD parsing robustness

- Subscription request list/detail parsing updated to tolerate multiple JSON-LD key shapes (`api:*`, expanded IRI, compact terms).
- Subscription creation payload now includes `api:sendLogisticsObjectBody: false`.
- External subscription request fetch now uses external auth utility instead of raw token plumbing.

### 6. Logistics object and change request flows

- Token resolution now automatic for internal/external calls in:
  - `src/pages/LogisticsObjectView.jsx`
  - `src/components/LogisticsObjectEdit.jsx`
  - `src/pages/ChangeRequestView.jsx`
- Logistics object view adds explicit Refresh and improved audit/change request resolution logic.

### 7. Dockerization and deployment additions

- Added: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `scripts/docker-entrypoint.sh`, `server/staticServer.js`, `.env.example`.
- Supports multi-instance ONExplorer setup and runtime env generation in container startup.
- README updated with Docker usage.

### 8. Miscellaneous cleanup/refactors

- `.gitignore` expanded and standardized.
- `start` scripts now use `cross-env` for cross-platform env vars.
- Minor code cleanup in multiple pages/components (removed unused imports/functions, useCallback refactors).


## Notable behavioral impact summary

- Authentication is no longer configured by typing JWT in settings; login/session are now Keycloak-managed.
- External server connections now depend on OAuth client credentials (or legacy static token fallback).
- Guest mode allows partial app usage when auth is down, while protected actions/routes are blocked.
- The fork is container-ready and supports runtime environment injection for multi-instance deployment.
- Subscription and logistics-object views were made more resilient to JSON-LD variations and external/internal token routing.
