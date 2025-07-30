import { Output, SettlementEvent } from "../providers/ark";
import { Identity } from "../identity";
import { RelativeTimelock } from "../script/tapscript";
import { EncodedVtxoScript, TapLeafScript } from "../script/base";
import { Bytes } from "@scure/btc-signer/utils";
/**
 * Configuration options for wallet initialization.
 *
 * Defines the parameters required to create and configure a wallet instance,
 * including identity, server URLs, and optional timelock settings.
 * If optional parameters are not provided, the wallet will fetch them from the
 * Ark server.
 */
export interface WalletConfig {
    identity: Identity;
    arkServerUrl: string;
    esploraUrl?: string;
    arkServerPublicKey?: string;
    boardingTimelock?: RelativeTimelock;
    exitTimelock?: RelativeTimelock;
}
export interface WalletBalance {
    boarding: {
        confirmed: number;
        unconfirmed: number;
        total: number;
    };
    settled: number;
    preconfirmed: number;
    available: number;
    recoverable: number;
    total: number;
}
export interface SendBitcoinParams {
    address: string;
    amount: number;
    feeRate?: number;
    memo?: string;
}
export interface Recipient {
    address: string;
    amount: number;
}
export interface SettleParams {
    inputs: ExtendedCoin[];
    outputs: Output[];
}
export interface Status {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
}
export interface VirtualStatus {
    state: "preconfirmed" | "settled" | "swept" | "spent";
    commitmentTxIds?: string[];
    batchExpiry?: number;
}
export interface Outpoint {
    txid: string;
    vout: number;
}
export interface Coin extends Outpoint {
    value: number;
    status: Status;
}
export interface VirtualCoin extends Coin {
    virtualStatus: VirtualStatus;
    spentBy?: string;
    settledBy?: string;
    arkTxId?: string;
    createdAt: Date;
    isUnrolled: boolean;
}
export declare enum TxType {
    TxSent = "SENT",
    TxReceived = "RECEIVED"
}
export interface TxKey {
    boardingTxid: string;
    commitmentTxid: string;
    arkTxid: string;
}
export interface ArkTransaction {
    key: TxKey;
    type: TxType;
    amount: number;
    settled: boolean;
    createdAt: number;
}
export type TapLeaves = {
    forfeitTapLeafScript: TapLeafScript;
    intentTapLeafScript: TapLeafScript;
};
export type ExtendedCoin = TapLeaves & EncodedVtxoScript & Coin & {
    extraWitness?: Bytes[];
};
export type ExtendedVirtualCoin = TapLeaves & EncodedVtxoScript & VirtualCoin & {
    extraWitness?: Bytes[];
};
export declare function isSpendable(vtxo: VirtualCoin): boolean;
export declare function isRecoverable(vtxo: VirtualCoin): boolean;
export declare function isSubdust(vtxo: VirtualCoin, dust: bigint): boolean;
export type GetVtxosFilter = {
    withRecoverable?: boolean;
    withUnrolled?: boolean;
};
/**
 * Core wallet interface for Bitcoin transactions with Ark protocol support.
 *
 * This interface defines the contract that all wallet implementations must follow.
 * It provides methods for address management, balance checking, virtual UTXO
 * operations, and transaction management including sending, settling, and unrolling.
 */
export interface IWallet {
    getAddress(): Promise<string>;
    getBoardingAddress(): Promise<string>;
    getBalance(): Promise<WalletBalance>;
    getVtxos(filter?: GetVtxosFilter): Promise<ExtendedVirtualCoin[]>;
    getBoardingUtxos(): Promise<ExtendedCoin[]>;
    getTransactionHistory(): Promise<ArkTransaction[]>;
    sendBitcoin(params: SendBitcoinParams): Promise<string>;
    settle(params?: SettleParams, eventCallback?: (event: SettlementEvent) => void): Promise<string>;
}
