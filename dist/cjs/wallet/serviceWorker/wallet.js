"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceWorkerWallet = void 0;
const response_1 = require("./response");
const base_1 = require("@scure/base");
const singleKey_1 = require("../../identity/singleKey");
const signingSession_1 = require("../../tree/signingSession");
const btc_signer_1 = require("@scure/btc-signer");
class UnexpectedResponseError extends Error {
    constructor(response) {
        super(`Unexpected response type. Got: ${JSON.stringify(response, null, 2)}`);
        this.name = "UnexpectedResponseError";
    }
}
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
class ServiceWorkerWallet {
    constructor(serviceWorker) {
        this.serviceWorker = serviceWorker;
    }
    async getStatus() {
        const message = {
            type: "GET_STATUS",
            id: getRandomId(),
        };
        const response = await this.sendMessage(message);
        if (response_1.Response.isWalletStatus(response)) {
            return response.status;
        }
        throw new UnexpectedResponseError(response);
    }
    async init(config, failIfInitialized = false) {
        // Check if wallet is already initialized
        const statusMessage = {
            type: "GET_STATUS",
            id: getRandomId(),
        };
        const response = await this.sendMessage(statusMessage);
        if (response_1.Response.isWalletStatus(response) &&
            response.status.walletInitialized) {
            if (failIfInitialized) {
                throw new Error("Wallet already initialized");
            }
            return;
        }
        // If not initialized, proceed with initialization
        const message = {
            type: "INIT_WALLET",
            id: getRandomId(),
            privateKey: config.privateKey,
            arkServerUrl: config.arkServerUrl,
            arkServerPublicKey: config.arkServerPublicKey,
        };
        await this.sendMessage(message);
        const privKeyBytes = base_1.hex.decode(config.privateKey);
        // cache the identity xOnlyPublicKey
        this.cachedXOnlyPublicKey =
            singleKey_1.SingleKey.fromPrivateKey(privKeyBytes).xOnlyPublicKey();
    }
    async clear() {
        const message = {
            type: "CLEAR",
            id: getRandomId(),
        };
        await this.sendMessage(message);
        // clear the cached xOnlyPublicKey
        this.cachedXOnlyPublicKey = undefined;
    }
    // send a message and wait for a response
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                const response = event.data;
                if (response.id === "") {
                    reject(new Error("Invalid response id"));
                    return;
                }
                if (response.id !== message.id) {
                    return;
                }
                navigator.serviceWorker.removeEventListener("message", messageHandler);
                if (!response.success) {
                    reject(new Error(response.message));
                }
                else {
                    resolve(response);
                }
            };
            navigator.serviceWorker.addEventListener("message", messageHandler);
            this.serviceWorker.postMessage(message);
        });
    }
    async getAddress() {
        const message = {
            type: "GET_ADDRESS",
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isAddress(response)) {
                return response.address;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get address: ${error}`);
        }
    }
    async getBoardingAddress() {
        const message = {
            type: "GET_BOARDING_ADDRESS",
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isBoardingAddress(response)) {
                return response.address;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get boarding address: ${error}`);
        }
    }
    async getBalance() {
        const message = {
            type: "GET_BALANCE",
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isBalance(response)) {
                return response.balance;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get balance: ${error}`);
        }
    }
    async getVtxos(filter) {
        const message = {
            type: "GET_VTXOS",
            id: getRandomId(),
            filter,
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isVtxos(response)) {
                return response.vtxos;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get vtxos: ${error}`);
        }
    }
    async getBoardingUtxos() {
        const message = {
            type: "GET_BOARDING_UTXOS",
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isBoardingUtxos(response)) {
                return response.boardingUtxos;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get boarding UTXOs: ${error}`);
        }
    }
    async sendBitcoin(params) {
        const message = {
            type: "SEND_BITCOIN",
            params,
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isSendBitcoinSuccess(response)) {
                return response.txid;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to send bitcoin: ${error}`);
        }
    }
    async settle(params, callback) {
        const message = {
            type: "SETTLE",
            params,
            id: getRandomId(),
        };
        try {
            return new Promise((resolve, reject) => {
                const messageHandler = (event) => {
                    const response = event.data;
                    if (!response.success) {
                        navigator.serviceWorker.removeEventListener("message", messageHandler);
                        reject(new Error(response.message));
                        return;
                    }
                    switch (response.type) {
                        case "SETTLE_EVENT":
                            if (callback) {
                                callback(response.event);
                            }
                            break;
                        case "SETTLE_SUCCESS":
                            navigator.serviceWorker.removeEventListener("message", messageHandler);
                            resolve(response.txid);
                            break;
                        default:
                            break;
                    }
                };
                navigator.serviceWorker.addEventListener("message", messageHandler);
                this.serviceWorker.postMessage(message);
            });
        }
        catch (error) {
            throw new Error(`Settlement failed: ${error}`);
        }
    }
    async getTransactionHistory() {
        const message = {
            type: "GET_TRANSACTION_HISTORY",
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isTransactionHistory(response)) {
                return response.transactions;
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to get transaction history: ${error}`);
        }
    }
    xOnlyPublicKey() {
        if (!this.cachedXOnlyPublicKey) {
            throw new Error("Wallet not initialized");
        }
        return this.cachedXOnlyPublicKey;
    }
    signerSession() {
        return signingSession_1.TreeSignerSession.random();
    }
    async sign(tx, inputIndexes) {
        const message = {
            type: "SIGN",
            tx: base_1.base64.encode(tx.toPSBT()),
            inputIndexes,
            id: getRandomId(),
        };
        try {
            const response = await this.sendMessage(message);
            if (response_1.Response.isSignSuccess(response)) {
                return btc_signer_1.Transaction.fromPSBT(base_1.base64.decode(response.tx), {
                    allowUnknown: true,
                    allowUnknownInputs: true,
                });
            }
            throw new UnexpectedResponseError(response);
        }
        catch (error) {
            throw new Error(`Failed to sign: ${error}`);
        }
    }
}
exports.ServiceWorkerWallet = ServiceWorkerWallet;
function getRandomId() {
    const randomValue = crypto.getRandomValues(new Uint8Array(16));
    return base_1.hex.encode(randomValue);
}
