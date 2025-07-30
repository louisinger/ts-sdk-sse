import { IWallet, WalletBalance, SendBitcoinParams, SettleParams, ArkTransaction, WalletConfig, ExtendedCoin, ExtendedVirtualCoin, GetVtxosFilter } from "..";
import { Response } from "./response";
import { SettlementEvent } from "../../providers/ark";
import { Identity } from "../../identity";
import { SignerSession } from "../../tree/signingSession";
import { Transaction } from "@scure/btc-signer";
/**
 * Service Worker-based wallet implementation for browser environments.
 *
 * This wallet uses a service worker as a backend to handle wallet logic,
 * providing secure key storage and transaction signing in web applications.
 * The service worker runs in a separate thread and can persist data between
 * browser sessions.
 *
 * @example
 * ```typescript
 * // Create and initialize the service worker wallet
 * const serviceWorker = await setupServiceWorker("/service-worker.js");
 * const wallet = new ServiceWorkerWallet(serviceWorker);
 * await wallet.init({
 *   privateKey: 'your_private_key_hex',
 *   arkServerUrl: 'https://ark.example.com'
 * });
 *
 * // Use like any other wallet
 * const address = await wallet.getAddress();
 * const balance = await wallet.getBalance();
 * ```
 */
export declare class ServiceWorkerWallet implements IWallet, Identity {
    readonly serviceWorker: ServiceWorker;
    private cachedXOnlyPublicKey;
    constructor(serviceWorker: ServiceWorker);
    getStatus(): Promise<Response.WalletStatus["status"]>;
    init(config: Omit<WalletConfig, "identity"> & {
        privateKey: string;
    }, failIfInitialized?: boolean): Promise<void>;
    clear(): Promise<void>;
    private sendMessage;
    getAddress(): Promise<string>;
    getBoardingAddress(): Promise<string>;
    getBalance(): Promise<WalletBalance>;
    getVtxos(filter?: GetVtxosFilter): Promise<ExtendedVirtualCoin[]>;
    getBoardingUtxos(): Promise<ExtendedCoin[]>;
    sendBitcoin(params: SendBitcoinParams): Promise<string>;
    settle(params?: SettleParams, callback?: (event: SettlementEvent) => void): Promise<string>;
    getTransactionHistory(): Promise<ArkTransaction[]>;
    xOnlyPublicKey(): Uint8Array;
    signerSession(): SignerSession;
    sign(tx: Transaction, inputIndexes?: number[]): Promise<Transaction>;
}
