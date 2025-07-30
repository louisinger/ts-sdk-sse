import { Transaction } from "@scure/btc-signer";
import { P2A } from './utils/anchor.js';
export function buildForfeitTx(inputs, forfeitPkScript, txLocktime) {
    const tx = new Transaction({
        version: 3,
        lockTime: txLocktime,
    });
    let amount = 0n;
    for (const input of inputs) {
        if (!input.witnessUtxo) {
            throw new Error("input needs witness utxo");
        }
        amount += input.witnessUtxo.amount;
        tx.addInput(input);
    }
    // Add main output to server
    tx.addOutput({
        script: forfeitPkScript,
        amount,
    });
    // Add P2A output
    tx.addOutput(P2A);
    return tx;
}
