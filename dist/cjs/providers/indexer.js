"use strict";
// if (globalThis.EventSource === undefined) {
//     const { EventSource } = require("eventsource");
//     globalThis.EventSource = EventSource;
// }
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestIndexerProvider = exports.ChainTxType = exports.IndexerTxType = void 0;
const ark_1 = require("./ark");
const utils_1 = require("./utils");
var IndexerTxType;
(function (IndexerTxType) {
    IndexerTxType[IndexerTxType["INDEXER_TX_TYPE_UNSPECIFIED"] = 0] = "INDEXER_TX_TYPE_UNSPECIFIED";
    IndexerTxType[IndexerTxType["INDEXER_TX_TYPE_RECEIVED"] = 1] = "INDEXER_TX_TYPE_RECEIVED";
    IndexerTxType[IndexerTxType["INDEXER_TX_TYPE_SENT"] = 2] = "INDEXER_TX_TYPE_SENT";
})(IndexerTxType || (exports.IndexerTxType = IndexerTxType = {}));
var ChainTxType;
(function (ChainTxType) {
    ChainTxType["UNSPECIFIED"] = "INDEXER_CHAINED_TX_TYPE_UNSPECIFIED";
    ChainTxType["COMMITMENT"] = "INDEXER_CHAINED_TX_TYPE_COMMITMENT";
    ChainTxType["ARK"] = "INDEXER_CHAINED_TX_TYPE_ARK";
    ChainTxType["TREE"] = "INDEXER_CHAINED_TX_TYPE_TREE";
    ChainTxType["CHECKPOINT"] = "INDEXER_CHAINED_TX_TYPE_CHECKPOINT";
})(ChainTxType || (exports.ChainTxType = ChainTxType = {}));
/**
 * REST-based Indexer provider implementation.
 * @see https://buf.build/arkade-os/arkd/docs/main:ark.v1#ark.v1.IndexerService
 * @example
 * ```typescript
 * const provider = new RestIndexerProvider('https://ark.indexer.example.com');
 * const commitmentTx = await provider.getCommitmentTx("6686af8f3be3517880821f62e6c3d749b9d6713736a1d8e229a55daa659446b2");
 * ```
 */
class RestIndexerProvider {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    async getVtxoTree(batchOutpoint, opts) {
        let url = `${this.serverUrl}/v1/indexer/batch/${batchOutpoint.txid}/${batchOutpoint.vout}/tree`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch vtxo tree: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isVtxoTreeResponse(data)) {
            throw new Error("Invalid vtxo tree data received");
        }
        data.vtxoTree.forEach((tx) => {
            tx.children = Object.fromEntries(Object.entries(tx.children).map(([key, value]) => [
                Number(key),
                value,
            ]));
        });
        return data;
    }
    async getVtxoTreeLeaves(batchOutpoint, opts) {
        let url = `${this.serverUrl}/v1/indexer/batch/${batchOutpoint.txid}/${batchOutpoint.vout}/tree/leaves`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch vtxo tree leaves: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isVtxoTreeLeavesResponse(data)) {
            throw new Error("Invalid vtxos tree leaves data received");
        }
        return data;
    }
    async getBatchSweepTransactions(batchOutpoint) {
        const url = `${this.serverUrl}/v1/indexer/batch/${batchOutpoint.txid}/${batchOutpoint.vout}/sweepTxs`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch batch sweep transactions: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isBatchSweepTransactionsResponse(data)) {
            throw new Error("Invalid batch sweep transactions data received");
        }
        return data;
    }
    async getCommitmentTx(txid) {
        const url = `${this.serverUrl}/v1/indexer/commitmentTx/${txid}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch commitment tx: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isCommitmentTx(data)) {
            throw new Error("Invalid commitment tx data received");
        }
        return data;
    }
    async getCommitmentTxConnectors(txid, opts) {
        let url = `${this.serverUrl}/v1/indexer/commitmentTx/${txid}/connectors`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch commitment tx connectors: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isConnectorsResponse(data)) {
            throw new Error("Invalid commitment tx connectors data received");
        }
        data.connectors.forEach((tx) => {
            tx.children = Object.fromEntries(Object.entries(tx.children).map(([key, value]) => [
                Number(key),
                value,
            ]));
        });
        return data;
    }
    async getCommitmentTxForfeitTxs(txid, opts) {
        let url = `${this.serverUrl}/v1/indexer/commitmentTx/${txid}/forfeitTxs`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch commitment tx forfeitTxs: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isForfeitTxsResponse(data)) {
            throw new Error("Invalid commitment tx forfeitTxs data received");
        }
        return data;
    }
    async *getSubscription(subscriptionId, abortSignal) {
        const url = `${this.serverUrl}/v1/indexer/script/subscription/${subscriptionId}`;
        while (!abortSignal?.aborted) {
            try {
                const eventSource = new EventSource(url);
                // Set up abort handling
                const abortHandler = () => {
                    eventSource.close();
                };
                abortSignal?.addEventListener("abort", abortHandler);
                try {
                    for await (const event of (0, utils_1.eventSourceIterator)(eventSource)) {
                        if (abortSignal?.aborted)
                            break;
                        try {
                            const data = JSON.parse(event.data);
                            if (data.event) {
                                yield {
                                    txid: data.event.txid,
                                    scripts: data.event.scripts || [],
                                    newVtxos: (data.event.newVtxos || []).map(convertVtxo),
                                    spentVtxos: (data.event.spentVtxos || []).map(convertVtxo),
                                    tx: data.event.tx,
                                    checkpointTxs: data.event.checkpointTxs,
                                };
                            }
                        }
                        catch (err) {
                            console.error("Failed to parse subscription event:", err);
                            throw err;
                        }
                    }
                }
                finally {
                    abortSignal?.removeEventListener("abort", abortHandler);
                    eventSource.close();
                }
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    break;
                }
                // ignore timeout errors, they're expected when the server is not sending anything for 5 min
                if ((0, ark_1.isFetchTimeoutError)(error)) {
                    console.debug("Timeout error ignored");
                    continue;
                }
                console.error("Subscription error:", error);
                throw error;
            }
        }
    }
    async getVirtualTxs(txids, opts) {
        let url = `${this.serverUrl}/v1/indexer/virtualTx/${txids.join(",")}`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch virtual txs: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isVirtualTxsResponse(data)) {
            throw new Error("Invalid virtual txs data received");
        }
        return data;
    }
    async getVtxoChain(vtxoOutpoint, opts) {
        let url = `${this.serverUrl}/v1/indexer/vtxo/${vtxoOutpoint.txid}/${vtxoOutpoint.vout}/chain`;
        const params = new URLSearchParams();
        if (opts) {
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch vtxo chain: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isVtxoChainResponse(data)) {
            throw new Error("Invalid vtxo chain data received");
        }
        return data;
    }
    async getVtxos(opts) {
        // scripts and outpoints are mutually exclusive
        if (opts?.scripts && opts?.outpoints) {
            throw new Error("scripts and outpoints are mutually exclusive options");
        }
        if (!opts?.scripts && !opts?.outpoints) {
            throw new Error("Either scripts or outpoints must be provided");
        }
        let url = `${this.serverUrl}/v1/indexer/vtxos`;
        const params = new URLSearchParams();
        // Handle scripts with multi collection format
        if (opts?.scripts && opts.scripts.length > 0) {
            opts.scripts.forEach((script) => {
                params.append("scripts", script);
            });
        }
        // Handle outpoints with multi collection format
        if (opts?.outpoints && opts.outpoints.length > 0) {
            opts.outpoints.forEach((outpoint) => {
                params.append("outpoints", `${outpoint.txid}:${outpoint.vout}`);
            });
        }
        if (opts) {
            if (opts.spendableOnly !== undefined)
                params.append("spendableOnly", opts.spendableOnly.toString());
            if (opts.spentOnly !== undefined)
                params.append("spentOnly", opts.spentOnly.toString());
            if (opts.recoverableOnly !== undefined)
                params.append("recoverableOnly", opts.recoverableOnly.toString());
            if (opts.pageIndex !== undefined)
                params.append("page.index", opts.pageIndex.toString());
            if (opts.pageSize !== undefined)
                params.append("page.size", opts.pageSize.toString());
        }
        if (params.toString()) {
            url += "?" + params.toString();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch vtxos: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Response.isVtxosResponse(data)) {
            throw new Error("Invalid vtxos data received");
        }
        return {
            vtxos: data.vtxos.map(convertVtxo),
            page: data.page,
        };
    }
    async subscribeForScripts(scripts, subscriptionId) {
        const url = `${this.serverUrl}/v1/indexer/script/subscribe`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ scripts, subscriptionId }),
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to subscribe to scripts: ${errorText}`);
        }
        const data = await res.json();
        if (!data.subscriptionId)
            throw new Error(`Subscription ID not found`);
        return data.subscriptionId;
    }
    async unsubscribeForScripts(subscriptionId, scripts) {
        const url = `${this.serverUrl}/v1/indexer/script/unsubscribe`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ subscriptionId, scripts }),
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to unsubscribe to scripts: ${errorText}`);
        }
    }
}
exports.RestIndexerProvider = RestIndexerProvider;
function convertVtxo(vtxo) {
    return {
        txid: vtxo.outpoint.txid,
        vout: vtxo.outpoint.vout,
        value: Number(vtxo.amount),
        status: {
            confirmed: !vtxo.isSwept && !vtxo.isPreconfirmed,
        },
        virtualStatus: {
            state: vtxo.isSwept
                ? "swept"
                : vtxo.isPreconfirmed
                    ? "preconfirmed"
                    : "settled",
            commitmentTxIds: vtxo.commitmentTxids,
            batchExpiry: vtxo.expiresAt
                ? Number(vtxo.expiresAt) * 1000
                : undefined,
        },
        spentBy: vtxo.spentBy ?? "",
        settledBy: vtxo.settledBy,
        arkTxId: vtxo.arkTxid,
        createdAt: new Date(Number(vtxo.createdAt) * 1000),
        isUnrolled: vtxo.isUnrolled,
    };
}
// Unexported namespace for type guards only
var Response;
(function (Response) {
    function isBatch(data) {
        return (typeof data === "object" &&
            typeof data.totalOutputAmount === "string" &&
            typeof data.totalOutputVtxos === "number" &&
            typeof data.expiresAt === "string" &&
            typeof data.swept === "boolean");
    }
    function isChain(data) {
        return (typeof data === "object" &&
            typeof data.txid === "string" &&
            typeof data.expiresAt === "string" &&
            Object.values(ChainTxType).includes(data.type) &&
            Array.isArray(data.spends) &&
            data.spends.every((spend) => typeof spend === "string"));
    }
    function isCommitmentTx(data) {
        return (typeof data === "object" &&
            typeof data.startedAt === "string" &&
            typeof data.endedAt === "string" &&
            typeof data.totalInputAmount === "string" &&
            typeof data.totalInputVtxos === "number" &&
            typeof data.totalOutputAmount === "string" &&
            typeof data.totalOutputVtxos === "number" &&
            typeof data.batches === "object" &&
            Object.values(data.batches).every(isBatch));
    }
    Response.isCommitmentTx = isCommitmentTx;
    function isOutpoint(data) {
        return (typeof data === "object" &&
            typeof data.txid === "string" &&
            typeof data.vout === "number");
    }
    Response.isOutpoint = isOutpoint;
    function isOutpointArray(data) {
        return Array.isArray(data) && data.every(isOutpoint);
    }
    Response.isOutpointArray = isOutpointArray;
    function isTx(data) {
        return (typeof data === "object" &&
            typeof data.txid === "string" &&
            typeof data.children === "object" &&
            Object.values(data.children).every(isTxid) &&
            Object.keys(data.children).every((k) => Number.isInteger(Number(k))));
    }
    function isTxsArray(data) {
        return Array.isArray(data) && data.every(isTx);
    }
    Response.isTxsArray = isTxsArray;
    function isTxHistoryRecord(data) {
        return (typeof data === "object" &&
            typeof data.amount === "string" &&
            typeof data.createdAt === "string" &&
            typeof data.isSettled === "boolean" &&
            typeof data.settledBy === "string" &&
            Object.values(IndexerTxType).includes(data.type) &&
            ((!data.commitmentTxid && typeof data.virtualTxid === "string") ||
                (typeof data.commitmentTxid === "string" && !data.virtualTxid)));
    }
    function isTxHistoryRecordArray(data) {
        return Array.isArray(data) && data.every(isTxHistoryRecord);
    }
    Response.isTxHistoryRecordArray = isTxHistoryRecordArray;
    function isTxid(data) {
        return typeof data === "string" && data.length === 64;
    }
    function isTxidArray(data) {
        return Array.isArray(data) && data.every(isTxid);
    }
    Response.isTxidArray = isTxidArray;
    function isVtxo(data) {
        return (typeof data === "object" &&
            isOutpoint(data.outpoint) &&
            typeof data.createdAt === "string" &&
            (data.expiresAt === null || typeof data.expiresAt === "string") &&
            typeof data.amount === "string" &&
            typeof data.script === "string" &&
            typeof data.isPreconfirmed === "boolean" &&
            typeof data.isSwept === "boolean" &&
            typeof data.isUnrolled === "boolean" &&
            typeof data.isSpent === "boolean" &&
            (!data.spentBy || typeof data.spentBy === "string") &&
            (!data.settledBy || typeof data.settledBy === "string") &&
            (!data.arkTxid || typeof data.arkTxid === "string") &&
            Array.isArray(data.commitmentTxids) &&
            data.commitmentTxids.every(isTxid));
    }
    function isPageResponse(data) {
        return (typeof data === "object" &&
            typeof data.current === "number" &&
            typeof data.next === "number" &&
            typeof data.total === "number");
    }
    function isVtxoTreeResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.vtxoTree) &&
            data.vtxoTree.every(isTx) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isVtxoTreeResponse = isVtxoTreeResponse;
    function isVtxoTreeLeavesResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.leaves) &&
            data.leaves.every(isOutpoint) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isVtxoTreeLeavesResponse = isVtxoTreeLeavesResponse;
    function isConnectorsResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.connectors) &&
            data.connectors.every(isTx) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isConnectorsResponse = isConnectorsResponse;
    function isForfeitTxsResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.txids) &&
            data.txids.every(isTxid) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isForfeitTxsResponse = isForfeitTxsResponse;
    function isSweptCommitmentTxResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.sweptBy) &&
            data.sweptBy.every(isTxid));
    }
    Response.isSweptCommitmentTxResponse = isSweptCommitmentTxResponse;
    function isBatchSweepTransactionsResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.sweptBy) &&
            data.sweptBy.every(isTxid));
    }
    Response.isBatchSweepTransactionsResponse = isBatchSweepTransactionsResponse;
    function isVirtualTxsResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.txs) &&
            data.txs.every((tx) => typeof tx === "string") &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isVirtualTxsResponse = isVirtualTxsResponse;
    function isVtxoChainResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.chain) &&
            data.chain.every(isChain) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isVtxoChainResponse = isVtxoChainResponse;
    function isVtxosResponse(data) {
        return (typeof data === "object" &&
            Array.isArray(data.vtxos) &&
            data.vtxos.every(isVtxo) &&
            (!data.page || isPageResponse(data.page)));
    }
    Response.isVtxosResponse = isVtxosResponse;
})(Response || (Response = {}));
