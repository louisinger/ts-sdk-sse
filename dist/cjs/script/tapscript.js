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
exports.CLTVMultisigTapscript = exports.ConditionMultisigTapscript = exports.ConditionCSVMultisigTapscript = exports.CSVMultisigTapscript = exports.MultisigTapscript = exports.TapscriptType = void 0;
exports.decodeTapscript = decodeTapscript;
const bip68 = __importStar(require("bip68"));
const script_1 = require("@scure/btc-signer/script");
const payment_1 = require("@scure/btc-signer/payment");
const base_1 = require("@scure/base");
const MinimalScriptNum = (0, script_1.ScriptNum)(undefined, true);
var TapscriptType;
(function (TapscriptType) {
    TapscriptType["Multisig"] = "multisig";
    TapscriptType["CSVMultisig"] = "csv-multisig";
    TapscriptType["ConditionCSVMultisig"] = "condition-csv-multisig";
    TapscriptType["ConditionMultisig"] = "condition-multisig";
    TapscriptType["CLTVMultisig"] = "cltv-multisig";
})(TapscriptType || (exports.TapscriptType = TapscriptType = {}));
/**
 * decodeTapscript is a function that decodes an ark tapsript from a raw script.
 *
 * @throws {Error} if the script is not a valid ark tapscript
 * @example
 * ```typescript
 * const arkTapscript = decodeTapscript(new Uint8Array(32));
 * console.log("type:", arkTapscript.type);
 * ```
 */
function decodeTapscript(script) {
    const types = [
        MultisigTapscript,
        CSVMultisigTapscript,
        ConditionCSVMultisigTapscript,
        ConditionMultisigTapscript,
        CLTVMultisigTapscript,
    ];
    for (const type of types) {
        try {
            return type.decode(script);
        }
        catch (error) {
            continue;
        }
    }
    throw new Error(`Failed to decode: script ${base_1.hex.encode(script)} is not a valid tapscript`);
}
/**
 * Implements a multi-signature tapscript.
 *
 * <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const multisigTapscript = MultisigTapscript.encode({ pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
var MultisigTapscript;
(function (MultisigTapscript) {
    let MultisigType;
    (function (MultisigType) {
        MultisigType[MultisigType["CHECKSIG"] = 0] = "CHECKSIG";
        MultisigType[MultisigType["CHECKSIGADD"] = 1] = "CHECKSIGADD";
    })(MultisigType = MultisigTapscript.MultisigType || (MultisigTapscript.MultisigType = {}));
    function encode(params) {
        if (params.pubkeys.length === 0) {
            throw new Error("At least 1 pubkey is required");
        }
        for (const pubkey of params.pubkeys) {
            if (pubkey.length !== 32) {
                throw new Error(`Invalid pubkey length: expected 32, got ${pubkey.length}`);
            }
        }
        if (!params.type) {
            params.type = MultisigType.CHECKSIG;
        }
        if (params.type === MultisigType.CHECKSIGADD) {
            return {
                type: TapscriptType.Multisig,
                params,
                script: (0, payment_1.p2tr_ms)(params.pubkeys.length, params.pubkeys).script,
            };
        }
        const asm = [];
        for (let i = 0; i < params.pubkeys.length; i++) {
            asm.push(params.pubkeys[i]);
            // CHECKSIGVERIFY except the last pubkey
            if (i < params.pubkeys.length - 1) {
                asm.push("CHECKSIGVERIFY");
            }
            else {
                asm.push("CHECKSIG");
            }
        }
        return {
            type: TapscriptType.Multisig,
            params,
            script: script_1.Script.encode(asm),
        };
    }
    MultisigTapscript.encode = encode;
    function decode(script) {
        if (script.length === 0) {
            throw new Error("Failed to decode: script is empty");
        }
        try {
            // Try decoding as checksigAdd first
            return decodeChecksigAdd(script);
        }
        catch (error) {
            // If checksigAdd fails, try regular checksig
            try {
                return decodeChecksig(script);
            }
            catch (error2) {
                throw new Error(`Failed to decode script: ${error2 instanceof Error ? error2.message : String(error2)}`);
            }
        }
    }
    MultisigTapscript.decode = decode;
    // <pubkey> CHECKSIG <pubkey> CHECKSIGADD <len_keys> NUMEQUAL
    function decodeChecksigAdd(script) {
        const asm = script_1.Script.decode(script);
        const pubkeys = [];
        let foundNumEqual = false;
        // Parse through ASM operations
        for (let i = 0; i < asm.length; i++) {
            const op = asm[i];
            // If it's a data push, it should be a 32-byte pubkey
            if (typeof op !== "string" && typeof op !== "number") {
                if (op.length !== 32) {
                    throw new Error(`Invalid pubkey length: expected 32, got ${op.length}`);
                }
                pubkeys.push(op);
                // Check next operation is CHECKSIGADD or CHECKSIG
                if (i + 1 >= asm.length ||
                    (asm[i + 1] !== "CHECKSIGADD" && asm[i + 1] !== "CHECKSIG")) {
                    throw new Error("Expected CHECKSIGADD or CHECKSIG after pubkey");
                }
                i++; // Skip the CHECKSIGADD op
                continue;
            }
            // Last operation should be NUMEQUAL
            if (i === asm.length - 1) {
                if (op !== "NUMEQUAL") {
                    throw new Error("Expected NUMEQUAL at end of script");
                }
                foundNumEqual = true;
            }
        }
        if (!foundNumEqual) {
            throw new Error("Missing NUMEQUAL operation");
        }
        if (pubkeys.length === 0) {
            throw new Error("Invalid script: must have at least 1 pubkey");
        }
        // Verify the script by re-encoding and comparing
        const reconstructed = encode({
            pubkeys,
            type: MultisigType.CHECKSIGADD,
        });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.Multisig,
            params: { pubkeys, type: MultisigType.CHECKSIGADD },
            script,
        };
    }
    // <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
    function decodeChecksig(script) {
        const asm = script_1.Script.decode(script);
        const pubkeys = [];
        // Parse through ASM operations
        for (let i = 0; i < asm.length; i++) {
            const op = asm[i];
            // If it's a data push, it should be a 32-byte pubkey
            if (typeof op !== "string" && typeof op !== "number") {
                if (op.length !== 32) {
                    throw new Error(`Invalid pubkey length: expected 32, got ${op.length}`);
                }
                pubkeys.push(op);
                // Check next operation
                if (i + 1 >= asm.length) {
                    throw new Error("Unexpected end of script");
                }
                const nextOp = asm[i + 1];
                if (nextOp !== "CHECKSIGVERIFY" && nextOp !== "CHECKSIG") {
                    throw new Error("Expected CHECKSIGVERIFY or CHECKSIG after pubkey");
                }
                // Last operation must be CHECKSIG, not CHECKSIGVERIFY
                if (i === asm.length - 2 && nextOp !== "CHECKSIG") {
                    throw new Error("Last operation must be CHECKSIG");
                }
                i++; // Skip the CHECKSIG/CHECKSIGVERIFY op
                continue;
            }
        }
        if (pubkeys.length === 0) {
            throw new Error("Invalid script: must have at least 1 pubkey");
        }
        // Verify the script by re-encoding and comparing
        const reconstructed = encode({ pubkeys, type: MultisigType.CHECKSIG });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.Multisig,
            params: { pubkeys, type: MultisigType.CHECKSIG },
            script,
        };
    }
    function is(tapscript) {
        return tapscript.type === TapscriptType.Multisig;
    }
    MultisigTapscript.is = is;
})(MultisigTapscript || (exports.MultisigTapscript = MultisigTapscript = {}));
/**
 * Implements a relative timelock script that requires all specified pubkeys to sign
 * after the relative timelock has expired. The timelock can be specified in blocks or seconds.
 *
 * This is the standard exit closure and it is also used for the sweep closure in vtxo trees.
 *
 * <sequence> CHECKSEQUENCEVERIFY DROP <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const csvMultisigTapscript = CSVMultisigTapscript.encode({ timelock: { type: "blocks", value: 144 }, pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
var CSVMultisigTapscript;
(function (CSVMultisigTapscript) {
    function encode(params) {
        for (const pubkey of params.pubkeys) {
            if (pubkey.length !== 32) {
                throw new Error(`Invalid pubkey length: expected 32, got ${pubkey.length}`);
            }
        }
        const sequence = MinimalScriptNum.encode(BigInt(bip68.encode(params.timelock.type === "blocks"
            ? { blocks: Number(params.timelock.value) }
            : { seconds: Number(params.timelock.value) })));
        const asm = [
            sequence.length === 1 ? sequence[0] : sequence,
            "CHECKSEQUENCEVERIFY",
            "DROP",
        ];
        const multisigScript = MultisigTapscript.encode(params);
        const script = new Uint8Array([
            ...script_1.Script.encode(asm),
            ...multisigScript.script,
        ]);
        return {
            type: TapscriptType.CSVMultisig,
            params,
            script,
        };
    }
    CSVMultisigTapscript.encode = encode;
    function decode(script) {
        if (script.length === 0) {
            throw new Error("Failed to decode: script is empty");
        }
        const asm = script_1.Script.decode(script);
        if (asm.length < 3) {
            throw new Error(`Invalid script: too short (expected at least 3)`);
        }
        const sequence = asm[0];
        if (typeof sequence === "string" || typeof sequence === "number") {
            throw new Error("Invalid script: expected sequence number");
        }
        if (asm[1] !== "CHECKSEQUENCEVERIFY" || asm[2] !== "DROP") {
            throw new Error("Invalid script: expected CHECKSEQUENCEVERIFY DROP");
        }
        const multisigScript = new Uint8Array(script_1.Script.encode(asm.slice(3)));
        let multisig;
        try {
            multisig = MultisigTapscript.decode(multisigScript);
        }
        catch (error) {
            throw new Error(`Invalid multisig script: ${error instanceof Error ? error.message : String(error)}`);
        }
        const sequenceNum = Number(MinimalScriptNum.decode(sequence));
        const decodedTimelock = bip68.decode(sequenceNum);
        const timelock = decodedTimelock.blocks !== undefined
            ? { type: "blocks", value: BigInt(decodedTimelock.blocks) }
            : { type: "seconds", value: BigInt(decodedTimelock.seconds) };
        const reconstructed = encode({
            timelock,
            ...multisig.params,
        });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.CSVMultisig,
            params: {
                timelock,
                ...multisig.params,
            },
            script,
        };
    }
    CSVMultisigTapscript.decode = decode;
    function is(tapscript) {
        return tapscript.type === TapscriptType.CSVMultisig;
    }
    CSVMultisigTapscript.is = is;
})(CSVMultisigTapscript || (exports.CSVMultisigTapscript = CSVMultisigTapscript = {}));
/**
 * Combines a condition script with an exit closure. The resulting script requires
 * the condition to be met, followed by the standard exit closure requirements
 * (timelock and signatures).
 *
 * <conditionScript> VERIFY <sequence> CHECKSEQUENCEVERIFY DROP <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const conditionCSVMultisigTapscript = ConditionCSVMultisigTapscript.encode({ conditionScript: new Uint8Array(32), pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
var ConditionCSVMultisigTapscript;
(function (ConditionCSVMultisigTapscript) {
    function encode(params) {
        const script = new Uint8Array([
            ...params.conditionScript,
            ...script_1.Script.encode(["VERIFY"]),
            ...CSVMultisigTapscript.encode(params).script,
        ]);
        return {
            type: TapscriptType.ConditionCSVMultisig,
            params,
            script,
        };
    }
    ConditionCSVMultisigTapscript.encode = encode;
    function decode(script) {
        if (script.length === 0) {
            throw new Error("Failed to decode: script is empty");
        }
        const asm = script_1.Script.decode(script);
        if (asm.length < 1) {
            throw new Error(`Invalid script: too short (expected at least 1)`);
        }
        let verifyIndex = -1;
        for (let i = asm.length - 1; i >= 0; i--) {
            if (asm[i] === "VERIFY") {
                verifyIndex = i;
            }
        }
        if (verifyIndex === -1) {
            throw new Error("Invalid script: missing VERIFY operation");
        }
        const conditionScript = new Uint8Array(script_1.Script.encode(asm.slice(0, verifyIndex)));
        const csvMultisigScript = new Uint8Array(script_1.Script.encode(asm.slice(verifyIndex + 1)));
        let csvMultisig;
        try {
            csvMultisig = CSVMultisigTapscript.decode(csvMultisigScript);
        }
        catch (error) {
            throw new Error(`Invalid CSV multisig script: ${error instanceof Error ? error.message : String(error)}`);
        }
        const reconstructed = encode({
            conditionScript,
            ...csvMultisig.params,
        });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.ConditionCSVMultisig,
            params: {
                conditionScript,
                ...csvMultisig.params,
            },
            script,
        };
    }
    ConditionCSVMultisigTapscript.decode = decode;
    function is(tapscript) {
        return tapscript.type === TapscriptType.ConditionCSVMultisig;
    }
    ConditionCSVMultisigTapscript.is = is;
})(ConditionCSVMultisigTapscript || (exports.ConditionCSVMultisigTapscript = ConditionCSVMultisigTapscript = {}));
/**
 * Combines a condition script with a forfeit closure. The resulting script requires
 * the condition to be met, followed by the standard forfeit closure requirements
 * (multi-signature).
 *
 * <conditionScript> VERIFY <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const conditionMultisigTapscript = ConditionMultisigTapscript.encode({ conditionScript: new Uint8Array(32), pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
var ConditionMultisigTapscript;
(function (ConditionMultisigTapscript) {
    function encode(params) {
        const script = new Uint8Array([
            ...params.conditionScript,
            ...script_1.Script.encode(["VERIFY"]),
            ...MultisigTapscript.encode(params).script,
        ]);
        return {
            type: TapscriptType.ConditionMultisig,
            params,
            script,
        };
    }
    ConditionMultisigTapscript.encode = encode;
    function decode(script) {
        if (script.length === 0) {
            throw new Error("Failed to decode: script is empty");
        }
        const asm = script_1.Script.decode(script);
        if (asm.length < 1) {
            throw new Error(`Invalid script: too short (expected at least 1)`);
        }
        let verifyIndex = -1;
        for (let i = asm.length - 1; i >= 0; i--) {
            if (asm[i] === "VERIFY") {
                verifyIndex = i;
            }
        }
        if (verifyIndex === -1) {
            throw new Error("Invalid script: missing VERIFY operation");
        }
        const conditionScript = new Uint8Array(script_1.Script.encode(asm.slice(0, verifyIndex)));
        const multisigScript = new Uint8Array(script_1.Script.encode(asm.slice(verifyIndex + 1)));
        let multisig;
        try {
            multisig = MultisigTapscript.decode(multisigScript);
        }
        catch (error) {
            throw new Error(`Invalid multisig script: ${error instanceof Error ? error.message : String(error)}`);
        }
        const reconstructed = encode({
            conditionScript,
            ...multisig.params,
        });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.ConditionMultisig,
            params: {
                conditionScript,
                ...multisig.params,
            },
            script,
        };
    }
    ConditionMultisigTapscript.decode = decode;
    function is(tapscript) {
        return tapscript.type === TapscriptType.ConditionMultisig;
    }
    ConditionMultisigTapscript.is = is;
})(ConditionMultisigTapscript || (exports.ConditionMultisigTapscript = ConditionMultisigTapscript = {}));
/**
 * Implements an absolute timelock (CLTV) script combined with a forfeit closure.
 * The script requires waiting until a specific block height/timestamp before the
 * forfeit closure conditions can be met.
 *
 * <locktime> CHECKLOCKTIMEVERIFY DROP <pubkey> CHECKSIGVERIFY <pubkey> CHECKSIG
 *
 * @example
 * ```typescript
 * const cltvMultisigTapscript = CLTVMultisigTapscript.encode({ absoluteTimelock: 144, pubkeys: [new Uint8Array(32), new Uint8Array(32)] });
 * ```
 */
var CLTVMultisigTapscript;
(function (CLTVMultisigTapscript) {
    function encode(params) {
        const locktime = MinimalScriptNum.encode(params.absoluteTimelock);
        const asm = [
            locktime.length === 1 ? locktime[0] : locktime,
            "CHECKLOCKTIMEVERIFY",
            "DROP",
        ];
        const timelockedScript = script_1.Script.encode(asm);
        const script = new Uint8Array([
            ...timelockedScript,
            ...MultisigTapscript.encode(params).script,
        ]);
        return {
            type: TapscriptType.CLTVMultisig,
            params,
            script,
        };
    }
    CLTVMultisigTapscript.encode = encode;
    function decode(script) {
        if (script.length === 0) {
            throw new Error("Failed to decode: script is empty");
        }
        const asm = script_1.Script.decode(script);
        if (asm.length < 3) {
            throw new Error(`Invalid script: too short (expected at least 3)`);
        }
        const locktime = asm[0];
        if (typeof locktime === "string" || typeof locktime === "number") {
            throw new Error("Invalid script: expected locktime number");
        }
        if (asm[1] !== "CHECKLOCKTIMEVERIFY" || asm[2] !== "DROP") {
            throw new Error("Invalid script: expected CHECKLOCKTIMEVERIFY DROP");
        }
        const multisigScript = new Uint8Array(script_1.Script.encode(asm.slice(3)));
        let multisig;
        try {
            multisig = MultisigTapscript.decode(multisigScript);
        }
        catch (error) {
            throw new Error(`Invalid multisig script: ${error instanceof Error ? error.message : String(error)}`);
        }
        const absoluteTimelock = MinimalScriptNum.decode(locktime);
        const reconstructed = encode({
            absoluteTimelock,
            ...multisig.params,
        });
        if (base_1.hex.encode(reconstructed.script) !== base_1.hex.encode(script)) {
            throw new Error("Invalid script format: script reconstruction mismatch");
        }
        return {
            type: TapscriptType.CLTVMultisig,
            params: {
                absoluteTimelock,
                ...multisig.params,
            },
            script,
        };
    }
    CLTVMultisigTapscript.decode = decode;
    function is(tapscript) {
        return tapscript.type === TapscriptType.CLTVMultisig;
    }
    CLTVMultisigTapscript.is = is;
})(CLTVMultisigTapscript || (exports.CLTVMultisigTapscript = CLTVMultisigTapscript = {}));
