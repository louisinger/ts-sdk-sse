import { P2TR } from "@scure/btc-signer/payment";
import { Coin, SendBitcoinParams } from ".";
import { Identity } from "../identity";
import { Network, NetworkName } from "../networks";
import { OnchainProvider } from "../providers/onchain";
import { Transaction } from "@scure/btc-signer";
import { AnchorBumper } from "../utils/anchor";
/**
 * Onchain Bitcoin wallet implementation for traditional Bitcoin transactions.
 *
 * This wallet handles regular Bitcoin transactions on the blockchain without
 * using the Ark protocol. It supports P2TR (Pay-to-Taproot) addresses and
 * provides basic Bitcoin wallet functionality.
 *
 * @example
 * ```typescript
 * const wallet = new OnchainWallet(identity, 'mainnet');
 * const balance = await wallet.getBalance();
 * const txid = await wallet.send({
 *   address: 'bc1...',
 *   amount: 50000
 * });
 * ```
 */
export declare class OnchainWallet implements AnchorBumper {
    private identity;
    static MIN_FEE_RATE: number;
    static DUST_AMOUNT: number;
    readonly onchainP2TR: P2TR;
    readonly provider: OnchainProvider;
    readonly network: Network;
    constructor(identity: Identity, network: NetworkName, provider?: OnchainProvider);
    get address(): string;
    getCoins(): Promise<Coin[]>;
    getBalance(): Promise<number>;
    send(params: SendBitcoinParams): Promise<string>;
    bumpP2A(parent: Transaction): Promise<[string, string]>;
}
/**
 * Select coins to reach a target amount, prioritizing those closer to expiry
 * @param coins List of coins to select from
 * @param targetAmount Target amount to reach in satoshis
 * @param forceChange If true, ensure the coin selection will require a change output
 * @returns Selected coins and change amount, or null if insufficient funds
 */
export declare function selectCoins(coins: Coin[], targetAmount: number, forceChange?: boolean): {
    inputs: Coin[];
    changeAmount: bigint;
};
