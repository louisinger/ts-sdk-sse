export declare class BIP322Error extends Error {
    constructor(message: string);
}
export declare const ErrMissingInputs: BIP322Error;
export declare const ErrMissingData: BIP322Error;
export declare const ErrMissingWitnessUtxo: BIP322Error;
