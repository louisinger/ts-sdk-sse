import { Outpoint, VirtualCoin } from "../wallet";
export type PaginationOptions = {
    pageIndex?: number;
    pageSize?: number;
};
export declare enum IndexerTxType {
    INDEXER_TX_TYPE_UNSPECIFIED = 0,
    INDEXER_TX_TYPE_RECEIVED = 1,
    INDEXER_TX_TYPE_SENT = 2
}
export declare enum ChainTxType {
    UNSPECIFIED = "INDEXER_CHAINED_TX_TYPE_UNSPECIFIED",
    COMMITMENT = "INDEXER_CHAINED_TX_TYPE_COMMITMENT",
    ARK = "INDEXER_CHAINED_TX_TYPE_ARK",
    TREE = "INDEXER_CHAINED_TX_TYPE_TREE",
    CHECKPOINT = "INDEXER_CHAINED_TX_TYPE_CHECKPOINT"
}
export interface PageResponse {
    current: number;
    next: number;
    total: number;
}
export interface Batch {
    totalOutputAmount: string;
    totalOutputVtxos: number;
    expiresAt: string;
    swept: boolean;
}
export interface ChainTx {
    txid: string;
    expiresAt: string;
    type: ChainTxType;
    spends: string[];
}
export interface CommitmentTx {
    startedAt: string;
    endedAt: string;
    batches: {
        [key: string]: Batch;
    };
    totalInputAmount: string;
    totalInputVtxos: number;
    totalOutputAmount: string;
    totalOutputVtxos: number;
}
export interface Tx {
    txid: string;
    children: Record<number, string>;
}
export interface TxHistoryRecord {
    commitmentTxid?: string;
    virtualTxid?: string;
    type: IndexerTxType;
    amount: string;
    createdAt: string;
    isSettled: boolean;
    settledBy: string;
}
export interface Vtxo {
    outpoint: Outpoint;
    createdAt: string;
    expiresAt: string | null;
    amount: string;
    script: string;
    isPreconfirmed: boolean;
    isSwept: boolean;
    isUnrolled: boolean;
    isSpent: boolean;
    spentBy: string | null;
    commitmentTxids: string[];
    settledBy?: string;
    arkTxid?: string;
}
export interface VtxoChain {
    chain: ChainTx[];
    page?: PageResponse;
}
export interface SubscriptionResponse {
    txid?: string;
    scripts: string[];
    newVtxos: VirtualCoin[];
    spentVtxos: VirtualCoin[];
    tx?: string;
    checkpointTxs?: Record<string, {
        txid: string;
        tx: string;
    }>;
}
export interface IndexerProvider {
    getVtxoTree(batchOutpoint: Outpoint, opts?: PaginationOptions): Promise<{
        vtxoTree: Tx[];
        page?: PageResponse;
    }>;
    getVtxoTreeLeaves(batchOutpoint: Outpoint, opts?: PaginationOptions): Promise<{
        leaves: Outpoint[];
        page?: PageResponse;
    }>;
    getBatchSweepTransactions(batchOutpoint: Outpoint): Promise<{
        sweptBy: string[];
    }>;
    getCommitmentTx(txid: string): Promise<CommitmentTx>;
    getCommitmentTxConnectors(txid: string, opts?: PaginationOptions): Promise<{
        connectors: Tx[];
        page?: PageResponse;
    }>;
    getCommitmentTxForfeitTxs(txid: string, opts?: PaginationOptions): Promise<{
        txids: string[];
        page?: PageResponse;
    }>;
    getSubscription(subscriptionId: string, abortSignal: AbortSignal): AsyncIterableIterator<SubscriptionResponse>;
    getVirtualTxs(txids: string[], opts?: PaginationOptions): Promise<{
        txs: string[];
        page?: PageResponse;
    }>;
    getVtxoChain(vtxoOutpoint: Outpoint, opts?: PaginationOptions): Promise<VtxoChain>;
    getVtxos(opts?: PaginationOptions & {
        scripts?: string[];
        outpoints?: Outpoint[];
        spendableOnly?: boolean;
        spentOnly?: boolean;
        recoverableOnly?: boolean;
    }): Promise<{
        vtxos: VirtualCoin[];
        page?: PageResponse;
    }>;
    subscribeForScripts(scripts: string[], subscriptionId?: string): Promise<string>;
    unsubscribeForScripts(subscriptionId: string, scripts?: string[]): Promise<void>;
}
/**
 * REST-based Indexer provider implementation.
 * @see https://buf.build/arkade-os/arkd/docs/main:ark.v1#ark.v1.IndexerService
 * @example
 * ```typescript
 * const provider = new RestIndexerProvider('https://ark.indexer.example.com');
 * const commitmentTx = await provider.getCommitmentTx("6686af8f3be3517880821f62e6c3d749b9d6713736a1d8e229a55daa659446b2");
 * ```
 */
export declare class RestIndexerProvider implements IndexerProvider {
    serverUrl: string;
    constructor(serverUrl: string);
    getVtxoTree(batchOutpoint: Outpoint, opts?: PaginationOptions): Promise<{
        vtxoTree: Tx[];
        page?: PageResponse;
    }>;
    getVtxoTreeLeaves(batchOutpoint: Outpoint, opts?: PaginationOptions): Promise<{
        leaves: Outpoint[];
        page?: PageResponse;
    }>;
    getBatchSweepTransactions(batchOutpoint: Outpoint): Promise<{
        sweptBy: string[];
    }>;
    getCommitmentTx(txid: string): Promise<CommitmentTx>;
    getCommitmentTxConnectors(txid: string, opts?: PaginationOptions): Promise<{
        connectors: Tx[];
        page?: PageResponse;
    }>;
    getCommitmentTxForfeitTxs(txid: string, opts?: PaginationOptions): Promise<{
        txids: string[];
        page?: PageResponse;
    }>;
    getSubscription(subscriptionId: string, abortSignal: AbortSignal): AsyncGenerator<{
        txid: any;
        scripts: any;
        newVtxos: any;
        spentVtxos: any;
        tx: any;
        checkpointTxs: any;
    }, void, unknown>;
    getVirtualTxs(txids: string[], opts?: PaginationOptions): Promise<{
        txs: string[];
        page?: PageResponse;
    }>;
    getVtxoChain(vtxoOutpoint: Outpoint, opts?: PaginationOptions): Promise<VtxoChain>;
    getVtxos(opts?: PaginationOptions & {
        scripts?: string[];
        outpoints?: Outpoint[];
        spendableOnly?: boolean;
        spentOnly?: boolean;
        recoverableOnly?: boolean;
    }): Promise<{
        vtxos: VirtualCoin[];
        page?: PageResponse;
    }>;
    subscribeForScripts(scripts: string[], subscriptionId?: string): Promise<string>;
    unsubscribeForScripts(subscriptionId: string, scripts?: string[]): Promise<void>;
}
