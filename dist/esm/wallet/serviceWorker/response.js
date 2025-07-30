/**
 * Response is the namespace that contains the response types for the service worker.
 */
export var Response;
(function (Response) {
    Response.walletInitialized = (id) => ({
        type: "WALLET_INITIALIZED",
        success: true,
        id,
    });
    function error(id, message) {
        return {
            type: "ERROR",
            success: false,
            message,
            id,
        };
    }
    Response.error = error;
    function settleEvent(id, event) {
        return {
            type: "SETTLE_EVENT",
            success: true,
            event,
            id,
        };
    }
    Response.settleEvent = settleEvent;
    function settleSuccess(id, txid) {
        return {
            type: "SETTLE_SUCCESS",
            success: true,
            txid,
            id,
        };
    }
    Response.settleSuccess = settleSuccess;
    function isSettleSuccess(response) {
        return response.type === "SETTLE_SUCCESS" && response.success;
    }
    Response.isSettleSuccess = isSettleSuccess;
    function isAddress(response) {
        return response.type === "ADDRESS" && response.success === true;
    }
    Response.isAddress = isAddress;
    function isBoardingAddress(response) {
        return (response.type === "BOARDING_ADDRESS" && response.success === true);
    }
    Response.isBoardingAddress = isBoardingAddress;
    function address(id, address) {
        return {
            type: "ADDRESS",
            success: true,
            address,
            id,
        };
    }
    Response.address = address;
    function boardingAddress(id, address) {
        return {
            type: "BOARDING_ADDRESS",
            success: true,
            address,
            id,
        };
    }
    Response.boardingAddress = boardingAddress;
    function isBalance(response) {
        return response.type === "BALANCE" && response.success === true;
    }
    Response.isBalance = isBalance;
    function balance(id, balance) {
        return {
            type: "BALANCE",
            success: true,
            balance,
            id,
        };
    }
    Response.balance = balance;
    function isVtxos(response) {
        return response.type === "VTXOS" && response.success === true;
    }
    Response.isVtxos = isVtxos;
    function vtxos(id, vtxos) {
        return {
            type: "VTXOS",
            success: true,
            vtxos,
            id,
        };
    }
    Response.vtxos = vtxos;
    function isVirtualCoins(response) {
        return response.type === "VIRTUAL_COINS" && response.success === true;
    }
    Response.isVirtualCoins = isVirtualCoins;
    function virtualCoins(id, virtualCoins) {
        return {
            type: "VIRTUAL_COINS",
            success: true,
            virtualCoins,
            id,
        };
    }
    Response.virtualCoins = virtualCoins;
    function isBoardingUtxos(response) {
        return response.type === "BOARDING_UTXOS" && response.success === true;
    }
    Response.isBoardingUtxos = isBoardingUtxos;
    function boardingUtxos(id, boardingUtxos) {
        return {
            type: "BOARDING_UTXOS",
            success: true,
            boardingUtxos,
            id,
        };
    }
    Response.boardingUtxos = boardingUtxos;
    function isSendBitcoinSuccess(response) {
        return (response.type === "SEND_BITCOIN_SUCCESS" &&
            response.success === true);
    }
    Response.isSendBitcoinSuccess = isSendBitcoinSuccess;
    function sendBitcoinSuccess(id, txid) {
        return {
            type: "SEND_BITCOIN_SUCCESS",
            success: true,
            txid,
            id,
        };
    }
    Response.sendBitcoinSuccess = sendBitcoinSuccess;
    function isTransactionHistory(response) {
        return (response.type === "TRANSACTION_HISTORY" && response.success === true);
    }
    Response.isTransactionHistory = isTransactionHistory;
    function transactionHistory(id, transactions) {
        return {
            type: "TRANSACTION_HISTORY",
            success: true,
            transactions,
            id,
        };
    }
    Response.transactionHistory = transactionHistory;
    function isWalletStatus(response) {
        return response.type === "WALLET_STATUS" && response.success === true;
    }
    Response.isWalletStatus = isWalletStatus;
    function walletStatus(id, walletInitialized) {
        return {
            type: "WALLET_STATUS",
            success: true,
            status: {
                walletInitialized,
            },
            id,
        };
    }
    Response.walletStatus = walletStatus;
    function isClearResponse(response) {
        return response.type === "CLEAR_RESPONSE";
    }
    Response.isClearResponse = isClearResponse;
    function clearResponse(id, success) {
        return {
            type: "CLEAR_RESPONSE",
            success,
            id,
        };
    }
    Response.clearResponse = clearResponse;
    function signSuccess(id, tx) {
        return {
            type: "SIGN_SUCCESS",
            success: true,
            tx,
            id,
        };
    }
    Response.signSuccess = signSuccess;
    function isSignSuccess(response) {
        return response.type === "SIGN_SUCCESS" && response.success === true;
    }
    Response.isSignSuccess = isSignSuccess;
})(Response || (Response = {}));
