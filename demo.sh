#!/usr/bin/env bash
# Runs the live demo end-to-end and records it in demo-output.txt.
set -u
cd "$(dirname "$0")"
PORT=18778
export PORT
node server.js > /tmp/rangeproof-demo-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

# wait for the server (it self-tests before listening)
for i in $(seq 1 30); do
  curl -s "http://127.0.0.1:$PORT/ping" >/dev/null 2>&1 && break
  sleep 0.5
done

{
  echo "\$ node server.js   # startup self-test runs first"
  cat /tmp/rangeproof-demo-server.log
  echo
  echo "\$ curl localhost:$PORT/health"
  curl -s "http://127.0.0.1:$PORT/health" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
  echo
  echo "\$ curl localhost:$PORT/ping"
  curl -s "http://127.0.0.1:$PORT/ping"
  echo
  echo
  echo "# A user with a PRIVATE balance of 7250 wants to prove it lies in"
  echo "# the eligibility window [5000, 10000] — without revealing 7250."
  echo "\$ curl -X POST localhost:$PORT/prove -d '{\"value\":7250,\"lo\":5000,\"hi\":10000}'"
  curl -s -X POST "http://127.0.0.1:$PORT/prove" -H 'Content-Type: application/json' \
    -d '{"value":7250,"lo":5000,"hi":10000}' > /tmp/rangeproof-proof.json
  node -e "const r=require('/tmp/rangeproof-proof.json'); console.log('publicSignals:', r.publicSignals, ' <- only the range; the balance 7250 appears nowhere'); console.log('proof (Groth16, bn128):', JSON.stringify(r.proof).slice(0,120) + '...')"
  echo
  echo "# Anyone can now verify the claim — seeing only the proof and [5000, 10000]:"
  echo "\$ curl -X POST localhost:$PORT/verify -d @proof.json"
  node -e "console.log(JSON.stringify(require('/tmp/rangeproof-proof.json')))" > /tmp/rangeproof-verify-body.json
  curl -s -X POST "http://127.0.0.1:$PORT/verify" -H 'Content-Type: application/json' -d @/tmp/rangeproof-verify-body.json
  echo
  echo
  echo "# And a balance of 4200 (below the window) can never produce a proof:"
  echo "\$ curl -X POST localhost:$PORT/prove -d '{\"value\":4200,\"lo\":5000,\"hi\":10000}'"
  curl -s -w "\nHTTP %{http_code}\n" -X POST "http://127.0.0.1:$PORT/prove" -H 'Content-Type: application/json' \
    -d '{"value":4200,"lo":5000,"hi":10000}'
} 2>&1 | tee demo-output.txt
