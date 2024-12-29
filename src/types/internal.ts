// Internal types as returned by external services

export interface UTXO {
    txid: string;
    vout: number;
    value: number;
    status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
        block_time?: number;
    };
}

export interface VTXO {
    txid: string;
    vout: number;
    value: number;
    status: {
        state: "pending" | "settled" | "swept";
        batchOutpoint?: {
            txid: string;
            vout: number;
        };
        batchExpiry?: number;
    };
}

// Type for submitting virtual transaction
export interface VirtualTx {
    psbt: string; // base64 encoded PSBT
}
