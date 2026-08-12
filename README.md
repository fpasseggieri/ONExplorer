# ONExplorer - A demo interface for ONE Record.

Requirements: Node.js 26 and npm 11 or newer.

How to run it locally:
- Clone this repository
- Enter in the folder
- Run: `npm ci`
- Set `PORT=4080` and run `npm start`

On PowerShell:

```powershell
$env:PORT = 4080
npm start
```

On Linux/macOS:

```bash
PORT=4080 npm start
```

The Vite development interface is served on `http://localhost:4080`; the local notification helper uses port `4081`.

Create an optimized production bundle with:

```bash
npm run build
```

The frontend uses Vite and route-level code splitting. Docker installs the frontend toolchain only in the disposable build stage; the runtime stage installs only the Express server dependencies from `server/package-lock.json`.

## Run with Docker

Build and run a single instance:

```bash
docker build -t onexplorer .
docker run --rm -it \
  -p 3000:3000 \
  -e PORT=3000 \
  -e ONEXPLORER_PUBLIC_URL=http://localhost:3000 \
  -e REACT_APP_KEYCLOAK_URL=http://localhost:18080 \
  -e REACT_APP_KEYCLOAK_REALM=onerecord \
  -e REACT_APP_KEYCLOAK_CLIENT_ID=default-frontend \
  -e REACT_APP_DEFAULT_BASE_URL=http://localhost:8081 \
  onexplorer
```

Notes:
- Both Docker stages use Node.js 26 Alpine.
- The UI, SSE endpoint, and subscription helper now run on the same `PORT`.
- Set `ONEXPLORER_PUBLIC_URL` to the externally reachable URL when the container is behind a reverse proxy.
- `REACT_APP_DEFAULT_BASE_URL` is used only as an initial default for a role with no saved Base URL; users can still change it in **Settings**.
- External OAuth token requests are proxied by the ONExplorer server. If your token endpoint is set to `localhost` and ONExplorer runs in Docker, `localhost` is the container itself. Use a host reachable from the container (for example `host.docker.internal`) or set `ONEXPLORER_LOCALHOST_ALIAS`.
- On Linux Docker Engine, ensure `host.docker.internal` resolves inside the ONExplorer container (for example `extra_hosts: ["host.docker.internal:host-gateway"]`).
- For local development with self-signed certificates on OAuth token endpoints, you can opt in to insecure TLS only for local hosts by setting `ONEXPLORER_ALLOW_INSECURE_LOCALHOST_TLS=true`.

## Run Multiple ONExplorer Instances

Use the provided compose file:

```bash
docker compose up --build
```

Default URLs in `docker-compose.yml`:
- `http://localhost:3000` with `REACT_APP_DEFAULT_BASE_URL=https://localhost:7196/default`
- `http://localhost:3100` with `REACT_APP_DEFAULT_BASE_URL=https://localhost:7297/default`

Adjust the environment values to match your ONE Record and Keycloak endpoints.

## Staging Deployment

Use [`compose.staging.yml`](./compose.staging.yml) with a private `.env.staging` copied from [`.env.staging.example`](./.env.staging.example).

Security guidance for registry credentials:
- Store publish credentials only in Gitea Actions secrets: `REGISTRY_HOST`, `REGISTRY_REPOSITORY`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`.
- Use a dedicated registry account or token with write access only to the ONExplorer image path.
- Use a separate read-only credential on the staging server for `docker login` and image pulls.
- Never pass registry credentials as Docker build args, container env vars, or committed `.env` files.

The Gitea Actions workflow in [`.gitea/workflows/docker-image.yml`](./.gitea/workflows/docker-image.yml) builds every change, keeps pull-request builds secret-free, and only logs in to the registry on `push` events for `main` and `v*` tags.
