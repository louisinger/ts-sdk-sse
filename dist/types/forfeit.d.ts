import { Transaction } from "@scure/btc-signer";
import { TransactionInputUpdate } from "@scure/btc-signer/psbt";
export declare function buildForfeitTx(inputs: TransactionInputUpdate[], forfeitPkScript: Uint8Array, txLocktime?: number): Transaction;
