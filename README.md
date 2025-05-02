# Camunda 8 SDK Test Project

This project demonstrates how to connect to a self-managed Camunda 8 instance using the official JavaScript SDK (`@camunda8/sdk`).

## Prerequisites

- Node.js installed
- A running Camunda 8 self-managed instance (e.g., using Docker Compose) accessible from your machine.

## Setup

1.  Clone or download this project.
2.  Navigate to the project directory: `cd camunda`
3.  Install dependencies: `npm install`

## Configuration

The connection configuration is defined in `index.js`. It uses environment variables or direct configuration passed to the `Camunda8` constructor. Key settings include:

-   `CAMUNDA_AUTH_STRATEGY`: Set to `OAUTH` for self-managed with Identity/Keycloak.
-   `CAMUNDA_OAUTH_URL`: The Keycloak token endpoint (e.g., `http://localhost:18080/auth/realms/camunda-platform/protocol/openid-connect/token`).
-   `ZEEBE_GRPC_ADDRESS`: The address of your Zeebe gateway (e.g., `localhost:26500`).
-   `ZEEBE_CLIENT_ID` / `ZEEBE_CLIENT_SECRET`: Credentials for the Zeebe client registered in Keycloak (defaults are `zeebe`/`zecret`, **verify these in your Keycloak setup**).
-   Base URLs for Operate, Tasklist, Optimize, Modeler.
-   `CAMUNDA_SECURE_CONNECTION`: Set to `false` if running locally without TLS.

Adjust the values in `index.js` to match your specific Camunda 8 environment if they differ from the defaults derived from the provided `docker compose ps` output.

## Running the Example

Execute the script to test the connection and fetch the Zeebe topology:

```bash
node index.js
```

You should see the Zeebe topology printed to the console if the connection is successful. If you encounter errors, double-check the configuration values in `index.js`, especially the client credentials and URLs, and ensure your Camunda 8 containers are running and healthy.
