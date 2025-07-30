"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VtxoScript = void 0;
exports.scriptFromTapLeafScript = scriptFromTapLeafScript;
const payment_1 = require("@scure/btc-signer/payment");
const utils_1 = require("@scure/btc-signer/utils");
const address_1 = require("./address");
const btc_signer_1 = require("@scure/btc-signer");
const base_1 = require("@scure/base");
const tapscript_1 = require("./tapscript");
function scriptFromTapLeafScript(leaf) {
    return leaf[1].subarray(0, leaf[1].length - 1); // remove the version byte
}
/**
 * VtxoScript is a script that contains a list of tapleaf scripts.
 * It is used to create vtxo scripts.
 *
 * @example
 * ```typescript
 * const vtxoScript = new VtxoScript([new Uint8Array(32), new Uint8Array(32)]);
 */
class VtxoScript {
    static decode(tapTree) {
        const leaves = decodeTaprootTree(tapTree);
        return new VtxoScript(leaves);
    }
    constructor(scripts) {
        this.scripts = scripts;
        const tapTree = (0, payment_1.taprootListToTree)(scripts.map((script) => ({ script, leafVersion: payment_1.TAP_LEAF_VERSION })));
        const payment = (0, payment_1.p2tr)(utils_1.TAPROOT_UNSPENDABLE_KEY, tapTree, undefined, true);
        if (!payment.tapLeafScript ||
            payment.tapLeafScript.length !== scripts.length) {
            throw new Error("invalid scripts");
        }
        this.leaves = payment.tapLeafScript;
        this.tweakedPublicKey = payment.tweakedPubkey;
    }
    encode() {
        const tapTree = encodeTaprootTree(this.scripts);
        return tapTree;
    }
    address(prefix, serverPubKey) {
        return new address_1.ArkAddress(serverPubKey, this.tweakedPublicKey, prefix);
    }
    get pkScript() {
        return btc_signer_1.Script.encode(["OP_1", this.tweakedPublicKey]);
    }
    onchainAddress(network) {
        return (0, payment_1.Address)(network).encode({
            type: "tr",
            pubkey: this.tweakedPublicKey,
        });
    }
    findLeaf(scriptHex) {
        const leaf = this.leaves.find((leaf) => base_1.hex.encode(scriptFromTapLeafScript(leaf)) === scriptHex);
        if (!leaf) {
            throw new Error(`leaf '${scriptHex}' not found`);
        }
        return leaf;
    }
    exitPaths() {
        const paths = [];
        for (const leaf of this.leaves) {
            try {
                const tapscript = tapscript_1.CSVMultisigTapscript.decode(scriptFromTapLeafScript(leaf));
                paths.push(tapscript);
                continue;
            }
            catch (e) {
                try {
                    const tapscript = tapscript_1.ConditionCSVMultisigTapscript.decode(scriptFromTapLeafScript(leaf));
                    paths.push(tapscript);
                }
                catch (e) {
                    continue;
                }
            }
        }
        return paths;
    }
}
exports.VtxoScript = VtxoScript;
function decodeTaprootTree(tapTree) {
    let offset = 0;
    const scripts = [];
    // Read number of leaves
    const [numLeaves, numLeavesSize] = decodeCompactSizeUint(tapTree, offset);
    offset += numLeavesSize;
    // Read each leaf
    for (let i = 0; i < numLeaves; i++) {
        // Skip depth (1 byte)
        offset += 1;
        // Skip leaf version (1 byte)
        offset += 1;
        // Read script length
        const [scriptLength, scriptLengthSize] = decodeCompactSizeUint(tapTree, offset);
        offset += scriptLengthSize;
        // Read script content
        const script = tapTree.slice(offset, offset + scriptLength);
        scripts.push(script);
        offset += scriptLength;
    }
    return scripts;
}
function decodeCompactSizeUint(data, offset) {
    const firstByte = data[offset];
    if (firstByte < 0xfd) {
        return [firstByte, 1];
    }
    else if (firstByte === 0xfd) {
        const value = new DataView(data.buffer).getUint16(offset + 1, true);
        return [value, 3];
    }
    else if (firstByte === 0xfe) {
        const value = new DataView(data.buffer).getUint32(offset + 1, true);
        return [value, 5];
    }
    else {
        const value = Number(new DataView(data.buffer).getBigUint64(offset + 1, true));
        return [value, 9];
    }
}
function encodeTaprootTree(leaves) {
    const chunks = [];
    // Write number of leaves as compact size uint
    chunks.push(encodeCompactSizeUint(leaves.length));
    for (const tapscript of leaves) {
        // Write depth (always 1 for now)
        chunks.push(new Uint8Array([1]));
        // Write leaf version (0xc0 for tapscript)
        chunks.push(new Uint8Array([0xc0]));
        // Write script length and script
        chunks.push(encodeCompactSizeUint(tapscript.length));
        chunks.push(tapscript);
    }
    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}
function encodeCompactSizeUint(value) {
    if (value < 0xfd) {
        return new Uint8Array([value]);
    }
    else if (value <= 0xffff) {
        const buffer = new Uint8Array(3);
        buffer[0] = 0xfd;
        new DataView(buffer.buffer).setUint16(1, value, true);
        return buffer;
    }
    else if (value <= 0xffffffff) {
        const buffer = new Uint8Array(5);
        buffer[0] = 0xfe;
        new DataView(buffer.buffer).setUint32(1, value, true);
        return buffer;
    }
    else {
        const buffer = new Uint8Array(9);
        buffer[0] = 0xff;
        new DataView(buffer.buffer).setBigUint64(1, BigInt(value), true);
        return buffer;
    }
}
