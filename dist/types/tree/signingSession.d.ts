import * as musig2 from "../musig2";
import { TxTree } from "./txTree";
export declare const ErrMissingVtxoGraph: Error;
export declare const ErrMissingAggregateKey: Error;
export type TreeNonces = Map<string, Pick<musig2.Nonces, "pubNonce">>;
export type TreePartialSigs = Map<string, musig2.PartialSig>;
export interface SignerSession {
    getPublicKey(): Uint8Array;
    init(tree: TxTree, scriptRoot: Uint8Array, rootInputAmount: bigint): void;
    getNonces(): TreeNonces;
    setAggregatedNonces(nonces: TreeNonces): void;
    sign(): TreePartialSigs;
}
export declare class TreeSignerSession implements SignerSession {
    private secretKey;
    static NOT_INITIALIZED: Error;
    private myNonces;
    private aggregateNonces;
    private graph;
    private scriptRoot;
    private rootSharedOutputAmount;
    constructor(secretKey: Uint8Array);
    static random(): TreeSignerSession;
    init(tree: TxTree, scriptRoot: Uint8Array, rootInputAmount: bigint): void;
    getPublicKey(): Uint8Array;
    getNonces(): TreeNonces;
    setAggregatedNonces(nonces: TreeNonces): void;
    sign(): TreePartialSigs;
    private generateNonces;
    private signPartial;
}
export declare function validateTreeSigs(finalAggregatedKey: Uint8Array, sharedOutputAmount: bigint, vtxoTree: TxTree): Promise<void>;
