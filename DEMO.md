# Demo script — RangeProof Agent (target: under 3 minutes)

A terminal walkthrough. Everything shown is real: `demo-output.txt` in this
repo is the recorded output of exactly these steps (`./demo.sh` reproduces
it end to end).

## Setup (before recording, ~10 s of narration)

> "Eligibility checks force you to reveal the whole number — your full
> balance, your exact birth date, your precise credit score — when the
> checker only needs one bit: in range, or not. RangeProof Agent fixes
> that with a zero-knowledge proof."

## Shot 1 — Start the agent (0:00–0:30)

```bash
npm start
```

Point at the startup log:

> "Before it accepts any traffic, the agent self-tests: it proves and
> verifies a sample statement, and confirms an out-of-range statement
> *cannot* be proven. The ERROR line from Num2Bits is that deliberate
> failing attempt — watching it fail is the pass condition. Self-test
> PASS, and we're listening."

## Shot 2 — Health (0:30–0:50)

```bash
curl localhost:3000/health
```

> "The health endpoint reports the circuit: Groth16 on BN128, the
> statement `lo <= value <= hi` with the value private, and the documented
> bound — every value below 2^31."

## Shot 3 — Prove a hidden balance (0:50–1:40)

Narration:

> "Meet our user. Their real balance is 7,250 — private. An airdrop wants
> holders in the window 5,000 to 10,000. The user proves eligibility
> locally:"

```bash
curl -X POST localhost:3000/prove -H 'Content-Type: application/json' \
  -d '{"value":7250,"lo":5000,"hi":10000}'
```

Zoom on the response:

> "Look at the public signals: `["5000", "10000"]`. That's all the world
> ever sees — the range, and a Groth16 proof. The number 7,250 appears
> nowhere in what leaves the prover."

## Shot 4 — Verify, knowing nothing (1:40–2:20)

```bash
curl -X POST localhost:3000/verify -H 'Content-Type: application/json' \
  -d '{"proof": { ... }, "publicSignals": ["5000", "10000"]}'
# -> {"valid": true}
```

> "Anyone — a contract, a backend, the zkVerify network — can verify this
> proof against the circuit's verification key and learn exactly one bit:
> this user's hidden number is inside the window. Not the number. Not a
> hint of it."

## Shot 5 — The failure case is the feature (2:20–2:50)

```bash
curl -X POST localhost:3000/prove -H 'Content-Type: application/json' \
  -d '{"value":4200,"lo":5000,"hi":10000}'
# -> HTTP 422, "cannot prove statement"
```

> "A balance of 4,200 is below the window — and there is no proof to be
> made. The circuit's constraints have no witness for a false statement,
> so cheating isn't rejected by a policy check; it's mathematically
> impossible. That's the whole pitch: prove you qualify, reveal nothing."

## Closing line (2:50–3:00)

> "RangeProof Agent — original circuit, real Groth16 proofs, and a bound
> we document instead of hiding. Built for the zkVerify Agent Games,
> Wildcard track."
