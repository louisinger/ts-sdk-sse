import { pubSchnorr, randomPrivateKeyBytes } from "@scure/btc-signer/utils";
import { hex } from "@scure/base";
import { SigHash } from "@scure/btc-signer";
import { TreeSignerSession } from '../tree/signingSession.js';
const ZERO_32 = new Uint8Array(32).fill(0);
const ALL_SIGHASH = Object.values(SigHash).filter((x) => typeof x === "number");
/**
 * In-memory single key implementation for Bitcoin transaction signing.
 *
 * @example
 * ```typescript
 * // Create from hex string
 * const key = SingleKey.fromHex('your_private_key_hex');
 *
 * // Create from raw bytes
 * const key = SingleKey.fromPrivateKey(privateKeyBytes);
 *
 * // Sign a transaction
 * const signedTx = await key.sign(transaction);
 * ```
 */
export class SingleKey {
    constructor(key) {
        this.key = key || randomPrivateKeyBytes();
    }
    static fromPrivateKey(privateKey) {
        return new SingleKey(privateKey);
    }
    static fromHex(privateKeyHex) {
        return new SingleKey(hex.decode(privateKeyHex));
    }
    async sign(tx, inputIndexes) {
        const txCpy = tx.clone();
        if (!inputIndexes) {
            try {
                if (!txCpy.sign(this.key, ALL_SIGHASH, ZERO_32)) {
                    throw new Error("Failed to sign transaction");
                }
            }
            catch (e) {
                if (e instanceof Error &&
                    e.message.includes("No inputs signed")) {
                    // ignore
                }
                else {
                    throw e;
                }
            }
            return txCpy;
        }
        for (const inputIndex of inputIndexes) {
            if (!txCpy.signIdx(this.key, inputIndex, ALL_SIGHASH, ZERO_32)) {
                throw new Error(`Failed to sign input #${inputIndex}`);
            }
        }
        return txCpy;
    }
    xOnlyPublicKey() {
        return pubSchnorr(this.key);
    }
    signerSession() {
        return TreeSignerSession.random();
    }
}
