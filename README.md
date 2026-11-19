# RangeProof Agent

**Prove you qualify — without revealing your number.**

RangeProof Agent is a privacy eligibility checker. It proves that a private
number — a balance, a credit score, an age, an income — lies inside a public
range `[lo, hi]`, using a Groth16 zero-knowledge proof from a small original
Circom circuit. The number itself is never revealed: the only public outputs
are the range bounds and the proof.

## The problem

Eligibility checks today force an ugly trade-off:

- **Airdrops and allowlists** want "holders with at least X tokens" — so
  users must expose their full balance to every checker.
- **KYC-lite / age gates** want "18 or older" — so users hand over a full
  date of birth, or an entire ID document.
- **Credit and income gating** wants "score in [650, 850]" — so users leak
  the exact score.

In each case the checker only needs one bit of information — *in range, or
not* — but collects the whole number. That is a privacy leak by design, and
a honeypot for whoever stores the data.

## How RangeProof solves it

The user runs the prover locally with their secret `value` and the public
window `[lo, hi]`. The circuit (`circuit/rangeproof.circom`) constrains:

```
lo <= value <= hi
```

by forcing both differences, `value - lo` and `hi - value`, to decompose
into 32 bits. In the BN128 field a negative difference wraps to a huge
element that cannot fit 32 bits, so **an out-of-range value has no valid
witness and simply cannot be proven** — there is nothing to forge. Anyone
with the verification key can check the proof against the public signals
`[lo, hi]` and learn exactly one thing: the hidden value is in range.

## Architecture

```
            private                     public
           ┌───────┐        ┌────────────────────────┐
 value ───►│       │        │  proof + [lo, hi]      │      ┌──────────┐
 lo, hi ──►│ prover│ ─────► │  (value appears        │ ───► │ verifier │─► true/false
           │(local)│        │   nowhere in it)       │      └──────────┘
           └───────┘        └────────────────────────┘
 circuit/rangeproof.circom ──► wasm + zkey (prover)
                               verification_key.json (verifier)
 server.js  ── HTTP API: /health /ping /prove /verify (startup self-test)
 prove.js   ── shared snarkjs wrapper used by server.js and test.js
```

## Endpoints

| Method | Path      | Body / response                                                                 |
| ------ | --------- | ------------------------------------------------------------------------------- |
| GET    | `/health` | `{ status: "ok", circuit: {...}, selfTest: "PASS" }`                            |
| GET    | `/ping`   | `{ pong: true }`                                                                |
| GET    | `/verify` | `{ ok: true }` (liveness alias)                                                 |
| POST   | `/prove`  | `{ value, lo, hi }` → `{ proof, publicSignals }`; `422` if the statement is false |
| POST   | `/verify` | `{ proof, publicSignals }` → `{ valid: true \| false }`                          |

On startup the service **self-tests before accepting traffic**: it proves
and verifies an in-range sample and confirms an out-of-range statement
cannot be proven. If the self-test fails, the process exits.

## Live endpoint

**Public endpoint:** https://rangeproof-agent-production.up.railway.app

## Run it

```bash
npm install
npm start          # PORT env var, default 3000
npm test           # 16 automated checks: circuit + HTTP
./demo.sh          # live walkthrough, recorded in demo-output.txt
```

Prove a hidden balance of 7250 against the window [5000, 10000]:

```bash
curl -X POST localhost:3000/prove -H 'Content-Type: application/json' \
  -d '{"value":7250,"lo":5000,"hi":10000}'
# -> { proof: {...}, publicSignals: ["5000", "10000"] }   (7250 appears nowhere)

curl -X POST localhost:3000/verify -H 'Content-Type: application/json' \
  -d '{"proof": {...}, "publicSignals": ["5000", "10000"]}'
# -> { "valid": true }
```

## Rebuilding the circuit

The compiled artifacts in `circuit/build/` were produced locally by
`circuit/setup.sh` (Circom 2.1.9 + snarkjs): compile → self-generated
powers-of-tau (2^12) → Groth16 setup → `rangeproof_final.zkey` +
`verification_key.json`. A self-generated tau is appropriate for this
original demo circuit; a production deployment should use a public
multi-party ceremony transcript.

## The 2^31 bound (read this before reusing the circuit)

Circomlib comparators and `Num2Bits` work on fixed bit widths. This circuit
bit-checks every input at 31 bits and both differences at 32 bits, so
**`value`, `lo`, and `hi` must all be integers in `[0, 2^31)`**. Inside
that bound the integer reading of the statement is exact. Outside it,
proving is rejected — never silently mis-proven. This bound is not fine
print: a comparator-width mismatch between a circuit and the real-world
scale of its inputs makes statements unprovable in production while
sample-scale tests keep passing. RangeProof documents its bound in the
circuit source, enforces it in `prove.js`, and states it in `/health`.

## Use cases

- **Airdrop / allowlist gating** — "balance ≥ 5,000" without exposing the balance.
- **Age checks** — "age in [18, 150]" without a date of birth.
- **Credit gating** — "score in [650, 850]" without the exact score.
- **Income / salary bands** — prove a band for rentals, loans, or tiers.
- **Gaming / leaderboards** — prove a stat threshold without revealing stats.

## License

MIT — see [LICENSE](LICENSE).
