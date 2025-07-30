import { Transaction } from "@scure/btc-signer";
import { SignerSession } from "../tree/signingSession";
export interface Identity {
    sign(tx: Transaction, inputIndexes?: number[]): Promise<Transaction>;
    xOnlyPublicKey(): Uint8Array;
    signerSession(): SignerSession;
}
