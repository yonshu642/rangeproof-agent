#!/usr/bin/env bash
# Local proving setup for the RangeProof circuit.
# Demo-grade ceremony: a self-generated powers-of-tau is fine for an
# original demo circuit (documented as such in the README).
set -euo pipefail
cd "$(dirname "$0")"
SNARKJS="../node_modules/.bin/snarkjs"
mkdir -p build

echo "== compile =="
../bin/circom rangeproof.circom --r1cs --wasm --sym -o build -l ../node_modules
$SNARKJS r1cs info build/rangeproof.r1cs | grep -E "Constraints|Public Inputs|Private Inputs" || true

echo "== powers of tau (2^12) =="
$SNARKJS powersoftau new bn128 12 build/pot12_0000.ptau -v >/dev/null
$SNARKJS powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau \
  --name="rangeproof demo contribution" -v -e="rangeproof wildcard demo entropy 2026" >/dev/null
$SNARKJS powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v >/dev/null

echo "== groth16 setup =="
$SNARKJS groth16 setup build/rangeproof.r1cs build/pot12_final.ptau build/rangeproof_0000.zkey
$SNARKJS zkey contribute build/rangeproof_0000.zkey build/rangeproof_final.zkey \
  --name="rangeproof demo zkey" -v -e="rangeproof zkey entropy 2026" >/dev/null
$SNARKJS zkey export verificationkey build/rangeproof_final.zkey build/verification_key.json

echo "== done =="
ls -la build/
