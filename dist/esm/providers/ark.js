// if (globalThis.EventSource === undefined) {
//     const { EventSource } = require("eventsource");
//     globalThis.EventSource = EventSource;
// }
import { hex } from "@scure/base";
import { eventSourceIterator } from './utils.js';
export var SettlementEventType;
(function (SettlementEventType) {
    SettlementEventType["BatchStarted"] = "batch_started";
    SettlementEventType["BatchFinalization"] = "batch_finalization";
    SettlementEventType["BatchFinalized"] = "batch_finalized";
    SettlementEventType["BatchFailed"] = "batch_failed";
    SettlementEventType["TreeSigningStarted"] = "tree_signing_started";
    SettlementEventType["TreeNoncesAggregated"] = "tree_nonces_aggregated";
    SettlementEventType["TreeTx"] = "tree_tx";
    SettlementEventType["TreeSignature"] = "tree_signature";
})(SettlementEventType || (SettlementEventType = {}));
/**
 * REST-based Ark provider implementation.
 * @see https://buf.build/arkade-os/arkd/docs/main:ark.v1#ark.v1.ArkService
 * @example
 * ```typescript
 * const provider = new RestArkProvider('https://ark.example.com');
 * const info = await provider.getInfo();
 * ```
 */
export class RestArkProvider {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    async getInfo() {
        const url = `${this.serverUrl}/v1/info`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to get server info: ${response.statusText}`);
        }
        const fromServer = await response.json();
        return {
            ...fromServer,
            vtxoTreeExpiry: BigInt(fromServer.vtxoTreeExpiry ?? 0),
            unilateralExitDelay: BigInt(fromServer.unilateralExitDelay ?? 0),
            roundInterval: BigInt(fromServer.roundInterval ?? 0),
            dust: BigInt(fromServer.dust ?? 0),
            utxoMinAmount: BigInt(fromServer.utxoMinAmount ?? 0),
            utxoMaxAmount: BigInt(fromServer.utxoMaxAmount ?? -1),
            vtxoMinAmount: BigInt(fromServer.vtxoMinAmount ?? 0),
            vtxoMaxAmount: BigInt(fromServer.vtxoMaxAmount ?? -1),
            boardingExitDelay: BigInt(fromServer.boardingExitDelay ?? 0),
            marketHour: "marketHour" in fromServer && fromServer.marketHour != null
                ? {
                    nextStartTime: BigInt(fromServer.marketHour.nextStartTime ?? 0),
                    nextEndTime: BigInt(fromServer.marketHour.nextEndTime ?? 0),
                    period: BigInt(fromServer.marketHour.period ?? 0),
                    roundInterval: BigInt(fromServer.marketHour.roundInterval ?? 0),
                }
                : undefined,
        };
    }
    async submitTx(signedArkTx, checkpointTxs) {
        const url = `${this.serverUrl}/v1/tx/submit`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                signedArkTx: signedArkTx,
                checkpointTxs: checkpointTxs,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            try {
                const grpcError = JSON.parse(errorText);
                // gRPC errors usually have a message and code field
                throw new Error(`Failed to submit virtual transaction: ${grpcError.message || grpcError.error || errorText}`);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            }
            catch (_) {
                // If JSON parse fails, use the raw error text
                throw new Error(`Failed to submit virtual transaction: ${errorText}`);
            }
        }
        const data = await response.json();
        return {
            arkTxid: data.arkTxid,
            finalArkTx: data.finalArkTx,
            signedCheckpointTxs: data.signedCheckpointTxs,
        };
    }
    async finalizeTx(arkTxid, finalCheckpointTxs) {
        const url = `${this.serverUrl}/v1/tx/finalize`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                arkTxid,
                finalCheckpointTxs,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to finalize offchain transaction: ${errorText}`);
        }
    }
    async registerIntent(intent) {
        const url = `${this.serverUrl}/v1/batch/registerIntent`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                intent: {
                    signature: intent.signature,
                    message: intent.message,
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to register intent: ${errorText}`);
        }
        const data = await response.json();
        return data.intentId;
    }
    async deleteIntent(intent) {
        const url = `${this.serverUrl}/v1/batch/deleteIntent`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                proof: {
                    signature: intent.signature,
                    message: intent.message,
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete intent: ${errorText}`);
        }
    }
    async confirmRegistration(intentId) {
        const url = `${this.serverUrl}/v1/batch/ack`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                intentId,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to confirm registration: ${errorText}`);
        }
    }
    async submitTreeNonces(batchId, pubkey, nonces) {
        const url = `${this.serverUrl}/v1/batch/tree/submitNonces`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                batchId,
                pubkey,
                treeNonces: encodeMusig2Nonces(nonces),
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to submit tree nonces: ${errorText}`);
        }
    }
    async submitTreeSignatures(batchId, pubkey, signatures) {
        const url = `${this.serverUrl}/v1/batch/tree/submitSignatures`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                batchId,
                pubkey,
                treeSignatures: encodeMusig2Signatures(signatures),
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to submit tree signatures: ${errorText}`);
        }
    }
    async submitSignedForfeitTxs(signedForfeitTxs, signedCommitmentTx) {
        const url = `${this.serverUrl}/v1/batch/submitForfeitTxs`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                signedForfeitTxs: signedForfeitTxs,
                signedCommitmentTx: signedCommitmentTx,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to submit forfeit transactions: ${response.statusText}`);
        }
    }
    async *getEventStream(signal, topics) {
        const url = `${this.serverUrl}/v1/batch/events`;
        const queryParams = topics.length > 0
            ? `?${topics.map((topic) => `topics=${encodeURIComponent(topic)}`).join("&")}`
            : "";
        while (!signal?.aborted) {
            try {
                const eventSource = new EventSource(url + queryParams);
                // Set up abort handling
                const abortHandler = () => {
                    eventSource.close();
                };
                signal?.addEventListener("abort", abortHandler);
                try {
                    for await (const event of eventSourceIterator(eventSource)) {
                        if (signal?.aborted)
                            break;
                        try {
                            const data = JSON.parse(event.data);
                            const settlementEvent = this.parseSettlementEvent(data);
                            if (settlementEvent) {
                                yield settlementEvent;
                            }
                        }
                        catch (err) {
                            console.error("Failed to parse event:", err);
                            throw err;
                        }
                    }
                }
                finally {
                    signal?.removeEventListener("abort", abortHandler);
                    eventSource.close();
                }
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    break;
                }
                // ignore timeout errors, they're expected when the server is not sending anything for 5 min
                if (isFetchTimeoutError(error)) {
                    console.debug("Timeout error ignored");
                    continue;
                }
                console.error("Event stream error:", error);
                throw error;
            }
        }
    }
    async *getTransactionsStream(signal) {
        const url = `${this.serverUrl}/v1/txs`;
        while (!signal?.aborted) {
            try {
                const eventSource = new EventSource(url);
                // Set up abort handling
                const abortHandler = () => {
                    eventSource.close();
                };
                signal?.addEventListener("abort", abortHandler);
                try {
                    for await (const event of eventSourceIterator(eventSource)) {
                        if (signal?.aborted)
                            break;
                        try {
                            const data = JSON.parse(event.data);
                            const txNotification = this.parseTransactionNotification(data);
                            if (txNotification) {
                                yield txNotification;
                            }
                        }
                        catch (err) {
                            console.error("Failed to parse transaction notification:", err);
                            throw err;
                        }
                    }
                }
                finally {
                    signal?.removeEventListener("abort", abortHandler);
                    eventSource.close();
                }
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    break;
                }
                // ignore timeout errors, they're expected when the server is not sending anything for 5 min
                if (isFetchTimeoutError(error)) {
                    console.debug("Timeout error ignored");
                    continue;
                }
                console.error("Transaction stream error:", error);
                throw error;
            }
        }
    }
    parseSettlementEvent(data) {
        // Check for BatchStarted event
        if (data.batchStarted) {
            return {
                type: SettlementEventType.BatchStarted,
                id: data.batchStarted.id,
                intentIdHashes: data.batchStarted.intentIdHashes,
                batchExpiry: BigInt(data.batchStarted.batchExpiry),
            };
        }
        // Check for BatchFinalization event
        if (data.batchFinalization) {
            return {
                type: SettlementEventType.BatchFinalization,
                id: data.batchFinalization.id,
                commitmentTx: data.batchFinalization.commitmentTx,
            };
        }
        // Check for BatchFinalized event
        if (data.batchFinalized) {
            return {
                type: SettlementEventType.BatchFinalized,
                id: data.batchFinalized.id,
                commitmentTxid: data.batchFinalized.commitmentTxid,
            };
        }
        // Check for BatchFailed event
        if (data.batchFailed) {
            return {
                type: SettlementEventType.BatchFailed,
                id: data.batchFailed.id,
                reason: data.batchFailed.reason,
            };
        }
        // Check for TreeSigningStarted event
        if (data.treeSigningStarted) {
            return {
                type: SettlementEventType.TreeSigningStarted,
                id: data.treeSigningStarted.id,
                cosignersPublicKeys: data.treeSigningStarted.cosignersPubkeys,
                unsignedCommitmentTx: data.treeSigningStarted.unsignedCommitmentTx,
            };
        }
        // Check for TreeNoncesAggregated event
        if (data.treeNoncesAggregated) {
            return {
                type: SettlementEventType.TreeNoncesAggregated,
                id: data.treeNoncesAggregated.id,
                treeNonces: decodeMusig2Nonces(data.treeNoncesAggregated.treeNonces),
            };
        }
        // Check for TreeTx event
        if (data.treeTx) {
            const children = Object.fromEntries(Object.entries(data.treeTx.children).map(([outputIndex, txid]) => {
                return [parseInt(outputIndex), txid];
            }));
            return {
                type: SettlementEventType.TreeTx,
                id: data.treeTx.id,
                topic: data.treeTx.topic,
                batchIndex: data.treeTx.batchIndex,
                chunk: {
                    txid: data.treeTx.txid,
                    tx: data.treeTx.tx,
                    children,
                },
            };
        }
        if (data.treeSignature) {
            return {
                type: SettlementEventType.TreeSignature,
                id: data.treeSignature.id,
                topic: data.treeSignature.topic,
                batchIndex: data.treeSignature.batchIndex,
                txid: data.treeSignature.txid,
                signature: data.treeSignature.signature,
            };
        }
        // Skip heartbeat events
        if (data.heartbeat) {
            return null;
        }
        console.warn("Unknown event type:", data);
        return null;
    }
    parseTransactionNotification(data) {
        if (data.commitmentTx) {
            return {
                commitmentTx: {
                    txid: data.commitmentTx.txid,
                    tx: data.commitmentTx.tx,
                    spentVtxos: data.commitmentTx.spentVtxos.map(mapVtxo),
                    spendableVtxos: data.commitmentTx.spendableVtxos.map(mapVtxo),
                    checkpointTxs: data.commitmentTx.checkpointTxs,
                },
            };
        }
        if (data.arkTx) {
            return {
                arkTx: {
                    txid: data.arkTx.txid,
                    tx: data.arkTx.tx,
                    spentVtxos: data.arkTx.spentVtxos.map(mapVtxo),
                    spendableVtxos: data.arkTx.spendableVtxos.map(mapVtxo),
                    checkpointTxs: data.arkTx.checkpointTxs,
                },
            };
        }
        // Skip heartbeat events
        if (data.heartbeat) {
            return null;
        }
        console.warn("Unknown transaction notification type:", data);
        return null;
    }
}
function encodeMusig2Nonces(nonces) {
    const noncesObject = {};
    for (const [txid, nonce] of nonces) {
        noncesObject[txid] = hex.encode(nonce.pubNonce);
    }
    return JSON.stringify(noncesObject);
}
function encodeMusig2Signatures(signatures) {
    const sigObject = {};
    for (const [txid, sig] of signatures) {
        sigObject[txid] = hex.encode(sig.encode());
    }
    return JSON.stringify(sigObject);
}
function decodeMusig2Nonces(str) {
    const noncesObject = JSON.parse(str);
    return new Map(Object.entries(noncesObject).map(([txid, nonce]) => {
        if (typeof nonce !== "string") {
            throw new Error("invalid nonce");
        }
        return [txid, { pubNonce: hex.decode(nonce) }];
    }));
}
export function isFetchTimeoutError(err) {
    const checkError = (error) => {
        if (!(error instanceof Error))
            return false;
        // TODO: get something more robust than this
        const isCloudflare524 = error.name === "TypeError" && error.message === "Failed to fetch";
        return (isCloudflare524 ||
            error.name === "HeadersTimeoutError" ||
            error.name === "BodyTimeoutError" ||
            error.code === "UND_ERR_HEADERS_TIMEOUT" ||
            error.code === "UND_ERR_BODY_TIMEOUT");
    };
    return checkError(err) || checkError(err.cause);
}
function mapVtxo(vtxo) {
    return {
        outpoint: {
            txid: vtxo.outpoint.txid,
            vout: vtxo.outpoint.vout,
        },
        amount: vtxo.amount,
        script: vtxo.script,
        createdAt: vtxo.createdAt,
        expiresAt: vtxo.expiresAt,
        commitmentTxids: vtxo.commitmentTxids,
        isPreconfirmed: vtxo.isPreconfirmed,
        isSwept: vtxo.isSwept,
        isUnrolled: vtxo.isUnrolled,
        isSpent: vtxo.isSpent,
        spentBy: vtxo.spentBy,
        settledBy: vtxo.settledBy,
        arkTxid: vtxo.arkTxid,
    };
}
