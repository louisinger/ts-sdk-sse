import { ArkAddress } from "../script/address";
import { DefaultVtxo } from "../script/default";
import { Network, NetworkName } from "../networks";
import { OnchainProvider } from "../providers/onchain";
import { SettlementEvent, ArkProvider } from "../providers/ark";
import { Identity } from "../identity";
import { ArkTransaction, Coin, ExtendedCoin, ExtendedVirtualCoin, GetVtxosFilter, IWallet, SendBitcoinParams, SettleParams, VirtualCoin, WalletBalance, WalletConfig } from ".";
import { Bytes } from "@scure/btc-signer/utils";
import { CSVMultisigTapscript } from "../script/tapscript";
import { IndexerProvider } from "../providers/indexer";
export type IncomingFunds = {
    type: "utxo";
    coins: Coin[];
} | {
    type: "vtxo";
    vtxos: VirtualCoin[];
};
/**
 * Main wallet implementation for Bitcoin transactions with Ark protocol support.
 * The wallet does not store any data locally and relies on Ark and onchain
 * providers to fetch UTXOs and VTXOs.
 *
 * @example
 * ```typescript
 * // Create a wallet
 * const wallet = await Wallet.create({
 *   identity: SingleKey.fromHex('your_private_key'),
 *   arkServerUrl: 'https://ark.example.com',
 *   esploraUrl: 'https://mempool.space/api'
 * });
 *
 * // Get addresses
 * const arkAddress = await wallet.getAddress();
 * const boardingAddress = await wallet.getBoardingAddress();
 *
 * // Send bitcoin
 * const txid = await wallet.sendBitcoin({
 *   address: 'tb1...',
 *   amount: 50000
 * });
 * ```
 */
export declare class Wallet implements IWallet {
    readonly identity: Identity;
    readonly network: Network;
    readonly networkName: NetworkName;
    readonly onchainProvider: OnchainProvider;
    readonly arkProvider: ArkProvider;
    readonly indexerProvider: IndexerProvider;
    readonly arkServerPublicKey: Bytes;
    readonly offchainTapscript: DefaultVtxo.Script;
    readonly boardingTapscript: DefaultVtxo.Script;
    readonly serverUnrollScript: CSVMultisigTapscript.Type;
    readonly forfeitOutputScript: Bytes;
    readonly dustAmount: bigint;
    static MIN_FEE_RATE: number;
    private constructor();
    static create(config: WalletConfig): Promise<Wallet>;
    get arkAddress(): ArkAddress;
    getAddress(): Promise<string>;
    getBoardingAddress(): Promise<string>;
    getBalance(): Promise<WalletBalance>;
    getVtxos(filter?: GetVtxosFilter): Promise<ExtendedVirtualCoin[]>;
    private getVirtualCoins;
    getTransactionHistory(): Promise<ArkTransaction[]>;
    getBoardingTxs(): Promise<{
        boardingTxs: ArkTransaction[];
        commitmentsToIgnore: Set<string>;
    }>;
    getBoardingUtxos(): Promise<ExtendedCoin[]>;
    sendBitcoin(params: SendBitcoinParams): Promise<string>;
    settle(params?: SettleParams, eventCallback?: (event: SettlementEvent) => void): Promise<string>;
    notifyIncomingFunds(eventCallback: (coins: IncomingFunds) => void): Promise<() => void>;
    private handleBatchStartedEvent;
    private handleSettlementSigningEvent;
    private handleSettlementSigningNoncesGeneratedEvent;
    private handleSettlementFinalizationEvent;
    private makeRegisterIntentSignature;
    private makeDeleteIntentSignature;
    private prepareBIP322Inputs;
    private makeBIP322Signature;
}
/**
 * Wait for incoming funds to the wallet
 * @param wallet - The wallet to wait for incoming funds
 * @returns A promise that resolves the next new coins received by the wallet's address
 */
export declare function waitForIncomingFunds(wallet: Wallet): Promise<IncomingFunds>;
