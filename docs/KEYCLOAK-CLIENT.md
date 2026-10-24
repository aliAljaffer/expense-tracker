# Keycloak client for grooszy

VERDICT: YES.

The KeycloakOIDCClient CRD can create a dedicated client in the existing homelab realm through Git.

## Evidence

- Installed operator version is 26.7.1. There is no channel, the version is pinned by the ref 26.7.1 in kubernetes/infrastructure/keycloak-operator/kustomization.yaml:3. That ref ships the KeycloakOIDCClient CRD at version v2alpha1 and the controller.
- The operator code for that version requires the Keycloak CR feature client-admin-api:v2 before it creates clients. The Keycloak CR at kubernetes/infrastructure/keycloak/keycloak.yaml has no features block, so that flag must be set first.
- The operator also needs the Secret `keycloak-admin` in namespace `keycloak`, with keys `client-id` and `client-secret`, to call that API. The Keycloak guide says this Secret is created by hand during bootstrap. Seal it like the other secrets so no plaintext enters Git.
- The homelab realm is created by KeycloakRealmImport at kubernetes/infrastructure/keycloak/keycloak-realm-homelab.yaml:2. The import creates a realm only. It does not update or delete an existing realm, so a later client creation will survive a re-import.

## Recommended shape

```yaml
apiVersion: k8s.keycloak.org/v2alpha1
kind: KeycloakOIDCClient
metadata:
  name: grooszy
  namespace: keycloak
spec:
  keycloakCRName: keycloak
  realm: homelab
  client:
    enabled: true
    protocol: openid-connect
    redirectUris:
      - https://grooszy.alialjaffer.com/oauth2/callback
    auth:
      method: client-secret
      secretRef:
        name: grooszy-secret
        key: CLIENT_SECRET
```

metadata.name is the client ID. The secret is referenced by name only. The
`client` block is illustrative: the fields follow the Admin API v2 client
reference, so check the final shape against it before applying.

The file belongs at kubernetes/apps/grooszy/keycloak-oidc-client.yaml. Add it to the app kustomization.

## Open fact

Whether the Keycloak 26.7.1 server accepts the client-admin-api:v2 feature flag the operator checks for. Not determinable from the repo.
