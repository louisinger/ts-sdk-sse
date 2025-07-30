import { VtxoRepository } from "./db/vtxo";
/**
 * Worker is a class letting to interact with ServiceWorkerWallet from the client
 * it aims to be run in a service worker context
 */
export declare class Worker {
    private readonly vtxoRepository;
    private readonly messageCallback;
    private wallet;
    private arkProvider;
    private indexerProvider;
    private vtxoSubscription;
    constructor(vtxoRepository?: VtxoRepository, messageCallback?: (message: ExtendableMessageEvent) => void);
    start(withServiceWorkerUpdate?: boolean): Promise<void>;
    clear(): Promise<void>;
    private onWalletInitialized;
    private processVtxoSubscription;
    private handleClear;
    private handleInitWallet;
    private handleSettle;
    private handleSendBitcoin;
    private handleGetAddress;
    private handleGetBoardingAddress;
    private handleGetBalance;
    private handleGetVtxos;
    private handleGetBoardingUtxos;
    private handleGetTransactionHistory;
    private handleGetStatus;
    private handleSign;
    private handleMessage;
}
