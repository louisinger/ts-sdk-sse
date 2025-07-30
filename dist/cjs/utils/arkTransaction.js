"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOffchainTx = buildOffchainTx;
const btc_signer_1 = require("@scure/btc-signer");
const tapscript_1 = require("../script/tapscript");
const base_1 = require("../script/base");
const anchor_1 = require("./anchor");
const base_2 = require("@scure/base");
const utils_1 = require("@scure/btc-signer/utils");
const unknownFields_1 = require("./unknownFields");
/**
 * Builds an offchain transaction with checkpoint transactions.
 *
 * Creates one checkpoint transaction per input and a virtual transaction that
 * combines all the checkpoints, sending to the specified outputs. This is the
 * core function for creating Ark transactions.
 *
 * @param inputs - Array of virtual transaction inputs
 * @param outputs - Array of transaction outputs
 * @param serverUnrollScript - Server unroll script for checkpoint transactions
 * @returns Object containing the virtual transaction and checkpoint transactions
 */
function buildOffchainTx(inputs, outputs, serverUnrollScript) {
    const checkpoints = inputs.map((input) => buildCheckpointTx(input, serverUnrollScript));
    const arkTx = buildVirtualTx(checkpoints.map((c) => c.input), outputs);
    return {
        arkTx,
        checkpoints: checkpoints.map((c) => c.tx),
    };
}
function buildVirtualTx(inputs, outputs) {
    let lockTime = 0n;
    for (const input of inputs) {
        const tapscript = (0, tapscript_1.decodeTapscript)((0, base_1.scriptFromTapLeafScript)(input.tapLeafScript));
        if (tapscript_1.CLTVMultisigTapscript.is(tapscript)) {
            if (lockTime !== 0n) {
                // if a locktime is already set, check if the new locktime is in the same unit
                if (isSeconds(lockTime) !==
                    isSeconds(tapscript.params.absoluteTimelock)) {
                    throw new Error("cannot mix seconds and blocks locktime");
                }
            }
            if (tapscript.params.absoluteTimelock > lockTime) {
                lockTime = tapscript.params.absoluteTimelock;
            }
        }
    }
    const tx = new btc_signer_1.Transaction({
        version: 3,
        allowUnknown: true,
        allowUnknownOutputs: true,
        lockTime: Number(lockTime),
    });
    for (const [i, input] of inputs.entries()) {
        tx.addInput({
            txid: input.txid,
            index: input.vout,
            sequence: lockTime ? btc_signer_1.DEFAULT_SEQUENCE - 1 : undefined,
            witnessUtxo: {
                script: base_1.VtxoScript.decode(input.tapTree).pkScript,
                amount: BigInt(input.value),
            },
            tapLeafScript: [input.tapLeafScript],
        });
        (0, unknownFields_1.setArkPsbtField)(tx, i, unknownFields_1.VtxoTaprootTree, input.tapTree);
    }
    for (const output of outputs) {
        tx.addOutput(output);
    }
    // add the anchor output
    tx.addOutput(anchor_1.P2A);
    return tx;
}
function buildCheckpointTx(vtxo, serverUnrollScript) {
    // create the checkpoint vtxo script from collaborative closure
    const collaborativeClosure = (0, tapscript_1.decodeTapscript)(vtxo.checkpointTapLeafScript ??
        (0, base_1.scriptFromTapLeafScript)(vtxo.tapLeafScript));
    // create the checkpoint vtxo script combining collaborative closure and server unroll script
    const checkpointVtxoScript = new base_1.VtxoScript([
        serverUnrollScript.script,
        collaborativeClosure.script,
    ]);
    // build the checkpoint virtual tx
    const checkpointTx = buildVirtualTx([vtxo], [
        {
            amount: BigInt(vtxo.value),
            script: checkpointVtxoScript.pkScript,
        },
    ]);
    // get the collaborative leaf proof
    const collaborativeLeafProof = checkpointVtxoScript.findLeaf(base_2.hex.encode(collaborativeClosure.script));
    // create the checkpoint input that will be used as input of the virtual tx
    const checkpointInput = {
        txid: base_2.hex.encode((0, utils_1.sha256x2)(checkpointTx.toBytes(true)).reverse()),
        vout: 0,
        value: vtxo.value,
        tapLeafScript: collaborativeLeafProof,
        tapTree: checkpointVtxoScript.encode(),
    };
    return {
        tx: checkpointTx,
        input: checkpointInput,
    };
}
const nLocktimeMinSeconds = 500000000n;
function isSeconds(locktime) {
    return locktime >= nLocktimeMinSeconds;
}
