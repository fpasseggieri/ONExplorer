# ONExplorer - A demo interface for ONE Record.

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

The interface will be served on localhost:4080

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
- The UI, SSE endpoint, and subscription helper now run on the same `PORT`.
- Set `ONEXPLORER_PUBLIC_URL` to the externally reachable URL when the container is behind a reverse proxy.
- `REACT_APP_DEFAULT_BASE_URL` is used only as an initial default; users can still change it in **Settings**.
- Set `REACT_APP_ENFORCE_DEFAULT_BASE_URL=true` to force the configured default on every app startup.

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
