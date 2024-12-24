import { schnorr } from '@noble/secp256k1'
import { Identity } from '../types/wallet'

export class InMemoryIdentity implements Identity {
  private key: Uint8Array

  private constructor(key: Uint8Array) {
    this.key = key
  }

  static fromPrivateKey(privateKey: Uint8Array): InMemoryIdentity {
    return new InMemoryIdentity(privateKey)
  }

  static fromHex(hex: string): InMemoryIdentity {
    return new InMemoryIdentity(Buffer.from(hex, 'hex'))
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return schnorr.sign(message, this.key)
  }

  publicKey(): Uint8Array {
    return schnorr.getPublicKey(this.key)
  }

  privateKey(): Uint8Array {
    return this.key
  }
}

export class ExternalSigner implements Identity {
  private signer: any // Replace with proper type based on external signer interface

  private constructor(signer: any) {
    this.signer = signer
  }

  static fromSigner(signer: any): ExternalSigner {
    return new ExternalSigner(signer)
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    throw new Error('Not implemented')
  }

  publicKey(): Uint8Array {
    throw new Error('Not implemented')
  }

  privateKey(): Uint8Array {
    throw new Error('External signer does not expose private key')
  }
}
