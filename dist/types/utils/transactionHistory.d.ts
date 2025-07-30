import { ArkTransaction, VirtualCoin } from "../wallet";
/**
 * @param spendable - Vtxos that are spendable
 * @param spent - Vtxos that are spent
 * @param boardingBatchTxids - Set of boarding batch txids
 * @returns Ark transactions
 */
export declare function vtxosToTxs(spendable: VirtualCoin[], spent: VirtualCoin[], boardingBatchTxids: Set<string>): ArkTransaction[];
