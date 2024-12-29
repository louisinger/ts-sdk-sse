import { schnorr } from "@noble/curves/secp256k1";
import { Identity } from "../types/wallet";
import { pubSchnorr, randomPrivateKeyBytes } from "@scure/btc-signer/utils";
import { hex } from "@scure/base";

export class InMemoryKey implements Identity {
    private key: Uint8Array;

    private constructor(key: Uint8Array | undefined) {
        this.key = key || randomPrivateKeyBytes();
    }

    static fromPrivateKey(privateKey: Uint8Array): InMemoryKey {
        return new InMemoryKey(privateKey);
    }

    static fromHex(privateKeyHex: string): InMemoryKey {
        return new InMemoryKey(hex.decode(privateKeyHex));
    }

    async sign(message: Uint8Array): Promise<Uint8Array> {
        return schnorr.sign(message, this.key);
    }

    xOnlyPublicKey(): Uint8Array {
        return pubSchnorr(this.key);
    }

    privateKey(): Uint8Array {
        return this.key;
    }
}

export class ExternalSigner implements Identity {
    private signer: any; // Replace with proper type based on external signer interface

    private constructor(signer: any) {
        this.signer = signer;
    }

    static fromSigner(signer: any): ExternalSigner {
        return new ExternalSigner(signer);
    }

    async sign(_message: Uint8Array): Promise<Uint8Array> {
        throw new Error("Not implemented");
    }

    xOnlyPublicKey(): Uint8Array {
        throw new Error("Not implemented");
    }

    privateKey(): Uint8Array {
        throw new Error("External signer does not expose private key");
    }
}
