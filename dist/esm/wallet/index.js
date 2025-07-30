export var TxType;
(function (TxType) {
    TxType["TxSent"] = "SENT";
    TxType["TxReceived"] = "RECEIVED";
})(TxType || (TxType = {}));
export function isSpendable(vtxo) {
    return vtxo.spentBy === undefined || vtxo.spentBy === "";
}
export function isRecoverable(vtxo) {
    return vtxo.virtualStatus.state === "swept" && isSpendable(vtxo);
}
export function isSubdust(vtxo, dust) {
    return vtxo.value < dust;
}
