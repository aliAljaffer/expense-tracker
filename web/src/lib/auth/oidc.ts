interface OIDCDiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
  end_session_endpoint?: string;
}

interface IdTokenClaims {
  sub: string;
  nonce: string;
  exp: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

export async function fetchDiscovery(issuer: string): Promise<OIDCDiscoveryDocument> {
  const discoveryUrl = new URL(".well-known/openid-configuration", issuer);
  const response = await fetch(discoveryUrl.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC discovery: ${response.status}`);
  }

  return response.json();
}

export function buildAuthorizationUrl(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  nonce: string;
  scopes?: string[];
}): URL {
  const {
    issuer,
    clientId,
    redirectUri,
    codeChallenge,
    state,
    nonce,
    scopes = ["openid", "profile"],
  } = options;

  const url = new URL("protocol/openid-connect/auth", issuer);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  return url;
}

export async function exchangeCode(options: {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<TokenResponse> {
  const {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    code,
    verifier,
  } = options;

  const tokenUrl = new URL("protocol/openid-connect/token", issuer);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

export async function refreshToken(options: {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const { issuer, clientId, clientSecret, refreshToken: token } = options;

  const tokenUrl = new URL("protocol/openid-connect/token", issuer);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: token,
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

export function parseIdToken(idToken: string, expectedNonce: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const payload = parts[1];
  const decoded = Buffer.from(payload, "base64").toString("utf-8");
  const claims = JSON.parse(decoded) as IdTokenClaims;

  if (claims.nonce !== expectedNonce) {
    throw new Error("Nonce mismatch");
  }

  return claims;
}
