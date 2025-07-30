import { Transaction } from "@scure/btc-signer";
import { Identity } from ".";
import { SignerSession } from "../tree/signingSession";
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
export declare class SingleKey implements Identity {
    private key;
    private constructor();
    static fromPrivateKey(privateKey: Uint8Array): SingleKey;
    static fromHex(privateKeyHex: string): SingleKey;
    sign(tx: Transaction, inputIndexes?: number[]): Promise<Transaction>;
    xOnlyPublicKey(): Uint8Array;
    signerSession(): SignerSession;
}
