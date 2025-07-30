import * as musig from "@scure/btc-signer/musig2";
import { schnorr } from "@noble/curves/secp256k1";
// Aggregates multiple public keys according to the MuSig2 algorithm
export function aggregateKeys(publicKeys, sort, options = {}) {
    if (sort) {
        publicKeys = musig.sortKeys(publicKeys);
    }
    const { aggPublicKey: preTweakedKey } = musig.keyAggregate(publicKeys);
    if (!options.taprootTweak) {
        return {
            preTweakedKey: preTweakedKey.toRawBytes(true),
            finalKey: preTweakedKey.toRawBytes(true),
        };
    }
    const tweakBytes = schnorr.utils.taggedHash("TapTweak", preTweakedKey.toRawBytes(true).subarray(1), options.taprootTweak ?? new Uint8Array(0));
    const { aggPublicKey: finalKey } = musig.keyAggregate(publicKeys, [tweakBytes], [true]);
    return {
        preTweakedKey: preTweakedKey.toRawBytes(true),
        finalKey: finalKey.toRawBytes(true),
    };
}
