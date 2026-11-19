"use strict";

/*
 * prove.js — thin wrapper around snarkjs Groth16 for the RangeProof circuit.
 * Shared by server.js and test.js so both exercise exactly the same code path.
 */

const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const BUILD_DIR = path.join(__dirname, "circuit", "build");
const WASM_PATH = path.join(BUILD_DIR, "rangeproof_js", "rangeproof.wasm");
const ZKEY_PATH = path.join(BUILD_DIR, "rangeproof_final.zkey");
const VK_PATH = path.join(BUILD_DIR, "verification_key.json");

// All circuit values must stay below 2^31 (see circuit/rangeproof.circom).
const MAX_VALUE = 2 ** 31;

let cachedVk = null;
function verificationKey() {
  if (!cachedVk) {
    cachedVk = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  }
  return cachedVk;
}

function checkBound(name, n) {
  if (!Number.isInteger(n) || n < 0 || n >= MAX_VALUE) {
    throw new Error(`${name} must be an integer in [0, 2^31); got ${n}`);
  }
}

/**
 * Produce a Groth16 proof that lo <= value <= hi.
 * `value` stays private: it is only fed to the local witness generator.
 * Returns { proof, publicSignals } where publicSignals = [lo, hi].
 * Throws if the statement is false (no valid witness exists) or inputs
 * are out of bounds.
 */
async function prove(value, lo, hi) {
  checkBound("value", value);
  checkBound("lo", lo);
  checkBound("hi", hi);
  if (lo > hi) throw new Error(`empty range: lo (${lo}) > hi (${hi})`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { value: String(value), lo: String(lo), hi: String(hi) },
    WASM_PATH,
    ZKEY_PATH
  );
  return { proof, publicSignals };
}

/**
 * Verify a RangeProof proof. The verification key belongs to this circuit
 * only, so a valid verification accepts exactly one statement:
 * "the prover knows a value in [lo, hi]" for the public signals [lo, hi].
 */
async function verify(proof, publicSignals) {
  if (!Array.isArray(publicSignals) || publicSignals.length !== 2) return false;
  try {
    return await snarkjs.groth16.verify(verificationKey(), publicSignals, proof);
  } catch {
    return false;
  }
}

module.exports = { prove, verify, MAX_VALUE, paths: { WASM_PATH, ZKEY_PATH, VK_PATH } };
