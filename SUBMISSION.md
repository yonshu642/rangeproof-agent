# Wildcard submission — draft for the Agent Games dashboard form

> Status: DRAFT. Placeholders marked TO_BE_* are filled in after the public
> GitHub repo and the hosted endpoint exist. Registration deadline:
> 20 Nov 23:59 UTC-7.

## Title

RangeProof Agent — prove you qualify, reveal nothing

## Agent link

https://github.com/yonshu642/rangeproof-agent

## Public endpoint

https://rangeproof-agent-production.up.railway.app (answers /health, /ping, /prove, /verify)

## Use case

Eligibility checks leak data by design. Airdrops want "balance at least X",
age gates want "18+", credit products want "score in range" — and in every
case the user must hand over the exact number when the checker only needs
one bit: in range, or not. RangeProof Agent removes the leak. A user proves,
with a Groth16 zero-knowledge proof, that their private number (balance,
score, age, income) lies inside a public range [lo, hi]. Verifiers learn
only that the statement is true — the number itself never leaves the
prover and appears nowhere in the proof or its public signals. Out-of-range
claims are not rejected by policy; they are mathematically unprovable,
because the circuit has no witness for a false statement.

## Build context

RangeProof Agent was designed and built from scratch for the Wildcard
track: an original Circom 2.1.9 circuit (`circuit/rangeproof.circom`) that
bit-checks the private value and both range differences, a locally
generated Groth16 setup (self-generated powers-of-tau, documented as
demo-grade), a dependency-light Node service exposing /health, /ping,
/prove, and /verify, a startup self-test that must pass before the service
accepts traffic, and a 16-check automated test suite covering in-range,
boundary, out-of-range, tampered-signal, and HTTP behavior. One deliberate
design decision: the circuit's numeric bound (all values < 2^31) is
documented in the circuit source, enforced in code, and reported by
/health — comparator-width mismatches between a circuit and real-world
input scales are a real production failure mode, and this agent treats its
bound as part of the interface rather than fine print.

## zkVerify usage

RangeProof produces standard Groth16 (BN128) proofs with an exported
verification key, the exact artifact shape zkVerify is built to attest:
small, cheap-to-verify proofs whose verification can be anchored on-chain
instead of re-checked by every consumer. Eligibility is a natural fit for
that model — one proof, generated once by the user, can be verified by an
airdrop contract, a KYC-lite backend, or any third party against the
public signals [lo, hi], with zkVerify as the shared verification layer.
Verifiable eligibility turns "trust the checker's database" into "check
the proof", which is the property privacy-preserving gating needs to work
across projects instead of inside one silo.
