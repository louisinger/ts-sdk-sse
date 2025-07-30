"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleKey = void 0;
const utils_1 = require("@scure/btc-signer/utils");
const base_1 = require("@scure/base");
const btc_signer_1 = require("@scure/btc-signer");
const signingSession_1 = require("../tree/signingSession");
const ZERO_32 = new Uint8Array(32).fill(0);
const ALL_SIGHASH = Object.values(btc_signer_1.SigHash).filter((x) => typeof x === "number");
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
class SingleKey {
    constructor(key) {
        this.key = key || (0, utils_1.randomPrivateKeyBytes)();
    }
    static fromPrivateKey(privateKey) {
        return new SingleKey(privateKey);
    }
    static fromHex(privateKeyHex) {
        return new SingleKey(base_1.hex.decode(privateKeyHex));
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
        return (0, utils_1.pubSchnorr)(this.key);
    }
    signerSession() {
        return signingSession_1.TreeSignerSession.random();
    }
}
exports.SingleKey = SingleKey;
