import { Transaction } from "@scure/btc-signer";
import { VirtualCoin } from "../wallet";
import { EncodedVtxoScript, TapLeafScript } from "../script/base";
import { CSVMultisigTapscript } from "../script/tapscript";
import { TransactionOutput } from "@scure/btc-signer/psbt";
import { Bytes } from "@scure/btc-signer/utils";
export type ArkTxInput = {
    tapLeafScript: TapLeafScript;
    checkpointTapLeafScript?: Bytes;
} & EncodedVtxoScript & Pick<VirtualCoin, "txid" | "vout" | "value">;
export type OffchainTx = {
    arkTx: Transaction;
    checkpoints: Transaction[];
};
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
export declare function buildOffchainTx(inputs: ArkTxInput[], outputs: TransactionOutput[], serverUnrollScript: CSVMultisigTapscript.Type): OffchainTx;
