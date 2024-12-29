import * as btc from "@scure/btc-signer";
import { TAP_LEAF_VERSION } from "@scure/btc-signer/payment";
import { Bytes } from "@scure/btc-signer/utils";

export interface DefaultTapscriptOptions {
    pubKey: Bytes;
    serverPubKey: Bytes;
    csvTimelock?: number;
}

export enum TapLeafPath {
    FORFEIT = 0, // 2-of-2 multisig path
    EXIT = 1, // CSV timelock path
}

export class VtxoTapscript {
    static readonly DEFAULT_TIMELOCK = 144; // 1 day in blocks
    // TODO change to 3 months in blocks
    static readonly BOARDING_TIMELOCK = VtxoTapscript.DEFAULT_TIMELOCK * 2;

    readonly pubKey: Bytes;
    readonly serverPubKey: Bytes;
    readonly csvTimelock: number;
    private readonly p2tr: ReturnType<typeof btc.p2tr>;
    private readonly forfeitScript: Uint8Array;
    private readonly exitScript: Uint8Array;

    private constructor(
        options: DefaultTapscriptOptions,
        network: typeof btc.NETWORK = btc.NETWORK
    ) {
        const {
            pubKey,
            serverPubKey,
            csvTimelock = VtxoTapscript.DEFAULT_TIMELOCK,
        } = options;
        this.pubKey = pubKey;
        this.serverPubKey = serverPubKey;
        this.csvTimelock = csvTimelock;

        // Create taproot tree with 2-of-2 multisig (forfeit path)
        // The following alterantive doents work
        // btc.Script.encode([this.pubKey,btc.OP.CHECKSIGVERIFY,this.serverPubKey,btc.OP.CHECKSIG])
        this.forfeitScript = btc.p2tr_ms(2, [
            this.pubKey,
            this.serverPubKey,
        ]).script;

        // Create CSV timelock script (exit path)
        this.exitScript = btc.Script.encode([
            this.csvTimelock,
            btc.OP.CHECKSEQUENCEVERIFY,
            btc.OP.DROP,
            this.pubKey,
            btc.OP.CHECKSIG,
        ]);

        // Create taproot tree
        const tapTree = btc.taprootListToTree([
            { script: this.forfeitScript, leafVersion: TAP_LEAF_VERSION },
            { script: this.exitScript, leafVersion: TAP_LEAF_VERSION },
        ]);

        // Create P2TR output
        this.p2tr = btc.p2tr(
            btc.TAPROOT_UNSPENDABLE_KEY,
            tapTree,
            network,
            true
        );
    }

    /**
     * Get the P2TR output information
     */
    toP2TR(): ReturnType<typeof btc.p2tr> {
        return this.p2tr;
    }

    /**
     * Get the forfeit (2-of-2 multisig) script
     */
    getForfeitScript(): Uint8Array {
        return this.forfeitScript;
    }

    /**
     * Get the exit (CSV timelock) script
     */
    getExitScript(): Uint8Array {
        return this.exitScript;
    }

    /**
     * Create a bare VTXO tapscript (2-of-2 multisig + CSV timelock)
     */
    static createBareVtxo(
        pubKey: Bytes,
        serverPubKey: Bytes,
        network?: typeof btc.NETWORK
    ): VtxoTapscript {
        return new VtxoTapscript({ pubKey, serverPubKey }, network);
    }

    /**
     * Create a boarding VTXO tapscript with longer timelock
     */
    static createBoarding(
        pubKey: Bytes,
        serverPubKey: Bytes,
        network?: typeof btc.NETWORK
    ): VtxoTapscript {
        return new VtxoTapscript(
            {
                pubKey,
                serverPubKey,
                csvTimelock: this.BOARDING_TIMELOCK,
            },
            network
        );
    }
}
