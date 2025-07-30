import { WalletBalance, VirtualCoin, ArkTransaction, IWallet } from "..";
import { SettlementEvent } from "../../providers/ark";
/**
 * Response is the namespace that contains the response types for the service worker.
 */
export declare namespace Response {
    type Type = "WALLET_INITIALIZED" | "SETTLE_EVENT" | "SETTLE_SUCCESS" | "ADDRESS" | "BOARDING_ADDRESS" | "BALANCE" | "VTXOS" | "VIRTUAL_COINS" | "BOARDING_UTXOS" | "SEND_BITCOIN_SUCCESS" | "TRANSACTION_HISTORY" | "WALLET_STATUS" | "ERROR" | "CLEAR_RESPONSE" | "SIGN_SUCCESS";
    interface Base {
        type: Type;
        success: boolean;
        id: string;
    }
    const walletInitialized: (id: string) => Base;
    interface Error extends Base {
        type: "ERROR";
        success: false;
        message: string;
    }
    function error(id: string, message: string): Error;
    interface SettleEvent extends Base {
        type: "SETTLE_EVENT";
        success: true;
        event: SettlementEvent;
    }
    function settleEvent(id: string, event: SettlementEvent): SettleEvent;
    interface SettleSuccess extends Base {
        type: "SETTLE_SUCCESS";
        success: true;
        txid: string;
    }
    function settleSuccess(id: string, txid: string): SettleSuccess;
    function isSettleSuccess(response: Base): response is SettleSuccess;
    interface Address extends Base {
        type: "ADDRESS";
        success: true;
        address: string;
    }
    function isAddress(response: Base): response is Address;
    function isBoardingAddress(response: Base): response is BoardingAddress;
    function address(id: string, address: string): Address;
    interface BoardingAddress extends Base {
        type: "BOARDING_ADDRESS";
        success: true;
        address: string;
    }
    function boardingAddress(id: string, address: string): BoardingAddress;
    interface Balance extends Base {
        type: "BALANCE";
        success: true;
        balance: WalletBalance;
    }
    function isBalance(response: Base): response is Balance;
    function balance(id: string, balance: WalletBalance): Balance;
    interface Vtxos extends Base {
        type: "VTXOS";
        success: true;
        vtxos: Awaited<ReturnType<IWallet["getVtxos"]>>;
    }
    function isVtxos(response: Base): response is Vtxos;
    function vtxos(id: string, vtxos: Awaited<ReturnType<IWallet["getVtxos"]>>): Vtxos;
    interface VirtualCoins extends Base {
        type: "VIRTUAL_COINS";
        success: true;
        virtualCoins: VirtualCoin[];
    }
    function isVirtualCoins(response: Base): response is VirtualCoins;
    function virtualCoins(id: string, virtualCoins: VirtualCoin[]): VirtualCoins;
    interface BoardingUtxos extends Base {
        type: "BOARDING_UTXOS";
        success: true;
        boardingUtxos: Awaited<ReturnType<IWallet["getBoardingUtxos"]>>;
    }
    function isBoardingUtxos(response: Base): response is BoardingUtxos;
    function boardingUtxos(id: string, boardingUtxos: Awaited<ReturnType<IWallet["getBoardingUtxos"]>>): BoardingUtxos;
    interface SendBitcoinSuccess extends Base {
        type: "SEND_BITCOIN_SUCCESS";
        success: true;
        txid: string;
    }
    function isSendBitcoinSuccess(response: Base): response is SendBitcoinSuccess;
    function sendBitcoinSuccess(id: string, txid: string): SendBitcoinSuccess;
    interface TransactionHistory extends Base {
        type: "TRANSACTION_HISTORY";
        success: true;
        transactions: ArkTransaction[];
    }
    function isTransactionHistory(response: Base): response is TransactionHistory;
    function transactionHistory(id: string, transactions: ArkTransaction[]): TransactionHistory;
    interface WalletStatus extends Base {
        type: "WALLET_STATUS";
        success: true;
        status: {
            walletInitialized: boolean;
        };
    }
    function isWalletStatus(response: Base): response is WalletStatus;
    function walletStatus(id: string, walletInitialized: boolean): WalletStatus;
    interface ClearResponse extends Base {
        type: "CLEAR_RESPONSE";
    }
    function isClearResponse(response: Base): response is ClearResponse;
    function clearResponse(id: string, success: boolean): ClearResponse;
    interface SignSuccess extends Base {
        type: "SIGN_SUCCESS";
        success: true;
        tx: string;
    }
    function signSuccess(id: string, tx: string): SignSuccess;
    function isSignSuccess(response: Base): response is SignSuccess;
}
