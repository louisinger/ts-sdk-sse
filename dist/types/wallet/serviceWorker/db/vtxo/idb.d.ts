import { VtxoRepository } from ".";
import { ExtendedVirtualCoin } from "../../..";
export declare class IndexedDBVtxoRepository implements VtxoRepository {
    static readonly DB_NAME = "wallet-db";
    static readonly STORE_NAME = "vtxos";
    static readonly DB_VERSION = 1;
    static delete(): Promise<void>;
    private db;
    close(): Promise<void>;
    open(): Promise<void>;
    addOrUpdate(vtxos: ExtendedVirtualCoin[]): Promise<void>;
    deleteAll(): Promise<void>;
    getSpendableVtxos(): Promise<ExtendedVirtualCoin[]>;
    getSweptVtxos(): Promise<ExtendedVirtualCoin[]>;
    getSpentVtxos(): Promise<ExtendedVirtualCoin[]>;
    getAllVtxos(): Promise<{
        spendable: ExtendedVirtualCoin[];
        spent: ExtendedVirtualCoin[];
    }>;
}
