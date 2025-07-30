"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxType = void 0;
exports.isSpendable = isSpendable;
exports.isRecoverable = isRecoverable;
exports.isSubdust = isSubdust;
var TxType;
(function (TxType) {
    TxType["TxSent"] = "SENT";
    TxType["TxReceived"] = "RECEIVED";
})(TxType || (exports.TxType = TxType = {}));
function isSpendable(vtxo) {
    return vtxo.spentBy === undefined || vtxo.spentBy === "";
}
function isRecoverable(vtxo) {
    return vtxo.virtualStatus.state === "swept" && isSpendable(vtxo);
}
function isSubdust(vtxo, dust) {
    return vtxo.value < dust;
}
