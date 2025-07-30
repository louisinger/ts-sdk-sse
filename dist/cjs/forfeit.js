"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildForfeitTx = buildForfeitTx;
const btc_signer_1 = require("@scure/btc-signer");
const anchor_1 = require("./utils/anchor");
function buildForfeitTx(inputs, forfeitPkScript, txLocktime) {
    const tx = new btc_signer_1.Transaction({
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
    tx.addOutput(anchor_1.P2A);
    return tx;
}
