#!/bin/bash
# Starts a throwaway Vault in dev mode (in-memory, local only) and stores the H2
# credentials in it. Development use only.
#
# Generates fresh secrets on every run and writes them to backend/vault/dev.env.
# Load that file in the shell you start the backend from:
#
#   source backend/vault/dev.env
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$SCRIPT_DIR/backend/vault"
COMPOSE_FILE="$VAULT_DIR/compose.yaml"
ENV_FILE="$VAULT_DIR/dev.env"
CONTAINER_NAME="vault-myapp"
VAULT_ADDR="http://127.0.0.1:8200"

random_hex() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }

VAULT_TOKEN="${VAULT_TOKEN:-$(random_hex)}"
KEY_PASSWORD="${KEY_PASSWORD:-$(random_hex)}"
DB_USERNAME="${DB_USERNAME:-sa}"
DB_PASSWORD="${DB_PASSWORD:-$(random_hex)}"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "No compose.yaml found at $COMPOSE_FILE"
    exit 1
fi

echo "Starting Vault (dev mode)..."
VAULT_TOKEN="$VAULT_TOKEN" docker compose -f "$COMPOSE_FILE" up -d --force-recreate vault

echo "Waiting for Vault to be ready..."
tries=0
until docker exec -e VAULT_ADDR="$VAULT_ADDR" "$CONTAINER_NAME" vault status >/dev/null 2>&1; do
    tries=$((tries+1))
    if [ "$tries" -ge 15 ]; then
        echo "Vault is not responding after 15s. Current status:"
        docker exec -e VAULT_ADDR="$VAULT_ADDR" "$CONTAINER_NAME" vault status || true
        exit 1
    fi
    sleep 1
done

echo "Storing DB credentials in Vault..."
for path in secret/MyApp secret/MyApp/dev; do
    printf '{"myappdb.username":"%s","myappdb.password":"%s"}' "$DB_USERNAME" "$DB_PASSWORD" |
        VAULT_TOKEN="$VAULT_TOKEN" docker exec -i -e VAULT_ADDR="$VAULT_ADDR" -e VAULT_TOKEN \
            "$CONTAINER_NAME" vault kv put "$path" - >/dev/null
done

umask 077
cat > "$ENV_FILE" <<ENVFILE
export VAULT_TOKEN='$VAULT_TOKEN'
export KEY_PASSWORD='$KEY_PASSWORD'
export SPRING_PROFILES_ACTIVE=dev
ENVFILE

echo
echo "Vault is up at $VAULT_ADDR (listening on localhost only)."
echo "Load the backend environment in the shell you will run it from:"
echo
echo "  source backend/vault/dev.env"
echo
