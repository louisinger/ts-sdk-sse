import { hex } from "@scure/base";
export const ANCHOR_VALUE = 0n;
export const ANCHOR_PKSCRIPT = new Uint8Array([0x51, 0x02, 0x4e, 0x73]);
/**
 * A zero-value anchor output.
 */
export const P2A = {
    script: ANCHOR_PKSCRIPT,
    amount: ANCHOR_VALUE,
};
const hexP2Ascript = hex.encode(P2A.script);
/**
 * search for anchor in the given transaction.
 * @throws {Error} if the anchor is not found or has the wrong amount
 */
export function findP2AOutput(tx) {
    for (let i = 0; i < tx.outputsLength; i++) {
        const output = tx.getOutput(i);
        if (output.script && hex.encode(output.script) === hexP2Ascript) {
            if (output.amount !== P2A.amount) {
                throw new Error(`P2A output has wrong amount, expected ${P2A.amount} got ${output.amount}`);
            }
            return {
                txid: tx.id,
                index: i,
                witnessUtxo: P2A,
            };
        }
    }
    throw new Error("P2A output not found");
}
