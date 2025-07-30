import { BTC_NETWORK, Bytes } from "@scure/btc-signer/utils";
import { ArkAddress } from "./address";
import { ConditionCSVMultisigTapscript, CSVMultisigTapscript } from "./tapscript";
export type TapLeafScript = [
    {
        version: number;
        internalKey: Bytes;
        merklePath: Bytes[];
    },
    Bytes
];
export declare function scriptFromTapLeafScript(leaf: TapLeafScript): Bytes;
/**
 * VtxoScript is a script that contains a list of tapleaf scripts.
 * It is used to create vtxo scripts.
 *
 * @example
 * ```typescript
 * const vtxoScript = new VtxoScript([new Uint8Array(32), new Uint8Array(32)]);
 */
export declare class VtxoScript {
    readonly scripts: Bytes[];
    readonly leaves: TapLeafScript[];
    readonly tweakedPublicKey: Bytes;
    static decode(tapTree: Bytes): VtxoScript;
    constructor(scripts: Bytes[]);
    encode(): Bytes;
    address(prefix: string, serverPubKey: Bytes): ArkAddress;
    get pkScript(): Bytes;
    onchainAddress(network: BTC_NETWORK): string;
    findLeaf(scriptHex: string): TapLeafScript;
    exitPaths(): Array<CSVMultisigTapscript.Type | ConditionCSVMultisigTapscript.Type>;
}
export type EncodedVtxoScript = {
    tapTree: Bytes;
};
