import { SettleParams, SendBitcoinParams, GetVtxosFilter } from "..";
/**
 * Request is the namespace that contains the request types for the service worker.
 */
export declare namespace Request {
    type Type = "INIT_WALLET" | "SETTLE" | "GET_ADDRESS" | "GET_BOARDING_ADDRESS" | "GET_BALANCE" | "GET_VTXOS" | "GET_VIRTUAL_COINS" | "GET_BOARDING_UTXOS" | "SEND_BITCOIN" | "GET_TRANSACTION_HISTORY" | "GET_STATUS" | "CLEAR" | "SIGN";
    interface Base {
        type: Type;
        id: string;
    }
    function isBase(message: unknown): message is Base;
    interface InitWallet extends Base {
        type: "INIT_WALLET";
        privateKey: string;
        arkServerUrl: string;
        arkServerPublicKey?: string;
    }
    function isInitWallet(message: Base): message is InitWallet;
    interface Settle extends Base {
        type: "SETTLE";
        params?: SettleParams;
    }
    function isSettle(message: Base): message is Settle;
    interface GetAddress extends Base {
        type: "GET_ADDRESS";
    }
    function isGetAddress(message: Base): message is GetAddress;
    interface GetBoardingAddress extends Base {
        type: "GET_BOARDING_ADDRESS";
    }
    function isGetBoardingAddress(message: Base): message is GetBoardingAddress;
    interface GetBalance extends Base {
        type: "GET_BALANCE";
    }
    function isGetBalance(message: Base): message is GetBalance;
    interface GetVtxos extends Base {
        type: "GET_VTXOS";
        filter?: GetVtxosFilter;
    }
    function isGetVtxos(message: Base): message is GetVtxos;
    interface GetVirtualCoins extends Base {
        type: "GET_VIRTUAL_COINS";
    }
    function isGetVirtualCoins(message: Base): message is GetVirtualCoins;
    interface GetBoardingUtxos extends Base {
        type: "GET_BOARDING_UTXOS";
    }
    function isGetBoardingUtxos(message: Base): message is GetBoardingUtxos;
    interface SendBitcoin extends Base {
        type: "SEND_BITCOIN";
        params: SendBitcoinParams;
    }
    function isSendBitcoin(message: Base): message is SendBitcoin;
    interface GetTransactionHistory extends Base {
        type: "GET_TRANSACTION_HISTORY";
    }
    function isGetTransactionHistory(message: Base): message is GetTransactionHistory;
    interface GetStatus extends Base {
        type: "GET_STATUS";
    }
    function isGetStatus(message: Base): message is GetStatus;
    interface Clear extends Base {
        type: "CLEAR";
    }
    interface Sign extends Base {
        type: "SIGN";
        tx: string;
        inputIndexes?: number[];
    }
    function isSign(message: Base): message is Sign;
}
