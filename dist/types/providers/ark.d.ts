import { TxTreeNode } from "../tree/txTree";
import { TreeNonces, TreePartialSigs } from "../tree/signingSession";
import { Vtxo } from "./indexer";
export type Output = {
    address: string;
    amount: bigint;
};
export declare enum SettlementEventType {
    BatchStarted = "batch_started",
    BatchFinalization = "batch_finalization",
    BatchFinalized = "batch_finalized",
    BatchFailed = "batch_failed",
    TreeSigningStarted = "tree_signing_started",
    TreeNoncesAggregated = "tree_nonces_aggregated",
    TreeTx = "tree_tx",
    TreeSignature = "tree_signature"
}
export type BatchFinalizationEvent = {
    type: SettlementEventType.BatchFinalization;
    id: string;
    commitmentTx: string;
};
export type BatchFinalizedEvent = {
    type: SettlementEventType.BatchFinalized;
    id: string;
    commitmentTxid: string;
};
export type BatchFailedEvent = {
    type: SettlementEventType.BatchFailed;
    id: string;
    reason: string;
};
export type TreeSigningStartedEvent = {
    type: SettlementEventType.TreeSigningStarted;
    id: string;
    cosignersPublicKeys: string[];
    unsignedCommitmentTx: string;
};
export type TreeNoncesAggregatedEvent = {
    type: SettlementEventType.TreeNoncesAggregated;
    id: string;
    treeNonces: TreeNonces;
};
export type BatchStartedEvent = {
    type: SettlementEventType.BatchStarted;
    id: string;
    intentIdHashes: string[];
    batchExpiry: bigint;
};
export type TreeTxEvent = {
    type: SettlementEventType.TreeTx;
    id: string;
    topic: string[];
    batchIndex: number;
    chunk: TxTreeNode;
};
export type TreeSignatureEvent = {
    type: SettlementEventType.TreeSignature;
    id: string;
    topic: string[];
    batchIndex: number;
    txid: string;
    signature: string;
};
export type SettlementEvent = BatchFinalizationEvent | BatchFinalizedEvent | BatchFailedEvent | TreeSigningStartedEvent | TreeNoncesAggregatedEvent | BatchStartedEvent | TreeTxEvent | TreeSignatureEvent;
export interface MarketHour {
    nextStartTime: bigint;
    nextEndTime: bigint;
    period: bigint;
    roundInterval: bigint;
}
export interface ArkInfo {
    signerPubkey: string;
    vtxoTreeExpiry: bigint;
    unilateralExitDelay: bigint;
    roundInterval: bigint;
    network: string;
    dust: bigint;
    forfeitAddress: string;
    marketHour?: MarketHour;
    version: string;
    utxoMinAmount: bigint;
    utxoMaxAmount: bigint;
    vtxoMinAmount: bigint;
    vtxoMaxAmount: bigint;
    boardingExitDelay: bigint;
}
export interface Intent {
    signature: string;
    message: string;
}
export interface TxNotification {
    txid: string;
    tx: string;
    spentVtxos: Vtxo[];
    spendableVtxos: Vtxo[];
    checkpointTxs?: Record<string, {
        txid: string;
        tx: string;
    }>;
}
export interface ArkProvider {
    getInfo(): Promise<ArkInfo>;
    submitTx(signedArkTx: string, checkpointTxs: string[]): Promise<{
        arkTxid: string;
        finalArkTx: string;
        signedCheckpointTxs: string[];
    }>;
    finalizeTx(arkTxid: string, finalCheckpointTxs: string[]): Promise<void>;
    registerIntent(intent: Intent): Promise<string>;
    deleteIntent(intent: Intent): Promise<void>;
    confirmRegistration(intentId: string): Promise<void>;
    submitTreeNonces(batchId: string, pubkey: string, nonces: TreeNonces): Promise<void>;
    submitTreeSignatures(batchId: string, pubkey: string, signatures: TreePartialSigs): Promise<void>;
    submitSignedForfeitTxs(signedForfeitTxs: string[], signedCommitmentTx?: string): Promise<void>;
    getEventStream(signal: AbortSignal, topics: string[]): AsyncIterableIterator<SettlementEvent>;
    getTransactionsStream(signal: AbortSignal): AsyncIterableIterator<{
        commitmentTx?: TxNotification;
        arkTx?: TxNotification;
    }>;
}
/**
 * REST-based Ark provider implementation.
 * @see https://buf.build/arkade-os/arkd/docs/main:ark.v1#ark.v1.ArkService
 * @example
 * ```typescript
 * const provider = new RestArkProvider('https://ark.example.com');
 * const info = await provider.getInfo();
 * ```
 */
export declare class RestArkProvider implements ArkProvider {
    serverUrl: string;
    constructor(serverUrl: string);
    getInfo(): Promise<ArkInfo>;
    submitTx(signedArkTx: string, checkpointTxs: string[]): Promise<{
        arkTxid: string;
        finalArkTx: string;
        signedCheckpointTxs: string[];
    }>;
    finalizeTx(arkTxid: string, finalCheckpointTxs: string[]): Promise<void>;
    registerIntent(intent: Intent): Promise<string>;
    deleteIntent(intent: Intent): Promise<void>;
    confirmRegistration(intentId: string): Promise<void>;
    submitTreeNonces(batchId: string, pubkey: string, nonces: TreeNonces): Promise<void>;
    submitTreeSignatures(batchId: string, pubkey: string, signatures: TreePartialSigs): Promise<void>;
    submitSignedForfeitTxs(signedForfeitTxs: string[], signedCommitmentTx?: string): Promise<void>;
    getEventStream(signal: AbortSignal, topics: string[]): AsyncIterableIterator<SettlementEvent>;
    getTransactionsStream(signal: AbortSignal): AsyncIterableIterator<{
        commitmentTx?: TxNotification;
        arkTx?: TxNotification;
    }>;
    private parseSettlementEvent;
    private parseTransactionNotification;
}
export declare function isFetchTimeoutError(err: any): boolean;
