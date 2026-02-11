# ONExplorer - A demo interface for ONE Record.

How to run it locally:
- Clone this repository
- Enter in the folder
- Run: npm install
- Run: PORT=4080 npm start

The interface will be served on localhost:4080

## Run with Docker

Build and run a single instance:

```bash
docker build -t onexplorer .
docker run --rm -it \
  -p 3000:3000 -p 3001:3001 \
  -e PORT=3000 \
  -e REACT_APP_KEYCLOAK_URL=http://localhost:8080 \
  -e REACT_APP_KEYCLOAK_REALM=onerecord \
  -e REACT_APP_KEYCLOAK_CLIENT_ID=default-frontend \
  -e REACT_APP_DEFAULT_BASE_URL=http://localhost:8081 \
  onexplorer
```

Notes:
- The UI runs on `PORT`.
- The local SSE helper runs on `PORT+1` and must also be exposed.
- `REACT_APP_DEFAULT_BASE_URL` is used only as an initial default; users can still change it in **Settings**.
- Set `REACT_APP_ENFORCE_DEFAULT_BASE_URL=true` to force the configured default on every app startup.

## Run Multiple ONExplorer Instances

Use the provided compose file:

```bash
docker compose up --build
```

Default URLs in `docker-compose.yml`:
- `http://localhost:3000` (SSE helper on `3001`) with `REACT_APP_DEFAULT_BASE_URL=http://localhost:8081`
- `http://localhost:3100` (SSE helper on `3101`) with `REACT_APP_DEFAULT_BASE_URL=http://localhost:9081`

Adjust the environment values to match your ONE Record and Keycloak endpoints.
