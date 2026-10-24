# Enable grooszy to authenticate with Keycloak

This runbook configures the grooszy app to authenticate users against the homelab Keycloak realm using OIDC.

## What changes

The Keycloak operator deploys a new OIDC client (`grooszy`) and configures access token audience mapping. The feature flag `client-admin-api:v2` restarts the three Keycloak pods one at a time (rolling restart). The shared auth gate (`kubernetes/components/oauth2-proxy`) allows multiple apps to use the same homelab realm without per-app secrets.

## Setup: create the Keycloak service account (one-time, manual)

The operator needs a master-realm service account with admin privileges to create clients via the Admin API v2. Do this once on the live cluster using the admin console (accessible at https://kc.alialjaffer.com/admin/master/console/ on the LAN):

1. Log in as the bootstrap admin (credentials in `kubectl get secret keycloak-initial-admin -n keycloak -o go-template='{{.data.username | base64decode}}:{.data.password | base64decode}}'`).
2. Go to Realm Settings for the `master` realm.
3. Create a client:
   - Name: `keycloak-admin`.
   - Client authentication: enabled.
   - Service accounts enabled: enabled.
   - Standard flow disabled.
   - Direct access grants disabled.
4. Copy the client ID and secret (Credentials tab, Client secret field).
5. Grant roles to the service account (Service account roles tab):
   - Add `manage-clients` and `manage-realms` roles from the `realm-management` client (search for `manage-` and the available realm roles appear).
6. Back on your local machine, seal the secret:
   - Create `/tmp/keycloak-admin.json`:
     ```json
     {
       "client-id": "<client-id-from-step-4>",
       "client-secret": "<secret-from-step-4>"
     }
     ```
   - Seal it: `kubectl create secret generic keycloak-admin -n keycloak --from-file=/tmp/keycloak-admin.json --dry-run=client -o yaml | kubeseal -o yaml > kubernetes/infrastructure/keycloak/keycloak-admin.sealed.yaml`.
   - Add the sealed secret to `kubernetes/infrastructure/keycloak/kustomization.yaml`.
   - Commit to the homelab repo.

## Setup: configure OIDC in the operator (one-time, GitOps)

1. Merge the keycloak-grooszy-client branch to main in the homelab repo. This enables the `client-admin-api:v2` feature flag and creates the grooszy OIDC client.
2. ArgoCD reconciles the changes. The Keycloak Deployment rolls (3 pods, one at a time). The KeycloakOIDCClient creates the `grooszy` client in the `homelab` realm.
3. Once stable, verify the client exists: log in to https://kc.alialjaffer.com/admin/master/console/, go to Clients, and find `grooszy`.

## Configuration note: access token audience

The grooszy Go API validates access tokens by checking the `aud` (audience) claim equals the client ID. Keycloak must be configured to include the client ID in the `aud` claim. This requires an Audience protocol mapper on the client.

The KeycloakOIDCClient CRD (v2alpha1) does not expose protocol mappers, so this step is manual:

1. In the admin console, open the grooszy client.
2. Go to Mappers.
3. Create a mapper:
   - Name: `grooszy-audience`.
   - Type: `Audience`.
   - Included Client Audience: `grooszy`.
   - Add to access token: enabled.
   - Save.

Alternative: use `kcadm.sh` from inside a Keycloak pod to add the mapper programmatically:
```bash
kubectl exec -it keycloak-0 -n keycloak -- kcadm.sh create clients/CLIENT_ID/protocol-mappers/models \
  -r homelab \
  --server https://localhost:8443 \
  --realm master \
  --user admin \
  --password <ADMIN_PASSWORD> \
  -s name=grooszy-audience \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-audience-mapper \
  -s 'config."included.client.audience"=grooszy' \
  -s 'config."add.access.token.claim"=true'
```

Replace `<ADMIN_PASSWORD>` with the bootstrap admin password and `CLIENT_ID` with the UUID of the grooszy client (from the client details page).

## Deploy: app settings

Once the OIDC client is ready and the protocol mapper is in place, configure the grooszy Deployment:

Set environment variables in `kubernetes/apps/grooszy/api-deployment.yaml`:
- `OIDC_ISSUER=https://kc.alialjaffer.com/realms/homelab`: Keycloak issuer URL (public endpoint).
- `OIDC_CLIENT_ID=grooszy`: Client name from the Keycloak admin console.
- `OIDC_AUDIENCE=grooszy`: Same as client ID (required by the API token validator).
- `OIDC_OWNER_SUBJECT`: The Keycloak user's `sub` claim (opaque user ID from the Keycloak admin console: open the user, scroll to ID at the top, copy it). This identifies the owner of the expense data.
- `APP_ORIGIN=https://grooszy.alialjaffer.com`: The public app URL (used for OIDC redirect validation).

Example:
```yaml
env:
  - name: OIDC_ISSUER
    value: https://kc.alialjaffer.com/realms/homelab
  - name: OIDC_CLIENT_ID
    value: grooszy
  - name: OIDC_AUDIENCE
    value: grooszy
  - name: OIDC_OWNER_SUBJECT
    value: <user-id-from-keycloak>
  - name: APP_ORIGIN
    value: https://grooszy.alialjaffer.com
```

## Order of operations

1. Create the keycloak-admin secret (manual, one-time).
2. Seal and commit the secret to the homelab repo.
3. Merge keycloak-grooszy-client to homelab main.
4. Wait for ArgoCD to reconcile Keycloak (feature flag activates, client is created).
5. Add the Audience protocol mapper to the grooszy client (manual).
6. Set OIDC environment variables in the app Deployment.
7. Deploy the app.
8. Test: navigate to https://grooszy.alialjaffer.com, verify login redirects to https://kc.alialjaffer.com/realms/homelab/protocol/openid-connect/auth and returns to the app.

## Rollback

To revert to app-only auth (no Keycloak):

1. Remove OIDC_* environment variables from the Deployment.
2. Revert keycloak-grooszy-client in homelab main (delete the KeycloakOIDCClient, HTTPRoute, and feature flag).
3. Remove the keycloak-admin secret from homelab main.
4. Commit and push. ArgoCD reconciles.

The Keycloak pods restart as the feature flag is removed. The grooszy client persists in the homelab realm (realm import does not delete), but the app ignores it.
