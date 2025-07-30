"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
/// <reference lib="webworker" />
const singleKey_1 = require("../../identity/singleKey");
const __1 = require("..");
const wallet_1 = require("../wallet");
const request_1 = require("./request");
const response_1 = require("./response");
const ark_1 = require("../../providers/ark");
const idb_1 = require("./db/vtxo/idb");
const transactionHistory_1 = require("../../utils/transactionHistory");
const indexer_1 = require("../../providers/indexer");
const base_1 = require("@scure/base");
const btc_signer_1 = require("@scure/btc-signer");
/**
 * Worker is a class letting to interact with ServiceWorkerWallet from the client
 * it aims to be run in a service worker context
 */
class Worker {
    constructor(vtxoRepository = new idb_1.IndexedDBVtxoRepository(), messageCallback = () => { }) {
        this.vtxoRepository = vtxoRepository;
        this.messageCallback = messageCallback;
    }
    async start(withServiceWorkerUpdate = true) {
        self.addEventListener("message", async (event) => {
            await this.handleMessage(event);
        });
        if (withServiceWorkerUpdate) {
            // activate service worker immediately
            self.addEventListener("install", () => {
                self.skipWaiting();
            });
            // take control of clients immediately
            self.addEventListener("activate", () => {
                self.clients.claim();
            });
        }
    }
    async clear() {
        if (this.vtxoSubscription) {
            this.vtxoSubscription.abort();
        }
        await this.vtxoRepository.close();
        this.wallet = undefined;
        this.arkProvider = undefined;
        this.indexerProvider = undefined;
        this.vtxoSubscription = undefined;
    }
    async onWalletInitialized() {
        if (!this.wallet ||
            !this.arkProvider ||
            !this.indexerProvider ||
            !this.wallet.offchainTapscript ||
            !this.wallet.boardingTapscript) {
            return;
        }
        // subscribe to address updates
        await this.vtxoRepository.open();
        const encodedOffchainTapscript = this.wallet.offchainTapscript.encode();
        const forfeit = this.wallet.offchainTapscript.forfeit();
        const exit = this.wallet.offchainTapscript.exit();
        const script = base_1.hex.encode(this.wallet.offchainTapscript.pkScript);
        // set the initial vtxos state
        const response = await this.indexerProvider.getVtxos({
            scripts: [script],
        });
        const vtxos = response.vtxos.map((vtxo) => ({
            ...vtxo,
            forfeitTapLeafScript: forfeit,
            intentTapLeafScript: exit,
            tapTree: encodedOffchainTapscript,
        }));
        await this.vtxoRepository.addOrUpdate(vtxos);
        this.processVtxoSubscription({
            script,
            vtxoScript: this.wallet.offchainTapscript,
        });
    }
    async processVtxoSubscription({ script, vtxoScript, }) {
        try {
            const forfeitTapLeafScript = vtxoScript.forfeit();
            const intentTapLeafScript = vtxoScript.exit();
            const abortController = new AbortController();
            const subscriptionId = await this.indexerProvider.subscribeForScripts([script]);
            const subscription = this.indexerProvider.getSubscription(subscriptionId, abortController.signal);
            this.vtxoSubscription = abortController;
            const tapTree = vtxoScript.encode();
            for await (const update of subscription) {
                const vtxos = [...update.newVtxos, ...update.spentVtxos];
                if (vtxos.length === 0) {
                    continue;
                }
                const extendedVtxos = vtxos.map((vtxo) => ({
                    ...vtxo,
                    forfeitTapLeafScript,
                    intentTapLeafScript,
                    tapTree,
                }));
                await this.vtxoRepository.addOrUpdate(extendedVtxos);
            }
        }
        catch (error) {
            console.error("Error processing address updates:", error);
        }
    }
    async handleClear(event) {
        this.clear();
        if (request_1.Request.isBase(event.data)) {
            event.source?.postMessage(response_1.Response.clearResponse(event.data.id, true));
        }
    }
    async handleInitWallet(event) {
        const message = event.data;
        if (!request_1.Request.isInitWallet(message)) {
            console.error("Invalid INIT_WALLET message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid INIT_WALLET message format"));
            return;
        }
        try {
            this.arkProvider = new ark_1.RestArkProvider(message.arkServerUrl);
            this.indexerProvider = new indexer_1.RestIndexerProvider(message.arkServerUrl);
            this.wallet = await wallet_1.Wallet.create({
                identity: singleKey_1.SingleKey.fromHex(message.privateKey),
                arkServerUrl: message.arkServerUrl,
                arkServerPublicKey: message.arkServerPublicKey,
            });
            event.source?.postMessage(response_1.Response.walletInitialized(message.id));
            await this.onWalletInitialized();
        }
        catch (error) {
            console.error("Error initializing wallet:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleSettle(event) {
        const message = event.data;
        if (!request_1.Request.isSettle(message)) {
            console.error("Invalid SETTLE message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid SETTLE message format"));
            return;
        }
        try {
            if (!this.wallet) {
                console.error("Wallet not initialized");
                event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
                return;
            }
            const txid = await this.wallet.settle(message.params, (e) => {
                event.source?.postMessage(response_1.Response.settleEvent(message.id, e));
            });
            event.source?.postMessage(response_1.Response.settleSuccess(message.id, txid));
        }
        catch (error) {
            console.error("Error settling:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleSendBitcoin(event) {
        const message = event.data;
        if (!request_1.Request.isSendBitcoin(message)) {
            console.error("Invalid SEND_BITCOIN message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid SEND_BITCOIN message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const txid = await this.wallet.sendBitcoin(message.params);
            event.source?.postMessage(response_1.Response.sendBitcoinSuccess(message.id, txid));
        }
        catch (error) {
            console.error("Error sending bitcoin:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetAddress(event) {
        const message = event.data;
        if (!request_1.Request.isGetAddress(message)) {
            console.error("Invalid GET_ADDRESS message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_ADDRESS message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const address = await this.wallet.getAddress();
            event.source?.postMessage(response_1.Response.address(message.id, address));
        }
        catch (error) {
            console.error("Error getting address:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetBoardingAddress(event) {
        const message = event.data;
        if (!request_1.Request.isGetBoardingAddress(message)) {
            console.error("Invalid GET_BOARDING_ADDRESS message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_BOARDING_ADDRESS message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const address = await this.wallet.getBoardingAddress();
            event.source?.postMessage(response_1.Response.boardingAddress(message.id, address));
        }
        catch (error) {
            console.error("Error getting boarding address:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetBalance(event) {
        const message = event.data;
        if (!request_1.Request.isGetBalance(message)) {
            console.error("Invalid GET_BALANCE message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_BALANCE message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const [boardingUtxos, spendableVtxos, sweptVtxos] = await Promise.all([
                this.wallet.getBoardingUtxos(),
                this.vtxoRepository.getSpendableVtxos(),
                this.vtxoRepository.getSweptVtxos(),
            ]);
            // boarding
            let confirmed = 0;
            let unconfirmed = 0;
            for (const utxo of boardingUtxos) {
                if (utxo.status.confirmed) {
                    confirmed += utxo.value;
                }
                else {
                    unconfirmed += utxo.value;
                }
            }
            // offchain
            let settled = 0;
            let preconfirmed = 0;
            let recoverable = 0;
            for (const vtxo of spendableVtxos) {
                if (vtxo.virtualStatus.state === "settled") {
                    settled += vtxo.value;
                }
                else if (vtxo.virtualStatus.state === "preconfirmed") {
                    preconfirmed += vtxo.value;
                }
            }
            for (const vtxo of sweptVtxos) {
                if ((0, __1.isSpendable)(vtxo)) {
                    recoverable += vtxo.value;
                }
            }
            const totalBoarding = confirmed + unconfirmed;
            const totalOffchain = settled + preconfirmed + recoverable;
            event.source?.postMessage(response_1.Response.balance(message.id, {
                boarding: {
                    confirmed,
                    unconfirmed,
                    total: totalBoarding,
                },
                settled,
                preconfirmed,
                available: settled + preconfirmed,
                recoverable,
                total: totalBoarding + totalOffchain,
            }));
        }
        catch (error) {
            console.error("Error getting balance:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetVtxos(event) {
        const message = event.data;
        if (!request_1.Request.isGetVtxos(message)) {
            console.error("Invalid GET_VTXOS message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_VTXOS message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            let vtxos = await this.vtxoRepository.getSpendableVtxos();
            if (!message.filter?.withRecoverable) {
                if (!this.wallet)
                    throw new Error("Wallet not initialized");
                // exclude subdust is we don't want recoverable
                vtxos = vtxos.filter((v) => !(0, __1.isSubdust)(v, this.wallet.dustAmount));
            }
            if (message.filter?.withRecoverable) {
                // get also swept and spendable vtxos
                const sweptVtxos = await this.vtxoRepository.getSweptVtxos();
                vtxos.push(...sweptVtxos.filter(__1.isSpendable));
            }
            event.source?.postMessage(response_1.Response.vtxos(message.id, vtxos));
        }
        catch (error) {
            console.error("Error getting vtxos:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetBoardingUtxos(event) {
        const message = event.data;
        if (!request_1.Request.isGetBoardingUtxos(message)) {
            console.error("Invalid GET_BOARDING_UTXOS message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_BOARDING_UTXOS message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const boardingUtxos = await this.wallet.getBoardingUtxos();
            event.source?.postMessage(response_1.Response.boardingUtxos(message.id, boardingUtxos));
        }
        catch (error) {
            console.error("Error getting boarding utxos:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetTransactionHistory(event) {
        const message = event.data;
        if (!request_1.Request.isGetTransactionHistory(message)) {
            console.error("Invalid GET_TRANSACTION_HISTORY message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_TRANSACTION_HISTORY message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const { boardingTxs, commitmentsToIgnore: roundsToIgnore } = await this.wallet.getBoardingTxs();
            const { spendable, spent } = await this.vtxoRepository.getAllVtxos();
            // convert VTXOs to offchain transactions
            const offchainTxs = (0, transactionHistory_1.vtxosToTxs)(spendable, spent, roundsToIgnore);
            const txs = [...boardingTxs, ...offchainTxs];
            // sort transactions by creation time in descending order (newest first)
            txs.sort(
            // place createdAt = 0 (unconfirmed txs) first, then descending
            (a, b) => {
                if (a.createdAt === 0)
                    return -1;
                if (b.createdAt === 0)
                    return 1;
                return b.createdAt - a.createdAt;
            });
            event.source?.postMessage(response_1.Response.transactionHistory(message.id, txs));
        }
        catch (error) {
            console.error("Error getting transaction history:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleGetStatus(event) {
        const message = event.data;
        if (!request_1.Request.isGetStatus(message)) {
            console.error("Invalid GET_STATUS message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid GET_STATUS message format"));
            return;
        }
        event.source?.postMessage(response_1.Response.walletStatus(message.id, this.wallet !== undefined));
    }
    async handleSign(event) {
        const message = event.data;
        if (!request_1.Request.isSign(message)) {
            console.error("Invalid SIGN message format", message);
            event.source?.postMessage(response_1.Response.error(message.id, "Invalid SIGN message format"));
            return;
        }
        if (!this.wallet) {
            console.error("Wallet not initialized");
            event.source?.postMessage(response_1.Response.error(message.id, "Wallet not initialized"));
            return;
        }
        try {
            const tx = btc_signer_1.Transaction.fromPSBT(base_1.base64.decode(message.tx), {
                allowUnknown: true,
                allowUnknownInputs: true,
            });
            const signedTx = await this.wallet.identity.sign(tx, message.inputIndexes);
            event.source?.postMessage(response_1.Response.signSuccess(message.id, base_1.base64.encode(signedTx.toPSBT())));
        }
        catch (error) {
            console.error("Error signing:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown error occurred";
            event.source?.postMessage(response_1.Response.error(message.id, errorMessage));
        }
    }
    async handleMessage(event) {
        this.messageCallback(event);
        const message = event.data;
        if (!request_1.Request.isBase(message)) {
            console.warn("Invalid message format", JSON.stringify(message));
            // ignore invalid messages
            return;
        }
        switch (message.type) {
            case "INIT_WALLET": {
                await this.handleInitWallet(event);
                break;
            }
            case "SETTLE": {
                await this.handleSettle(event);
                break;
            }
            case "SEND_BITCOIN": {
                await this.handleSendBitcoin(event);
                break;
            }
            case "GET_ADDRESS": {
                await this.handleGetAddress(event);
                break;
            }
            case "GET_BOARDING_ADDRESS": {
                await this.handleGetBoardingAddress(event);
                break;
            }
            case "GET_BALANCE": {
                await this.handleGetBalance(event);
                break;
            }
            case "GET_VTXOS": {
                await this.handleGetVtxos(event);
                break;
            }
            case "GET_BOARDING_UTXOS": {
                await this.handleGetBoardingUtxos(event);
                break;
            }
            case "GET_TRANSACTION_HISTORY": {
                await this.handleGetTransactionHistory(event);
                break;
            }
            case "GET_STATUS": {
                await this.handleGetStatus(event);
                break;
            }
            case "CLEAR": {
                await this.handleClear(event);
                break;
            }
            case "SIGN": {
                await this.handleSign(event);
                break;
            }
            default:
                event.source?.postMessage(response_1.Response.error(message.id, "Unknown message type"));
        }
    }
}
exports.Worker = Worker;
