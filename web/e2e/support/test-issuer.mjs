import { createServer } from "http";
import { createHmac, createHash, randomBytes } from "crypto";
import { URL } from "url";

const PORT = parseInt(process.env.ISSUER_PORT || "8900", 10);
const ISSUER = process.env.ISSUER_URL || `http://localhost:${PORT}`;
const CLIENT_ID = "test-client";

// Simple in-memory store for authorization codes
const authorizationCodes = new Map();
const refreshTokens = new Map();

// Generate a simple JWT header.payload.signature structure
function createJwt(payload, secret) {
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const headerEncoded = Buffer.from(header).toString("base64url");
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const message = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac("sha256", secret).update(message).digest("base64url");

  return `${message}.${signature}`;
}

function parseUrlEncodedBody(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params);
}

function parseUrlQuery(query) {
  const params = new URLSearchParams(query);
  return Object.fromEntries(params);
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, ISSUER);
  const pathname = url.pathname;
  const query = url.search;

  // Discovery endpoint
  if (pathname === "/.well-known/openid-configuration") {
    res.writeHead(200);
    res.end(JSON.stringify({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      end_session_endpoint: `${ISSUER}/logout`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    }));
    return;
  }

  // Authorize endpoint
  if (pathname === "/authorize" && req.method === "GET") {
    const params = parseUrlQuery(query);
    const code = randomBytes(32).toString("hex");

    // Store the code with verifier challenge for PKCE
    authorizationCodes.set(code, {
      codeChallenge: params.code_challenge,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      state: params.state,
      nonce: params.nonce,
      codeChallengeMethod: params.code_challenge_method,
    });

    const redirectUrl = new URL(params.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", params.state);

    console.log(`[authorize] Redirecting to ${redirectUrl.toString()}`);
    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  // Token endpoint
  if (pathname === "/token" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const params = parseUrlEncodedBody(body);
        const grantType = params.grant_type;

        if (grantType === "authorization_code") {
          const code = params.code;
          const verifier = params.code_verifier;

          if (!authorizationCodes.has(code)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "invalid_code" }));
            return;
          }

          const stored = authorizationCodes.get(code);

          // Verify PKCE
          if (stored.codeChallengeMethod === "S256") {
            const hash = createHash("sha256").update(verifier).digest("base64url");
            if (hash !== stored.codeChallenge) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: "invalid_grant" }));
              return;
            }
          }

          authorizationCodes.delete(code);

          // Generate tokens
          const refreshToken = randomBytes(32).toString("hex");
          const expiresIn = parseInt(process.env.ACCESS_TOKEN_LIFETIME || "3600", 10);

          // Store refresh token
          refreshTokens.set(refreshToken, {
            clientId: stored.clientId,
            nonce: stored.nonce,
          });

          const now = Math.floor(Date.now() / 1000);
          const idTokenPayload = {
            iss: ISSUER,
            sub: "test-subject-123",
            aud: CLIENT_ID,
            nonce: stored.nonce,
            exp: now + expiresIn,
            iat: now,
          };

          const idToken = createJwt(idTokenPayload, "test-secret");
          const accessToken = randomBytes(32).toString("hex");

          res.writeHead(200);
          res.end(JSON.stringify({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: expiresIn,
            refresh_token: refreshToken,
            id_token: idToken,
          }));
          return;
        }

        if (grantType === "refresh_token") {
          const token = params.refresh_token;

          if (!refreshTokens.has(token)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }

          const stored = refreshTokens.get(token);
          const expiresIn = parseInt(process.env.ACCESS_TOKEN_LIFETIME || "3600", 10);
          const now = Math.floor(Date.now() / 1000);

          const idTokenPayload = {
            iss: ISSUER,
            sub: "test-subject-123",
            aud: CLIENT_ID,
            nonce: stored.nonce,
            exp: now + expiresIn,
            iat: now,
          };

          const idToken = createJwt(idTokenPayload, "test-secret");
          const accessToken = randomBytes(32).toString("hex");

          res.writeHead(200);
          res.end(JSON.stringify({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: expiresIn,
            refresh_token: token,
            id_token: idToken,
          }));
          return;
        }

        res.writeHead(400);
        res.end(JSON.stringify({ error: "unsupported_grant_type" }));
      } catch (error) {
        console.error("Token endpoint error:", error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "server_error" }));
      }
    });
    return;
  }

  // Logout endpoint
  if (pathname === "/logout") {
    const params = parseUrlQuery(query);
    const redirectUri = params.post_logout_redirect_uri;

    if (redirectUri) {
      res.writeHead(302, { Location: redirectUri });
      res.end();
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ message: "Logged out" }));
    }
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Test OIDC issuer listening on ${ISSUER}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
