import { Transaction } from "@scure/btc-signer";
import { TransactionInput, TransactionOutput } from "@scure/btc-signer/psbt";
/**
 * BIP-322 signature implementation for Bitcoin message signing.
 *
 * BIP-322 defines a standard for signing Bitcoin messages as well as proving
 * ownership of coins. This namespace provides utilities for creating and
 * validating BIP-322.
 *
 * @see https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
 *
 * @example
 * ```typescript
 * // Create a BIP-322 proof
 * const proof = BIP322.create(
 *   "Hello Bitcoin!",
 *   [input],
 *   [output]
 * );
 *
 * // Sign the proof
 * const signedProof = await identity.sign(proof);
 *
 * // Extract the signature
 * const signature = BIP322.signature(signedProof);
 * ```
 */
export declare namespace BIP322 {
    type FullProof = Transaction;
    type Signature = string;
    /**
     * Creates a new BIP-322 "full" proof of funds unsigned transaction.
     *
     * This function constructs a special transaction that can be signed to prove
     * ownership of VTXOs and UTXOs. The proof includes the message to be
     * signed and the inputs/outputs that demonstrate ownership.
     *
     * @param message - The BIP-322 message to be signed
     * @param inputs - Array of transaction inputs to prove ownership of
     * @param outputs - Optional array of transaction outputs
     * @returns An unsigned BIP-322 proof transaction
     */
    function create(message: string, inputs: TransactionInput[], outputs?: TransactionOutput[]): FullProof;
    /**
     * Finalizes and extracts the FullProof transaction into a BIP-322 signature.
     *
     * This function takes a signed proof transaction and converts it into a
     * base64-encoded signature string. If the proof's inputs have special
     * spending conditions, a custom finalizer can be provided.
     *
     * @param signedProof - The signed BIP-322 proof transaction
     * @param finalizer - Optional custom finalizer function
     * @returns Base64-encoded BIP-322 signature
     */
    function signature(signedProof: FullProof, finalizer?: (tx: FullProof) => void): Signature;
}
export declare function craftToSpendTx(message: string, pkScript: Uint8Array): Transaction;
