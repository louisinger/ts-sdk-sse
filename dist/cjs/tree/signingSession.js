"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeSignerSession = exports.ErrMissingAggregateKey = exports.ErrMissingVtxoGraph = void 0;
exports.validateTreeSigs = validateTreeSigs;
const musig2 = __importStar(require("../musig2"));
const btc_signer_1 = require("@scure/btc-signer");
const base_1 = require("@scure/base");
const secp256k1_1 = require("@noble/curves/secp256k1");
const utils_1 = require("@scure/btc-signer/utils");
const unknownFields_1 = require("../utils/unknownFields");
exports.ErrMissingVtxoGraph = new Error("missing vtxo graph");
exports.ErrMissingAggregateKey = new Error("missing aggregate key");
class TreeSignerSession {
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.myNonces = null;
        this.aggregateNonces = null;
        this.graph = null;
        this.scriptRoot = null;
        this.rootSharedOutputAmount = null;
    }
    static random() {
        const secretKey = (0, utils_1.randomPrivateKeyBytes)();
        return new TreeSignerSession(secretKey);
    }
    init(tree, scriptRoot, rootInputAmount) {
        this.graph = tree;
        this.scriptRoot = scriptRoot;
        this.rootSharedOutputAmount = rootInputAmount;
    }
    getPublicKey() {
        return secp256k1_1.secp256k1.getPublicKey(this.secretKey);
    }
    getNonces() {
        if (!this.graph)
            throw exports.ErrMissingVtxoGraph;
        if (!this.myNonces) {
            this.myNonces = this.generateNonces();
        }
        const publicNonces = new Map();
        for (const [txid, nonces] of this.myNonces) {
            publicNonces.set(txid, { pubNonce: nonces.pubNonce });
        }
        return publicNonces;
    }
    setAggregatedNonces(nonces) {
        if (this.aggregateNonces)
            throw new Error("nonces already set");
        this.aggregateNonces = nonces;
    }
    sign() {
        if (!this.graph)
            throw exports.ErrMissingVtxoGraph;
        if (!this.aggregateNonces)
            throw new Error("nonces not set");
        if (!this.myNonces)
            throw new Error("nonces not generated");
        const sigs = new Map();
        for (const g of this.graph) {
            const sig = this.signPartial(g);
            sigs.set(g.txid, sig);
        }
        return sigs;
    }
    generateNonces() {
        if (!this.graph)
            throw exports.ErrMissingVtxoGraph;
        const myNonces = new Map();
        const publicKey = secp256k1_1.secp256k1.getPublicKey(this.secretKey);
        for (const g of this.graph) {
            const nonces = musig2.generateNonces(publicKey);
            myNonces.set(g.txid, nonces);
        }
        return myNonces;
    }
    signPartial(g) {
        if (!this.graph || !this.scriptRoot || !this.rootSharedOutputAmount) {
            throw TreeSignerSession.NOT_INITIALIZED;
        }
        if (!this.myNonces || !this.aggregateNonces) {
            throw new Error("session not properly initialized");
        }
        const myNonce = this.myNonces.get(g.txid);
        if (!myNonce)
            throw new Error("missing private nonce");
        const aggNonce = this.aggregateNonces.get(g.txid);
        if (!aggNonce)
            throw new Error("missing aggregate nonce");
        const prevoutAmounts = [];
        const prevoutScripts = [];
        const cosigners = (0, unknownFields_1.getArkPsbtFields)(g.root, 0, unknownFields_1.CosignerPublicKey).map((c) => c.key);
        const { finalKey } = musig2.aggregateKeys(cosigners, true, {
            taprootTweak: this.scriptRoot,
        });
        for (let inputIndex = 0; inputIndex < g.root.inputsLength; inputIndex++) {
            const prevout = getPrevOutput(finalKey, this.graph, this.rootSharedOutputAmount, g.root);
            prevoutAmounts.push(prevout.amount);
            prevoutScripts.push(prevout.script);
        }
        const message = g.root.preimageWitnessV1(0, // always first input
        prevoutScripts, btc_signer_1.SigHash.DEFAULT, prevoutAmounts);
        return musig2.sign(myNonce.secNonce, this.secretKey, aggNonce.pubNonce, cosigners, message, {
            taprootTweak: this.scriptRoot,
            sortKeys: true,
        });
    }
}
exports.TreeSignerSession = TreeSignerSession;
TreeSignerSession.NOT_INITIALIZED = new Error("session not initialized, call init method");
// Helper function to validate tree signatures
async function validateTreeSigs(finalAggregatedKey, sharedOutputAmount, vtxoTree) {
    // Iterate through each level of the tree
    for (const g of vtxoTree) {
        // Parse the transaction
        const input = g.root.getInput(0);
        // Check if input has signature
        if (!input.tapKeySig) {
            throw new Error("unsigned tree input");
        }
        // Get the previous output information
        const prevout = getPrevOutput(finalAggregatedKey, vtxoTree, sharedOutputAmount, g.root);
        // Calculate the message that was signed
        const message = g.root.preimageWitnessV1(0, // always first input
        [prevout.script], btc_signer_1.SigHash.DEFAULT, [prevout.amount]);
        // Verify the signature
        const isValid = secp256k1_1.schnorr.verify(input.tapKeySig, message, finalAggregatedKey);
        if (!isValid) {
            throw new Error("invalid signature");
        }
    }
}
function getPrevOutput(finalKey, graph, sharedOutputAmount, tx) {
    // generate P2TR script from musig2 final key
    const pkScript = btc_signer_1.Script.encode(["OP_1", finalKey.slice(1)]);
    const txid = base_1.hex.encode((0, utils_1.sha256x2)(tx.toBytes(true)).reverse());
    // if the input is the root input, return the shared output amount
    if (txid === graph.txid) {
        return {
            amount: sharedOutputAmount,
            script: pkScript,
        };
    }
    // find the parent transaction
    const parentInput = tx.getInput(0);
    if (!parentInput.txid)
        throw new Error("missing parent input txid");
    const parentTxid = base_1.hex.encode(new Uint8Array(parentInput.txid));
    const parent = graph.find(parentTxid);
    if (!parent)
        throw new Error("parent  tx not found");
    if (parentInput.index === undefined)
        throw new Error("missing input index");
    const parentOutput = parent.root.getOutput(parentInput.index);
    if (!parentOutput)
        throw new Error("parent output not found");
    if (!parentOutput.amount)
        throw new Error("parent output amount not found");
    return {
        amount: parentOutput.amount,
        script: pkScript,
    };
}
