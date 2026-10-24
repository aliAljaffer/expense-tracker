import { createServer } from "http";
import { URL } from "url";

const PORT = parseInt(process.env.API_PORT || "8901", 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

let lastHeaders = {
  authorization: null,
  cookie: null,
};

const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;

  // Health check endpoint
  if (pathname === "/healthz") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Accounts endpoint
  if (pathname === "/api/accounts") {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie;

    // Record the headers
    lastHeaders = {
      authorization: authHeader || null,
      cookie: cookieHeader || null,
    };

    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      accounts: [
        {
          id: "acc-123",
          bank: "Alinma",
          masked_number: "****1234",
          kind: "checking",
          currency: "SAR",
          balance: 50000,
          balance_date: "2024-10-24",
        },
      ],
    }));
    return;
  }

  // Last headers recording endpoint
  if (pathname === "/__last") {
    res.writeHead(200);
    res.end(JSON.stringify(lastHeaders));
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Fake API listening on ${BASE_URL}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
