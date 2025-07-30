"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networks = exports.getNetwork = void 0;
const btc_signer_1 = require("@scure/btc-signer");
const getNetwork = (network) => {
    return exports.networks[network];
};
exports.getNetwork = getNetwork;
exports.networks = {
    bitcoin: withArkPrefix(btc_signer_1.NETWORK, "ark"),
    testnet: withArkPrefix(btc_signer_1.TEST_NETWORK, "tark"),
    signet: withArkPrefix(btc_signer_1.TEST_NETWORK, "tark"),
    mutinynet: withArkPrefix(btc_signer_1.TEST_NETWORK, "tark"),
    regtest: withArkPrefix({
        ...btc_signer_1.TEST_NETWORK,
        bech32: "bcrt",
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
    }, "tark"),
};
function withArkPrefix(network, prefix) {
    return {
        ...network,
        hrp: prefix,
    };
}
