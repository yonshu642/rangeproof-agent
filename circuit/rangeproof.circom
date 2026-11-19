pragma circom 2.1.9;

/*
 * RangeProof — original circuit for the RangeProof Agent (zkVerify Agent Games, Wildcard track).
 *
 * Statement proven:
 *   "I know a private number `value` such that lo <= value <= hi"
 * where `lo` and `hi` are public, and `value` itself is never revealed.
 *
 * How it works:
 *   The two differences (value - lo) and (hi - value) are forced to be
 *   non-negative by decomposing them into 32 bits with Num2Bits. In the
 *   BN128 scalar field a negative difference wraps around to a huge field
 *   element that cannot fit in 32 bits, so the bit decomposition fails and
 *   no valid witness exists — an out-of-range value simply cannot be proven.
 *   The inputs themselves are also bit-checked (31 bits) so the integer
 *   reading of the statement is exact.
 *
 * IMPORTANT BOUND (lesson learned the hard way from a production circuit):
 *   circomlib comparators / Num2Bits work on fixed bit widths. Every value
 *   here — `value`, `lo`, and `hi` — MUST be < 2^31. Inside that bound the
 *   differences lie in (-2^31, 2^31) and the 32-bit decomposition is an
 *   exact non-negativity proof. Values outside the bound are rejected by
 *   the input bit-checks, never silently mis-proven.
 */

include "circomlib/circuits/bitify.circom";

template RangeProof() {
    // Private input: the secret number. Never appears in public signals.
    signal input value;

    // Public inputs: the eligibility window.
    signal input lo;
    signal input hi;

    // --- Input range checks: value, lo, hi must each be in [0, 2^31). ---
    component valueBits = Num2Bits(31);
    valueBits.in <== value;

    component loBits = Num2Bits(31);
    loBits.in <== lo;

    component hiBits = Num2Bits(31);
    hiBits.in <== hi;

    // --- value >= lo  <=>  (value - lo) is a 32-bit non-negative number. ---
    component diffLoBits = Num2Bits(32);
    diffLoBits.in <== value - lo;

    // --- value <= hi  <=>  (hi - value) is a 32-bit non-negative number. ---
    component diffHiBits = Num2Bits(32);
    diffHiBits.in <== hi - value;
}

component main {public [lo, hi]} = RangeProof();
