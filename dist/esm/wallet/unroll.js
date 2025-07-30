import { SigHash, Transaction } from "@scure/btc-signer";
import { ChainTxType } from '../providers/indexer.js';
import { base64, hex } from "@scure/base";
import { VtxoScript } from '../script/base.js';
import { TaprootControlBlock, } from "@scure/btc-signer/psbt";
import { TxWeightEstimator } from '../utils/txSizeEstimator.js';
import { Wallet } from './wallet.js';
export var Unroll;
(function (Unroll) {
    let StepType;
    (function (StepType) {
        StepType[StepType["UNROLL"] = 0] = "UNROLL";
        StepType[StepType["WAIT"] = 1] = "WAIT";
        StepType[StepType["DONE"] = 2] = "DONE";
    })(StepType = Unroll.StepType || (Unroll.StepType = {}));
    /**
     * Manages the unrolling process of a VTXO back to the Bitcoin blockchain.
     *
     * The Session class implements an async iterator that processes the unrolling steps:
     * 1. **WAIT**: Waits for a transaction to be confirmed onchain (if it's in mempool)
     * 2. **UNROLL**: Broadcasts the next transaction in the chain to the blockchain
     * 3. **DONE**: Indicates the unrolling process is complete
     *
     * The unrolling process works by traversing the transaction chain from the root (most recent)
     * to the leaf (oldest), broadcasting each transaction that isn't already onchain.
     *
     * @example
     * ```typescript
     * const session = await Unroll.Session.create(vtxoOutpoint, bumper, explorer, indexer);
     *
     * // iterate over the steps
     * for await (const doneStep of session) {
     *   switch (doneStep.type) {
     *     case Unroll.StepType.WAIT:
     *       console.log(`Transaction ${doneStep.txid} confirmed`);
     *       break;
     *     case Unroll.StepType.UNROLL:
     *       console.log(`Broadcasting transaction ${doneStep.tx.id}`);
     *       break;
     *     case Unroll.StepType.DONE:
     *       console.log(`Unrolling complete for VTXO ${doneStep.vtxoTxid}`);
     *       break;
     *   }
     * }
     * ```
     **/
    class Session {
        constructor(toUnroll, bumper, explorer, indexer) {
            this.toUnroll = toUnroll;
            this.bumper = bumper;
            this.explorer = explorer;
            this.indexer = indexer;
        }
        static async create(toUnroll, bumper, explorer, indexer) {
            const { chain } = await indexer.getVtxoChain(toUnroll);
            return new Session({ ...toUnroll, chain }, bumper, explorer, indexer);
        }
        /**
         * Get the next step to be executed
         * @returns The next step to be executed + the function to execute it
         */
        async next() {
            let nextTxToBroadcast;
            const chain = this.toUnroll.chain;
            // Iterate through the chain from the end (root) to the beginning (leaf)
            for (let i = chain.length - 1; i >= 0; i--) {
                const chainTx = chain[i];
                // Skip commitment transactions as they are always onchain
                if (chainTx.type === ChainTxType.COMMITMENT ||
                    chainTx.type === ChainTxType.UNSPECIFIED) {
                    continue;
                }
                try {
                    // Check if the transaction is confirmed onchain
                    const txInfo = await this.explorer.getTxStatus(chainTx.txid);
                    // If found but not confirmed, it means the tx is in the mempool
                    // An unilateral exit is running, we must wait for it to be confirmed
                    if (!txInfo.confirmed) {
                        return {
                            type: StepType.WAIT,
                            txid: chainTx.txid,
                            do: doWait(this.explorer, chainTx.txid),
                        };
                    }
                }
                catch (e) {
                    // If the tx is not found, it's offchain, let's break
                    nextTxToBroadcast = chainTx;
                    break;
                }
            }
            if (!nextTxToBroadcast) {
                return {
                    type: StepType.DONE,
                    vtxoTxid: this.toUnroll.txid,
                    do: () => Promise.resolve(),
                };
            }
            // Get the virtual transaction data
            const virtualTxs = await this.indexer.getVirtualTxs([
                nextTxToBroadcast.txid,
            ]);
            if (virtualTxs.txs.length === 0) {
                throw new Error(`Tx ${nextTxToBroadcast.txid} not found`);
            }
            const tx = Transaction.fromPSBT(base64.decode(virtualTxs.txs[0]), {
                allowUnknownInputs: true,
            });
            // finalize the tree transaction
            if (nextTxToBroadcast.type === ChainTxType.TREE) {
                const input = tx.getInput(0);
                if (!input) {
                    throw new Error("Input not found");
                }
                const tapKeySig = input.tapKeySig;
                if (!tapKeySig) {
                    throw new Error("Tap key sig not found");
                }
                tx.updateInput(0, {
                    finalScriptWitness: [tapKeySig],
                });
            }
            else {
                // finalize ark transaction
                tx.finalize();
            }
            return {
                type: StepType.UNROLL,
                tx,
                do: doUnroll(this.bumper, this.explorer, tx),
            };
        }
        /**
         * Iterate over the steps to be executed and execute them
         * @returns An async iterator over the executed steps
         */
        async *[Symbol.asyncIterator]() {
            let lastStep;
            do {
                if (lastStep !== undefined) {
                    // wait 1 second before trying the next step in order to give time to the
                    // explorer to update the tx status
                    await sleep(1000);
                }
                const step = await this.next();
                await step.do();
                yield step;
                lastStep = step.type;
            } while (lastStep !== StepType.DONE);
        }
    }
    Unroll.Session = Session;
    /**
     * Complete the unroll of a VTXO by broadcasting the transaction that spends the CSV path.
     * @param wallet the wallet owning the VTXO(s)
     * @param vtxoTxids the txids of the VTXO(s) to complete unroll
     * @param outputAddress the address to send the unrolled funds to
     * @throws if the VTXO(s) are not fully unrolled, if the txids are not found, if the tx is not confirmed, if no exit path is found or not available
     * @returns the txid of the transaction spending the unrolled funds
     */
    async function completeUnroll(wallet, vtxoTxids, outputAddress) {
        const chainTip = await wallet.onchainProvider.getChainTip();
        let vtxos = await wallet.getVtxos({ withUnrolled: true });
        vtxos = vtxos.filter((vtxo) => vtxoTxids.includes(vtxo.txid));
        if (vtxos.length === 0) {
            throw new Error("No vtxos to complete unroll");
        }
        const inputs = [];
        let totalAmount = 0n;
        const txWeightEstimator = TxWeightEstimator.create();
        for (const vtxo of vtxos) {
            if (!vtxo.isUnrolled) {
                throw new Error(`Vtxo ${vtxo.txid}:${vtxo.vout} is not fully unrolled, use unroll first`);
            }
            const txStatus = await wallet.onchainProvider.getTxStatus(vtxo.txid);
            if (!txStatus.confirmed) {
                throw new Error(`tx ${vtxo.txid} is not confirmed`);
            }
            const exit = availableExitPath({ height: txStatus.blockHeight, time: txStatus.blockTime }, chainTip, vtxo);
            if (!exit) {
                throw new Error(`no available exit path found for vtxo ${vtxo.txid}:${vtxo.vout}`);
            }
            const spendingLeaf = VtxoScript.decode(vtxo.tapTree).findLeaf(hex.encode(exit.script));
            if (!spendingLeaf) {
                throw new Error(`spending leaf not found for vtxo ${vtxo.txid}:${vtxo.vout}`);
            }
            totalAmount += BigInt(vtxo.value);
            inputs.push({
                txid: vtxo.txid,
                index: vtxo.vout,
                tapLeafScript: [spendingLeaf],
                sequence: 0xffffffff - 1,
                witnessUtxo: {
                    amount: BigInt(vtxo.value),
                    script: VtxoScript.decode(vtxo.tapTree).pkScript,
                },
                sighashType: SigHash.DEFAULT,
            });
            txWeightEstimator.addTapscriptInput(64, spendingLeaf[1].length, TaprootControlBlock.encode(spendingLeaf[0]).length);
        }
        const tx = new Transaction({ allowUnknownInputs: true, version: 2 });
        for (const input of inputs) {
            tx.addInput(input);
        }
        txWeightEstimator.addP2TROutput();
        let feeRate = await wallet.onchainProvider.getFeeRate();
        if (!feeRate || feeRate < Wallet.MIN_FEE_RATE) {
            feeRate = Wallet.MIN_FEE_RATE;
        }
        const feeAmount = txWeightEstimator.vsize().fee(BigInt(feeRate));
        if (feeAmount > totalAmount) {
            throw new Error("fee amount is greater than the total amount");
        }
        tx.addOutputAddress(outputAddress, totalAmount - feeAmount);
        const signedTx = await wallet.identity.sign(tx);
        signedTx.finalize();
        await wallet.onchainProvider.broadcastTransaction(signedTx.hex);
        return signedTx.id;
    }
    Unroll.completeUnroll = completeUnroll;
})(Unroll || (Unroll = {}));
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function doUnroll(bumper, onchainProvider, tx) {
    return async () => {
        const [parent, child] = await bumper.bumpP2A(tx);
        await onchainProvider.broadcastTransaction(parent, child);
    };
}
function doWait(onchainProvider, txid) {
    return () => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const txInfo = await onchainProvider.getTxStatus(txid);
                    if (txInfo.confirmed) {
                        clearInterval(interval);
                        resolve();
                    }
                }
                catch (e) {
                    clearInterval(interval);
                    reject(e);
                }
            }, 5000);
        });
    };
}
function availableExitPath(confirmedAt, current, vtxo) {
    const exits = VtxoScript.decode(vtxo.tapTree).exitPaths();
    for (const exit of exits) {
        if (exit.params.timelock.type === "blocks") {
            if (current.height >=
                confirmedAt.height + Number(exit.params.timelock.value)) {
                return exit;
            }
        }
        else {
            if (current.time >=
                confirmedAt.time + Number(exit.params.timelock.value)) {
                return exit;
            }
        }
    }
    return undefined;
}
