"use strict";

/*
 * test.js — automated checks for the RangeProof Agent.
 * Run: npm test   (or: node test.js)
 * Exits non-zero if any check fails.
 */

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const { prove, verify } = require("./prove");

let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

function request(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: "127.0.0.1", port, method, path: pathname, headers: { "Content-Type": "application/json" } },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(buf); } catch { /* leave null */ }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await request(port, "GET", "/ping");
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log("== circuit-level checks ==");

  // 1) In-range value proves and verifies.
  const inRange = await prove(7250, 5000, 10000);
  check("in-range value (7250 in [5000,10000]) proves", !!inRange.proof);
  check("public signals expose only [lo, hi], never the value",
    JSON.stringify(inRange.publicSignals) === JSON.stringify(["5000", "10000"]));
  check("in-range proof verifies", await verify(inRange.proof, inRange.publicSignals));

  // 2) Boundary values prove (lo == value and value == hi).
  const atLo = await prove(5000, 5000, 10000);
  check("value == lo proves and verifies", await verify(atLo.proof, atLo.publicSignals));
  const atHi = await prove(10000, 5000, 10000);
  check("value == hi proves and verifies", await verify(atHi.proof, atHi.publicSignals));

  // 3) Out-of-range values cannot be proven.
  let belowThrew = false;
  try { await prove(4999, 5000, 10000); } catch { belowThrew = true; }
  check("value below lo (4999) cannot be proven", belowThrew);

  let aboveThrew = false;
  try { await prove(10001, 5000, 10000); } catch { aboveThrew = true; }
  check("value above hi (10001) cannot be proven", aboveThrew);

  // 4) Tampered public signals fail verification.
  const tampered = ["6000", "10000"]; // claim a different lo than was proven
  check("tampered public signals fail verification", !(await verify(inRange.proof, tampered)));

  // 5) Out-of-bound inputs (>= 2^31) are rejected before proving.
  let boundThrew = false;
  try { await prove(2 ** 31, 0, 2 ** 31 - 1); } catch { boundThrew = true; }
  check("value >= 2^31 rejected by the documented bound", boundThrew);

  console.log("== HTTP endpoint checks ==");
  const port = 18777;
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));

  try {
    const up = await waitForServer(port);
    check("server starts and passes its startup self-test", up && serverLog.includes("self-test PASS"));

    const health = await request(port, "GET", "/health");
    check("GET /health -> 200 ok", health.status === 200 && health.json.status === "ok");

    const ping = await request(port, "GET", "/ping");
    check("GET /ping -> pong", ping.status === 200 && ping.json.pong === true);

    const proveRes = await request(port, "POST", "/prove", { value: 7250, lo: 5000, hi: 10000 });
    check("POST /prove -> 200 with proof + publicSignals",
      proveRes.status === 200 && !!proveRes.json.proof && Array.isArray(proveRes.json.publicSignals));

    const verifyRes = await request(port, "POST", "/verify", {
      proof: proveRes.json.proof, publicSignals: proveRes.json.publicSignals,
    });
    check("POST /verify -> valid: true", verifyRes.status === 200 && verifyRes.json.valid === true);

    const badVerify = await request(port, "POST", "/verify", {
      proof: proveRes.json.proof, publicSignals: ["1", "2"],
    });
    check("POST /verify with wrong range -> valid: false",
      badVerify.status === 200 && badVerify.json.valid === false);

    const oor = await request(port, "POST", "/prove", { value: 42, lo: 5000, hi: 10000 });
    check("POST /prove out-of-range -> 422 (unprovable)", oor.status === 422);
  } finally {
    child.kill("SIGTERM");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test run crashed:", e);
  process.exit(1);
});
