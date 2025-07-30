import { base64, hex } from "@scure/base";
import * as bip68 from "bip68";
import { Address, OutScript, tapLeafHash } from "@scure/btc-signer/payment";
import { SigHash, Transaction } from "@scure/btc-signer";
import { TaprootControlBlock, } from "@scure/btc-signer/psbt";
import { vtxosToTxs } from '../utils/transactionHistory.js';
import { ArkAddress } from '../script/address.js';
import { DefaultVtxo } from '../script/default.js';
import { getNetwork } from '../networks.js';
import { ESPLORA_URL, EsploraProvider, } from '../providers/onchain.js';
import { SettlementEventType, RestArkProvider, } from '../providers/ark.js';
import { buildForfeitTx } from '../forfeit.js';
import { validateConnectorsTxGraph, validateVtxoTxGraph, } from '../tree/validation.js';
import { isRecoverable, isSpendable, isSubdust, TxType, } from './index.js';
import { sha256, sha256x2 } from "@scure/btc-signer/utils";
import { VtxoScript } from '../script/base.js';
import { CSVMultisigTapscript } from '../script/tapscript.js';
import { buildOffchainTx } from '../utils/arkTransaction.js';
import { ArkNote } from '../arknote/index.js';
import { BIP322 } from '../bip322/index.js';
import { RestIndexerProvider } from '../providers/indexer.js';
import { TxTree } from '../tree/txTree.js';
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
export class Wallet {
    constructor(identity, network, networkName, onchainProvider, arkProvider, indexerProvider, arkServerPublicKey, offchainTapscript, boardingTapscript, serverUnrollScript, forfeitOutputScript, dustAmount) {
        this.identity = identity;
        this.network = network;
        this.networkName = networkName;
        this.onchainProvider = onchainProvider;
        this.arkProvider = arkProvider;
        this.indexerProvider = indexerProvider;
        this.arkServerPublicKey = arkServerPublicKey;
        this.offchainTapscript = offchainTapscript;
        this.boardingTapscript = boardingTapscript;
        this.serverUnrollScript = serverUnrollScript;
        this.forfeitOutputScript = forfeitOutputScript;
        this.dustAmount = dustAmount;
    }
    static async create(config) {
        const pubkey = config.identity.xOnlyPublicKey();
        if (!pubkey) {
            throw new Error("Invalid configured public key");
        }
        const arkProvider = new RestArkProvider(config.arkServerUrl);
        const indexerProvider = new RestIndexerProvider(config.arkServerUrl);
        const info = await arkProvider.getInfo();
        const network = getNetwork(info.network);
        const onchainProvider = new EsploraProvider(config.esploraUrl || ESPLORA_URL[info.network]);
        const exitTimelock = {
            value: info.unilateralExitDelay,
            type: info.unilateralExitDelay < 512n ? "blocks" : "seconds",
        };
        const boardingTimelock = {
            value: info.boardingExitDelay,
            type: info.boardingExitDelay < 512n ? "blocks" : "seconds",
        };
        // Generate tapscripts for offchain and boarding address
        const serverPubKey = hex.decode(info.signerPubkey).slice(1);
        const bareVtxoTapscript = new DefaultVtxo.Script({
            pubKey: pubkey,
            serverPubKey,
            csvTimelock: exitTimelock,
        });
        const boardingTapscript = new DefaultVtxo.Script({
            pubKey: pubkey,
            serverPubKey,
            csvTimelock: boardingTimelock,
        });
        // Save tapscripts
        const offchainTapscript = bareVtxoTapscript;
        // the serverUnrollScript is the one used to create output scripts of the checkpoint transactions
        const serverUnrollScript = CSVMultisigTapscript.encode({
            timelock: exitTimelock,
            pubkeys: [serverPubKey],
        });
        // parse the server forfeit address
        // server is expecting funds to be sent to this address
        const forfeitAddress = Address(network).decode(info.forfeitAddress);
        const forfeitOutputScript = OutScript.encode(forfeitAddress);
        return new Wallet(config.identity, network, info.network, onchainProvider, arkProvider, indexerProvider, serverPubKey, offchainTapscript, boardingTapscript, serverUnrollScript, forfeitOutputScript, info.dust);
    }
    get arkAddress() {
        return this.offchainTapscript.address(this.network.hrp, this.arkServerPublicKey);
    }
    async getAddress() {
        return this.arkAddress.encode();
    }
    async getBoardingAddress() {
        return this.boardingTapscript.onchainAddress(this.network);
    }
    async getBalance() {
        const [boardingUtxos, vtxos] = await Promise.all([
            this.getBoardingUtxos(),
            this.getVtxos(),
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
        settled = vtxos
            .filter((coin) => coin.virtualStatus.state === "settled")
            .reduce((sum, coin) => sum + coin.value, 0);
        preconfirmed = vtxos
            .filter((coin) => coin.virtualStatus.state === "preconfirmed")
            .reduce((sum, coin) => sum + coin.value, 0);
        recoverable = vtxos
            .filter((coin) => isSpendable(coin) && coin.virtualStatus.state === "swept")
            .reduce((sum, coin) => sum + coin.value, 0);
        const totalBoarding = confirmed + unconfirmed;
        const totalOffchain = settled + preconfirmed + recoverable;
        return {
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
        };
    }
    async getVtxos(filter) {
        const spendableVtxos = await this.getVirtualCoins(filter);
        const encodedOffchainTapscript = this.offchainTapscript.encode();
        const forfeit = this.offchainTapscript.forfeit();
        const exit = this.offchainTapscript.exit();
        return spendableVtxos.map((vtxo) => ({
            ...vtxo,
            forfeitTapLeafScript: forfeit,
            intentTapLeafScript: exit,
            tapTree: encodedOffchainTapscript,
        }));
    }
    async getVirtualCoins(filter = { withRecoverable: true, withUnrolled: false }) {
        const scripts = [hex.encode(this.offchainTapscript.pkScript)];
        const response = await this.indexerProvider.getVtxos({
            scripts,
            spendableOnly: true,
        });
        const vtxos = response.vtxos;
        if (filter.withRecoverable) {
            const response = await this.indexerProvider.getVtxos({
                scripts,
                recoverableOnly: true,
            });
            vtxos.push(...response.vtxos);
        }
        if (filter.withUnrolled) {
            const response = await this.indexerProvider.getVtxos({
                scripts,
                spentOnly: true,
            });
            vtxos.push(...response.vtxos.filter((vtxo) => vtxo.isUnrolled));
        }
        return vtxos;
    }
    async getTransactionHistory() {
        if (!this.indexerProvider) {
            return [];
        }
        const response = await this.indexerProvider.getVtxos({
            scripts: [hex.encode(this.offchainTapscript.pkScript)],
        });
        const { boardingTxs, commitmentsToIgnore } = await this.getBoardingTxs();
        const spendableVtxos = [];
        const spentVtxos = [];
        for (const vtxo of response.vtxos) {
            if (isSpendable(vtxo)) {
                spendableVtxos.push(vtxo);
            }
            else {
                spentVtxos.push(vtxo);
            }
        }
        // convert VTXOs to offchain transactions
        const offchainTxs = vtxosToTxs(spendableVtxos, spentVtxos, commitmentsToIgnore);
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
        return txs;
    }
    async getBoardingTxs() {
        const boardingAddress = await this.getBoardingAddress();
        const txs = await this.onchainProvider.getTransactions(boardingAddress);
        const utxos = [];
        const commitmentsToIgnore = new Set();
        for (const tx of txs) {
            for (let i = 0; i < tx.vout.length; i++) {
                const vout = tx.vout[i];
                if (vout.scriptpubkey_address === boardingAddress) {
                    const spentStatuses = await this.onchainProvider.getTxOutspends(tx.txid);
                    const spentStatus = spentStatuses[i];
                    if (spentStatus?.spent) {
                        commitmentsToIgnore.add(spentStatus.txid);
                    }
                    utxos.push({
                        txid: tx.txid,
                        vout: i,
                        value: Number(vout.value),
                        status: {
                            confirmed: tx.status.confirmed,
                            block_time: tx.status.block_time,
                        },
                        isUnrolled: true,
                        virtualStatus: {
                            state: spentStatus?.spent ? "spent" : "settled",
                            commitmentTxIds: spentStatus?.spent
                                ? [spentStatus.txid]
                                : undefined,
                        },
                        createdAt: tx.status.confirmed
                            ? new Date(tx.status.block_time * 1000)
                            : new Date(0),
                    });
                }
            }
        }
        const unconfirmedTxs = [];
        const confirmedTxs = [];
        for (const utxo of utxos) {
            const tx = {
                key: {
                    boardingTxid: utxo.txid,
                    commitmentTxid: "",
                    arkTxid: "",
                },
                amount: utxo.value,
                type: TxType.TxReceived,
                settled: utxo.virtualStatus.state === "spent",
                createdAt: utxo.status.block_time
                    ? new Date(utxo.status.block_time * 1000).getTime()
                    : 0,
            };
            if (!utxo.status.block_time) {
                unconfirmedTxs.push(tx);
            }
            else {
                confirmedTxs.push(tx);
            }
        }
        return {
            boardingTxs: [...unconfirmedTxs, ...confirmedTxs],
            commitmentsToIgnore,
        };
    }
    async getBoardingUtxos() {
        const boardingAddress = await this.getBoardingAddress();
        const boardingUtxos = await this.onchainProvider.getCoins(boardingAddress);
        const encodedBoardingTapscript = this.boardingTapscript.encode();
        const forfeit = this.boardingTapscript.forfeit();
        const exit = this.boardingTapscript.exit();
        return boardingUtxos.map((utxo) => ({
            ...utxo,
            forfeitTapLeafScript: forfeit,
            intentTapLeafScript: exit,
            tapTree: encodedBoardingTapscript,
        }));
    }
    async sendBitcoin(params) {
        if (params.amount <= 0) {
            throw new Error("Amount must be positive");
        }
        if (!isValidArkAddress(params.address)) {
            throw new Error("Invalid Ark address " + params.address);
        }
        // recoverable and subdust coins can't be spent in offchain tx
        const virtualCoins = await this.getVirtualCoins({
            withRecoverable: false,
        });
        const selected = selectVirtualCoins(virtualCoins, params.amount);
        const selectedLeaf = this.offchainTapscript.forfeit();
        if (!selectedLeaf) {
            throw new Error("Selected leaf not found");
        }
        const outputAddress = ArkAddress.decode(params.address);
        const outputScript = BigInt(params.amount) < this.dustAmount
            ? outputAddress.subdustPkScript
            : outputAddress.pkScript;
        const outputs = [
            {
                script: outputScript,
                amount: BigInt(params.amount),
            },
        ];
        // add change output if needed
        if (selected.changeAmount > 0n) {
            const changeOutputScript = selected.changeAmount < this.dustAmount
                ? this.arkAddress.subdustPkScript
                : this.arkAddress.pkScript;
            outputs.push({
                script: changeOutputScript,
                amount: BigInt(selected.changeAmount),
            });
        }
        const tapTree = this.offchainTapscript.encode();
        let offchainTx = buildOffchainTx(selected.inputs.map((input) => ({
            ...input,
            tapLeafScript: selectedLeaf,
            tapTree,
        })), outputs, this.serverUnrollScript);
        const signedVirtualTx = await this.identity.sign(offchainTx.arkTx);
        const { arkTxid, signedCheckpointTxs } = await this.arkProvider.submitTx(base64.encode(signedVirtualTx.toPSBT()), offchainTx.checkpoints.map((c) => base64.encode(c.toPSBT())));
        // TODO persist final virtual tx and checkpoints to repository
        // sign the checkpoints
        const finalCheckpoints = await Promise.all(signedCheckpointTxs.map(async (c) => {
            const tx = Transaction.fromPSBT(base64.decode(c));
            const signedCheckpoint = await this.identity.sign(tx);
            return base64.encode(signedCheckpoint.toPSBT());
        }));
        await this.arkProvider.finalizeTx(arkTxid, finalCheckpoints);
        return arkTxid;
    }
    async settle(params, eventCallback) {
        if (params?.inputs) {
            for (const input of params.inputs) {
                // validate arknotes inputs
                if (typeof input === "string") {
                    try {
                        ArkNote.fromString(input);
                    }
                    catch (e) {
                        throw new Error(`Invalid arknote "${input}"`);
                    }
                }
            }
        }
        // if no params are provided, use all boarding and offchain utxos as inputs
        // and send all to the offchain address
        if (!params) {
            let amount = 0;
            const boardingUtxos = await this.getBoardingUtxos();
            amount += boardingUtxos.reduce((sum, input) => sum + input.value, 0);
            const vtxos = await this.getVtxos();
            amount += vtxos.reduce((sum, input) => sum + input.value, 0);
            const inputs = [...boardingUtxos, ...vtxos];
            if (inputs.length === 0) {
                throw new Error("No inputs found");
            }
            params = {
                inputs,
                outputs: [
                    {
                        address: await this.getAddress(),
                        amount: BigInt(amount),
                    },
                ],
            };
        }
        const onchainOutputIndexes = [];
        const outputs = [];
        let hasOffchainOutputs = false;
        for (const [index, output] of params.outputs.entries()) {
            let script;
            try {
                // offchain
                const addr = ArkAddress.decode(output.address);
                script = addr.pkScript;
                hasOffchainOutputs = true;
            }
            catch {
                // onchain
                const addr = Address(this.network).decode(output.address);
                script = OutScript.encode(addr);
                onchainOutputIndexes.push(index);
            }
            outputs.push({
                amount: output.amount,
                script,
            });
        }
        // session holds the state of the musig2 signing process of the vtxo tree
        let session;
        const signingPublicKeys = [];
        if (hasOffchainOutputs) {
            session = this.identity.signerSession();
            signingPublicKeys.push(hex.encode(session.getPublicKey()));
        }
        const [intent, deleteIntent] = await Promise.all([
            this.makeRegisterIntentSignature(params.inputs, outputs, onchainOutputIndexes, signingPublicKeys),
            this.makeDeleteIntentSignature(params.inputs),
        ]);
        const intentId = await this.arkProvider.registerIntent(intent);
        const abortController = new AbortController();
        // listen to settlement events
        try {
            let step;
            const topics = [
                ...signingPublicKeys,
                ...params.inputs.map((input) => `${input.txid}:${input.vout}`),
            ];
            const settlementStream = this.arkProvider.getEventStream(abortController.signal, topics);
            // roundId, sweepTapTreeRoot and forfeitOutputScript are set once the BatchStarted event is received
            let roundId;
            let sweepTapTreeRoot;
            const vtxoChunks = [];
            const connectorsChunks = [];
            let vtxoGraph;
            let connectorsGraph;
            for await (const event of settlementStream) {
                if (eventCallback) {
                    eventCallback(event);
                }
                switch (event.type) {
                    // the settlement failed
                    case SettlementEventType.BatchFailed:
                        // fail if the roundId is the one joined
                        if (event.id === roundId) {
                            throw new Error(event.reason);
                        }
                        break;
                    case SettlementEventType.BatchStarted:
                        if (step !== undefined) {
                            continue;
                        }
                        const res = await this.handleBatchStartedEvent(event, intentId, this.arkServerPublicKey, this.forfeitOutputScript);
                        if (!res.skip) {
                            step = event.type;
                            sweepTapTreeRoot = res.sweepTapTreeRoot;
                            roundId = res.roundId;
                            if (!hasOffchainOutputs) {
                                // if there are no offchain outputs, we don't have to handle musig2 tree signatures
                                // we can directly advance to the finalization step
                                step = SettlementEventType.TreeNoncesAggregated;
                            }
                        }
                        break;
                    case SettlementEventType.TreeTx:
                        if (step !== SettlementEventType.BatchStarted &&
                            step !== SettlementEventType.TreeNoncesAggregated) {
                            continue;
                        }
                        // index 0 = vtxo tree
                        if (event.batchIndex === 0) {
                            vtxoChunks.push(event.chunk);
                            // index 1 = connectors tree
                        }
                        else if (event.batchIndex === 1) {
                            connectorsChunks.push(event.chunk);
                        }
                        else {
                            throw new Error(`Invalid batch index: ${event.batchIndex}`);
                        }
                        break;
                    case SettlementEventType.TreeSignature:
                        if (step !== SettlementEventType.TreeNoncesAggregated) {
                            continue;
                        }
                        if (!hasOffchainOutputs) {
                            continue;
                        }
                        if (!vtxoGraph) {
                            throw new Error("Vtxo graph not set, something went wrong");
                        }
                        // index 0 = vtxo graph
                        if (event.batchIndex === 0) {
                            const tapKeySig = hex.decode(event.signature);
                            vtxoGraph.update(event.txid, (tx) => {
                                tx.updateInput(0, {
                                    tapKeySig,
                                });
                            });
                        }
                        break;
                    // the server has started the signing process of the vtxo tree transactions
                    // the server expects the partial musig2 nonces for each tx
                    case SettlementEventType.TreeSigningStarted:
                        if (step !== SettlementEventType.BatchStarted) {
                            continue;
                        }
                        if (hasOffchainOutputs) {
                            if (!session) {
                                throw new Error("Signing session not set");
                            }
                            if (!sweepTapTreeRoot) {
                                throw new Error("Sweep tap tree root not set");
                            }
                            if (vtxoChunks.length === 0) {
                                throw new Error("unsigned vtxo graph not received");
                            }
                            vtxoGraph = TxTree.create(vtxoChunks);
                            await this.handleSettlementSigningEvent(event, sweepTapTreeRoot, session, vtxoGraph);
                        }
                        step = event.type;
                        break;
                    // the musig2 nonces of the vtxo tree transactions are generated
                    // the server expects now the partial musig2 signatures
                    case SettlementEventType.TreeNoncesAggregated:
                        if (step !== SettlementEventType.TreeSigningStarted) {
                            continue;
                        }
                        if (hasOffchainOutputs) {
                            if (!session) {
                                throw new Error("Signing session not set");
                            }
                            await this.handleSettlementSigningNoncesGeneratedEvent(event, session);
                        }
                        step = event.type;
                        break;
                    // the vtxo tree is signed, craft, sign and submit forfeit transactions
                    // if any boarding utxos are involved, the settlement tx is also signed
                    case SettlementEventType.BatchFinalization:
                        if (step !== SettlementEventType.TreeNoncesAggregated) {
                            continue;
                        }
                        if (!this.forfeitOutputScript) {
                            throw new Error("Forfeit output script not set");
                        }
                        if (connectorsChunks.length > 0) {
                            connectorsGraph = TxTree.create(connectorsChunks);
                            validateConnectorsTxGraph(event.commitmentTx, connectorsGraph);
                        }
                        await this.handleSettlementFinalizationEvent(event, params.inputs, this.forfeitOutputScript, connectorsGraph);
                        step = event.type;
                        break;
                    // the settlement is done, last event to be received
                    case SettlementEventType.BatchFinalized:
                        if (step !== SettlementEventType.BatchFinalization) {
                            continue;
                        }
                        abortController.abort();
                        return event.commitmentTxid;
                }
            }
        }
        catch (error) {
            // close the stream
            abortController.abort();
            try {
                // delete the intent to not be stuck in the queue
                await this.arkProvider.deleteIntent(deleteIntent);
            }
            catch { }
            throw error;
        }
        throw new Error("Settlement failed");
    }
    async notifyIncomingFunds(eventCallback) {
        const arkAddress = await this.getAddress();
        const boardingAddress = await this.getBoardingAddress();
        let onchainStopFunc;
        let indexerStopFunc;
        if (this.onchainProvider && boardingAddress) {
            onchainStopFunc = await this.onchainProvider.watchAddresses([boardingAddress], (txs) => {
                const coins = txs
                    .map((tx) => {
                    const vout = tx.vout.findIndex((v) => v.scriptpubkey_address === boardingAddress);
                    if (vout === -1) {
                        console.warn(`No vout found for address ${boardingAddress} in transaction ${tx.txid}`);
                        return null;
                    }
                    return {
                        txid: tx.txid,
                        vout,
                        value: Number(tx.vout[vout].value),
                        status: tx.status,
                    };
                })
                    .filter((coin) => coin !== null);
                eventCallback({
                    type: "utxo",
                    coins,
                });
            });
        }
        if (this.indexerProvider && arkAddress) {
            const offchainScript = this.offchainTapscript;
            const subscriptionId = await this.indexerProvider.subscribeForScripts([
                hex.encode(offchainScript.pkScript),
            ]);
            const abortController = new AbortController();
            const subscription = this.indexerProvider.getSubscription(subscriptionId, abortController.signal);
            indexerStopFunc = async () => {
                abortController.abort();
                await this.indexerProvider?.unsubscribeForScripts(subscriptionId);
            };
            // Handle subscription updates asynchronously without blocking
            (async () => {
                try {
                    for await (const update of subscription) {
                        if (update.newVtxos?.length > 0) {
                            eventCallback({
                                type: "vtxo",
                                vtxos: update.newVtxos,
                            });
                        }
                    }
                }
                catch (error) {
                    console.error("Subscription error:", error);
                }
            })();
        }
        const stopFunc = () => {
            onchainStopFunc?.();
            indexerStopFunc?.();
        };
        return stopFunc;
    }
    async handleBatchStartedEvent(event, intentId, serverPubKey, forfeitOutputScript) {
        const utf8IntentId = new TextEncoder().encode(intentId);
        const intentIdHash = sha256(utf8IntentId);
        const intentIdHashStr = hex.encode(new Uint8Array(intentIdHash));
        let skip = true;
        // check if our intent ID hash matches any in the event
        for (const idHash of event.intentIdHashes) {
            if (idHash === intentIdHashStr) {
                if (!this.arkProvider) {
                    throw new Error("Ark provider not configured");
                }
                await this.arkProvider.confirmRegistration(intentId);
                skip = false;
            }
        }
        if (skip) {
            return { skip };
        }
        const sweepTapscript = CSVMultisigTapscript.encode({
            timelock: {
                value: event.batchExpiry,
                type: event.batchExpiry >= 512n ? "seconds" : "blocks",
            },
            pubkeys: [serverPubKey],
        }).script;
        const sweepTapTreeRoot = tapLeafHash(sweepTapscript);
        return {
            roundId: event.id,
            sweepTapTreeRoot,
            forfeitOutputScript,
            skip: false,
        };
    }
    // validates the vtxo tree, creates a signing session and generates the musig2 nonces
    async handleSettlementSigningEvent(event, sweepTapTreeRoot, session, vtxoGraph) {
        // validate the unsigned vtxo tree
        const commitmentTx = Transaction.fromPSBT(base64.decode(event.unsignedCommitmentTx));
        validateVtxoTxGraph(vtxoGraph, commitmentTx, sweepTapTreeRoot);
        // TODO check if our registered outputs are in the vtxo tree
        const sharedOutput = commitmentTx.getOutput(0);
        if (!sharedOutput?.amount) {
            throw new Error("Shared output not found");
        }
        session.init(vtxoGraph, sweepTapTreeRoot, sharedOutput.amount);
        await this.arkProvider.submitTreeNonces(event.id, hex.encode(session.getPublicKey()), session.getNonces());
    }
    async handleSettlementSigningNoncesGeneratedEvent(event, session) {
        session.setAggregatedNonces(event.treeNonces);
        const signatures = session.sign();
        await this.arkProvider.submitTreeSignatures(event.id, hex.encode(session.getPublicKey()), signatures);
    }
    async handleSettlementFinalizationEvent(event, inputs, forfeitOutputScript, connectorsGraph) {
        // the signed forfeits transactions to submit
        const signedForfeits = [];
        const vtxos = await this.getVirtualCoins();
        let settlementPsbt = Transaction.fromPSBT(base64.decode(event.commitmentTx));
        let hasBoardingUtxos = false;
        let connectorIndex = 0;
        const connectorsLeaves = connectorsGraph?.leaves() || [];
        for (const input of inputs) {
            // check if the input is an offchain "virtual" coin
            const vtxo = vtxos.find((vtxo) => vtxo.txid === input.txid && vtxo.vout === input.vout);
            // boarding utxo, we need to sign the settlement tx
            if (!vtxo) {
                hasBoardingUtxos = true;
                const inputIndexes = [];
                for (let i = 0; i < settlementPsbt.inputsLength; i++) {
                    const settlementInput = settlementPsbt.getInput(i);
                    if (!settlementInput.txid ||
                        settlementInput.index === undefined) {
                        throw new Error("The server returned incomplete data. No settlement input found in the PSBT");
                    }
                    const inputTxId = hex.encode(settlementInput.txid);
                    if (inputTxId !== input.txid)
                        continue;
                    if (settlementInput.index !== input.vout)
                        continue;
                    // input found in the settlement tx, sign it
                    settlementPsbt.updateInput(i, {
                        tapLeafScript: [input.forfeitTapLeafScript],
                    });
                    inputIndexes.push(i);
                }
                settlementPsbt = await this.identity.sign(settlementPsbt, inputIndexes);
                continue;
            }
            if (isRecoverable(vtxo) || isSubdust(vtxo, this.dustAmount)) {
                // recoverable or subdust coin, we don't need to create a forfeit tx
                continue;
            }
            if (connectorsLeaves.length === 0) {
                throw new Error("connectors not received");
            }
            if (connectorIndex >= connectorsLeaves.length) {
                throw new Error("not enough connectors received");
            }
            const connectorLeaf = connectorsLeaves[connectorIndex];
            const connectorTxId = hex.encode(sha256x2(connectorLeaf.toBytes(true)).reverse());
            const connectorOutput = connectorLeaf.getOutput(0);
            if (!connectorOutput) {
                throw new Error("connector output not found");
            }
            const connectorAmount = connectorOutput.amount;
            const connectorPkScript = connectorOutput.script;
            if (!connectorAmount || !connectorPkScript) {
                throw new Error("invalid connector output");
            }
            connectorIndex++;
            let forfeitTx = buildForfeitTx([
                {
                    txid: input.txid,
                    index: input.vout,
                    witnessUtxo: {
                        amount: BigInt(vtxo.value),
                        script: VtxoScript.decode(input.tapTree).pkScript,
                    },
                    sighashType: SigHash.DEFAULT,
                    tapLeafScript: [input.forfeitTapLeafScript],
                },
                {
                    txid: connectorTxId,
                    index: 0,
                    witnessUtxo: {
                        amount: connectorAmount,
                        script: connectorPkScript,
                    },
                },
            ], forfeitOutputScript);
            // do not sign the connector input
            forfeitTx = await this.identity.sign(forfeitTx, [0]);
            signedForfeits.push(base64.encode(forfeitTx.toPSBT()));
        }
        if (signedForfeits.length > 0 || hasBoardingUtxos) {
            await this.arkProvider.submitSignedForfeitTxs(signedForfeits, hasBoardingUtxos
                ? base64.encode(settlementPsbt.toPSBT())
                : undefined);
        }
    }
    async makeRegisterIntentSignature(bip322Inputs, outputs, onchainOutputsIndexes, cosignerPubKeys) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const { inputs, inputTapTrees, finalizer } = this.prepareBIP322Inputs(bip322Inputs);
        const message = {
            type: "register",
            input_tap_trees: inputTapTrees,
            onchain_output_indexes: onchainOutputsIndexes,
            valid_at: nowSeconds,
            expire_at: nowSeconds + 2 * 60, // valid for 2 minutes
            cosigners_public_keys: cosignerPubKeys,
        };
        const encodedMessage = JSON.stringify(message, null, 0);
        const signature = await this.makeBIP322Signature(encodedMessage, inputs, finalizer, outputs);
        return {
            signature,
            message: encodedMessage,
        };
    }
    async makeDeleteIntentSignature(bip322Inputs) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const { inputs, finalizer } = this.prepareBIP322Inputs(bip322Inputs);
        const message = {
            type: "delete",
            expire_at: nowSeconds + 2 * 60, // valid for 2 minutes
        };
        const encodedMessage = JSON.stringify(message, null, 0);
        const signature = await this.makeBIP322Signature(encodedMessage, inputs, finalizer);
        return {
            signature,
            message: encodedMessage,
        };
    }
    prepareBIP322Inputs(bip322Inputs) {
        const inputs = [];
        const inputTapTrees = [];
        const inputExtraWitnesses = [];
        for (const bip322Input of bip322Inputs) {
            const vtxoScript = VtxoScript.decode(bip322Input.tapTree);
            const sequence = getSequence(bip322Input);
            inputs.push({
                txid: hex.decode(bip322Input.txid),
                index: bip322Input.vout,
                witnessUtxo: {
                    amount: BigInt(bip322Input.value),
                    script: vtxoScript.pkScript,
                },
                sequence,
                tapLeafScript: [bip322Input.intentTapLeafScript],
            });
            inputTapTrees.push(hex.encode(bip322Input.tapTree));
            inputExtraWitnesses.push(bip322Input.extraWitness || []);
        }
        return {
            inputs,
            inputTapTrees,
            finalizer: finalizeWithExtraWitnesses(inputExtraWitnesses),
        };
    }
    async makeBIP322Signature(message, inputs, finalizer, outputs) {
        const proof = BIP322.create(message, inputs, outputs);
        const signedProof = await this.identity.sign(proof);
        return BIP322.signature(signedProof, finalizer);
    }
}
Wallet.MIN_FEE_RATE = 1; // sats/vbyte
function finalizeWithExtraWitnesses(inputExtraWitnesses) {
    return function (tx) {
        for (let i = 0; i < tx.inputsLength; i++) {
            try {
                tx.finalizeIdx(i);
            }
            catch (e) {
                // handle empty witness error
                if (e instanceof Error &&
                    e.message.includes("finalize/taproot: empty witness")) {
                    const tapLeaves = tx.getInput(i).tapLeafScript;
                    if (!tapLeaves || tapLeaves.length <= 0)
                        throw e;
                    const [cb, s] = tapLeaves[0];
                    const script = s.slice(0, -1);
                    tx.updateInput(i, {
                        finalScriptWitness: [
                            script,
                            TaprootControlBlock.encode(cb),
                        ],
                    });
                }
            }
            const finalScriptWitness = tx.getInput(i).finalScriptWitness;
            if (!finalScriptWitness)
                throw new Error("input not finalized");
            // input 0 and 1 spend the same pkscript
            const extra = inputExtraWitnesses[i === 0 ? 0 : i - 1];
            if (extra && extra.length > 0) {
                tx.updateInput(i, {
                    finalScriptWitness: [...extra, ...finalScriptWitness],
                });
            }
        }
    };
}
function getSequence(bip322Input) {
    let sequence = undefined;
    try {
        const scriptWithLeafVersion = bip322Input.intentTapLeafScript[1];
        const script = scriptWithLeafVersion.subarray(0, scriptWithLeafVersion.length - 1);
        const params = CSVMultisigTapscript.decode(script).params;
        sequence = bip68.encode(params.timelock.type === "blocks"
            ? { blocks: Number(params.timelock.value) }
            : { seconds: Number(params.timelock.value) });
    }
    catch { }
    return sequence;
}
function isValidArkAddress(address) {
    try {
        ArkAddress.decode(address);
        return true;
    }
    catch (e) {
        return false;
    }
}
/**
 * Select virtual coins to reach a target amount, prioritizing those closer to expiry
 * @param coins List of virtual coins to select from
 * @param targetAmount Target amount to reach in satoshis
 * @returns Selected coins and change amount
 */
function selectVirtualCoins(coins, targetAmount) {
    // Sort VTXOs by expiry (ascending) and amount (descending)
    const sortedCoins = [...coins].sort((a, b) => {
        // First sort by expiry if available
        const expiryA = a.virtualStatus.batchExpiry || Number.MAX_SAFE_INTEGER;
        const expiryB = b.virtualStatus.batchExpiry || Number.MAX_SAFE_INTEGER;
        if (expiryA !== expiryB) {
            return expiryA - expiryB; // Earlier expiry first
        }
        // Then sort by amount
        return b.value - a.value; // Larger amount first
    });
    const selectedCoins = [];
    let selectedAmount = 0;
    // Select coins until we have enough
    for (const coin of sortedCoins) {
        selectedCoins.push(coin);
        selectedAmount += coin.value;
        if (selectedAmount >= targetAmount) {
            break;
        }
    }
    if (selectedAmount === targetAmount) {
        return { inputs: selectedCoins, changeAmount: 0n };
    }
    // Check if we have enough
    if (selectedAmount < targetAmount) {
        throw new Error("Insufficient funds");
    }
    const changeAmount = BigInt(selectedAmount - targetAmount);
    return {
        inputs: selectedCoins,
        changeAmount,
    };
}
/**
 * Wait for incoming funds to the wallet
 * @param wallet - The wallet to wait for incoming funds
 * @returns A promise that resolves the next new coins received by the wallet's address
 */
export async function waitForIncomingFunds(wallet) {
    let stopFunc;
    const promise = new Promise((resolve) => {
        wallet
            .notifyIncomingFunds((coins) => {
            resolve(coins);
            if (stopFunc)
                stopFunc();
        })
            .then((stop) => {
            stopFunc = stop;
        });
    });
    return promise;
}
