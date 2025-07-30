"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrMissingWitnessUtxo = exports.ErrMissingData = exports.ErrMissingInputs = exports.BIP322Error = void 0;
class BIP322Error extends Error {
    constructor(message) {
        super(message);
        this.name = "BIP322Error";
    }
}
exports.BIP322Error = BIP322Error;
exports.ErrMissingInputs = new BIP322Error("missing inputs");
exports.ErrMissingData = new BIP322Error("missing data");
exports.ErrMissingWitnessUtxo = new BIP322Error("missing witness utxo");
