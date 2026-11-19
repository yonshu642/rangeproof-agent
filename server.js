"use strict";

/*
 * RangeProof Agent — HTTP service.
 *
 * Proves (and verifies) statements of the form:
 *   "a private number lies inside the public range [lo, hi]"
 * without the number ever leaving the prover or appearing in the proof.
 *
 * Endpoints:
 *   GET  /health  -> service status + circuit info
 *   GET  /ping    -> { pong: true }
 *   GET  /verify  -> liveness alias used by some dashboards ({ ok: true })
 *   POST /prove   { value, lo, hi }          -> { proof, publicSignals }
 *   POST /verify  { proof, publicSignals }   -> { valid: true|false }
 *
 * Plain Node http, no web framework: the only dependency is snarkjs.
 * On startup the service runs a self-test (prove + verify a sample, and
 * confirm an out-of-range statement cannot be proven) before it accepts
 * traffic; if the self-test fails the process exits instead of serving.
 */

const http = require("http");
const { prove, verify, MAX_VALUE } = require("./prove");

const PORT = process.env.PORT || 3000;

const CIRCUIT_INFO = {
  name: "RangeProof",
  curve: "bn128",
  protocol: "groth16",
  statement: "lo <= value <= hi, value private",
  publicSignals: ["lo", "hi"],
  bound: `all values must be integers in [0, 2^31); max ${MAX_VALUE - 1}`,
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      agent: "rangeproof-agent",
      version: "1.0.0",
      circuit: CIRCUIT_INFO,
      selfTest: "PASS",
    });
  }

  if (req.method === "GET" && url.pathname === "/ping") {
    return sendJson(res, 200, { pong: true });
  }

  if (req.method === "GET" && url.pathname === "/verify") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/prove") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
    const { value, lo, hi } = body;
    if (value === undefined || lo === undefined || hi === undefined) {
      return sendJson(res, 400, { error: "expected { value, lo, hi }" });
    }
    try {
      const { proof, publicSignals } = await prove(Number(value), Number(lo), Number(hi));
      // publicSignals carry only [lo, hi] — `value` is never exposed.
      return sendJson(res, 200, { proof, publicSignals });
    } catch (e) {
      // A false statement has no witness: proving fails, and that failure
      // IS the answer — the value is outside the range.
      return sendJson(res, 422, { error: `cannot prove statement: ${e.message}` });
    }
  }

  if (req.method === "POST" && url.pathname === "/verify") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
    const { proof, publicSignals } = body;
    if (!proof || !publicSignals) {
      return sendJson(res, 400, { error: "expected { proof, publicSignals }" });
    }
    const valid = await verify(proof, publicSignals.map(String));
    return sendJson(res, 200, { valid });
  }

  return sendJson(res, 404, { error: "not found" });
}

async function selfTest() {
  // 1) An in-range statement proves and verifies.
  const { proof, publicSignals } = await prove(7250, 5000, 10000);
  if (!(await verify(proof, publicSignals))) {
    throw new Error("self-test: in-range proof did not verify");
  }
  // 2) An out-of-range statement must be impossible to prove.
  let threw = false;
  try {
    await prove(4200, 5000, 10000);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("self-test: out-of-range statement was provable");
  console.log("[rangeproof] startup self-test PASS");
}

async function main() {
  await selfTest();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => sendJson(res, 500, { error: String(e && e.message || e) }));
  });
  server.listen(PORT, () => {
    console.log(`[rangeproof] listening on port ${PORT}`);
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[rangeproof] failed to start:", e);
    process.exit(1);
  });
}

module.exports = { selfTest };
