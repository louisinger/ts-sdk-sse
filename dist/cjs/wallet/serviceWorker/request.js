"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Request = void 0;
/**
 * Request is the namespace that contains the request types for the service worker.
 */
var Request;
(function (Request) {
    function isBase(message) {
        return (typeof message === "object" && message !== null && "type" in message);
    }
    Request.isBase = isBase;
    function isInitWallet(message) {
        return (message.type === "INIT_WALLET" &&
            "privateKey" in message &&
            typeof message.privateKey === "string" &&
            "arkServerUrl" in message &&
            typeof message.arkServerUrl === "string" &&
            ("arkServerPublicKey" in message
                ? typeof message.arkServerPublicKey === "string" ||
                    message.arkServerPublicKey === undefined
                : true));
    }
    Request.isInitWallet = isInitWallet;
    function isSettle(message) {
        return message.type === "SETTLE";
    }
    Request.isSettle = isSettle;
    function isGetAddress(message) {
        return message.type === "GET_ADDRESS";
    }
    Request.isGetAddress = isGetAddress;
    function isGetBoardingAddress(message) {
        return message.type === "GET_BOARDING_ADDRESS";
    }
    Request.isGetBoardingAddress = isGetBoardingAddress;
    function isGetBalance(message) {
        return message.type === "GET_BALANCE";
    }
    Request.isGetBalance = isGetBalance;
    function isGetVtxos(message) {
        return message.type === "GET_VTXOS";
    }
    Request.isGetVtxos = isGetVtxos;
    function isGetVirtualCoins(message) {
        return message.type === "GET_VIRTUAL_COINS";
    }
    Request.isGetVirtualCoins = isGetVirtualCoins;
    function isGetBoardingUtxos(message) {
        return message.type === "GET_BOARDING_UTXOS";
    }
    Request.isGetBoardingUtxos = isGetBoardingUtxos;
    function isSendBitcoin(message) {
        return (message.type === "SEND_BITCOIN" &&
            "params" in message &&
            message.params !== null &&
            typeof message.params === "object" &&
            "address" in message.params &&
            typeof message.params.address === "string" &&
            "amount" in message.params &&
            typeof message.params.amount === "number");
    }
    Request.isSendBitcoin = isSendBitcoin;
    function isGetTransactionHistory(message) {
        return message.type === "GET_TRANSACTION_HISTORY";
    }
    Request.isGetTransactionHistory = isGetTransactionHistory;
    function isGetStatus(message) {
        return message.type === "GET_STATUS";
    }
    Request.isGetStatus = isGetStatus;
    function isSign(message) {
        return (message.type === "SIGN" &&
            "tx" in message &&
            typeof message.tx === "string" &&
            ("inputIndexes" in message && message.inputIndexes != undefined
                ? Array.isArray(message.inputIndexes) &&
                    message.inputIndexes.every((index) => typeof index === "number")
                : true));
    }
    Request.isSign = isSign;
})(Request || (exports.Request = Request = {}));
