import { bech32m } from 'bech32'
import { p2tr } from '@scure/btc-signer'
import { defaultVtxoTapscripts, vtxoScript } from './tapscript'
import { Bytes } from '@scure/btc-signer/utils'

interface Network {
  Addr: string
}

interface Networks {
  Bitcoin: Network
  TestNet: Network
}

export const Networks: Networks = {
  Bitcoin: {
    Addr: 'ark'
  },
  TestNet: {
    Addr: 'tark'
  }
}

export class ArkAddress {
  readonly hrp: string
  readonly serverPubKey: Uint8Array
  readonly vtxoTapKey: Uint8Array

  constructor(hrp: string, serverPubKey: Uint8Array, vtxoTapKey: Uint8Array) {
    if (!['ark', 'tark'].includes(hrp)) {
      throw new Error('Invalid HRP')
    }
    if (!serverPubKey || serverPubKey.length !== 32) {
      throw new Error('Server public key must be a 32-byte x-only pubkey')
    }
    if (!vtxoTapKey || vtxoTapKey.length !== 32) {
      throw new Error('VTXO taproot key must be a 32-byte x-only pubkey')
    }

    this.hrp = hrp
    this.serverPubKey = serverPubKey
    this.vtxoTapKey = vtxoTapKey
  }

  static fromP2TR(hrp: string, pay: ReturnType<typeof p2tr>, serverPubKey: Uint8Array): ArkAddress {
    if (!pay || !pay.tweakedPubkey) {
      throw new Error('Invalid P2TR output: missing output script')
    }
    if (!serverPubKey) {
      throw new Error('Server public key is required')
    }

    return new ArkAddress(
      hrp,
      serverPubKey,
      pay.tweakedPubkey
    )
  }

  static fromPubKey(pubKey: Bytes, serverPubKey: Bytes, network: string = 'bitcoin'): ArkAddress {
    const tapscripts = defaultVtxoTapscripts(pubKey, serverPubKey)
    const pay = vtxoScript(tapscripts)
    const hrp = network === 'bitcoin' ? 'ark' : 'tark'
    return new ArkAddress(hrp, serverPubKey, pay.tweakedPubkey)
  }

  encode(): string {
    if (!this.serverPubKey) {
      throw new Error('missing Server public key')
    }
    if (!this.vtxoTapKey) {
      throw new Error('missing vtxo tap public key')
    }

    // Combine the two public keys
    const combinedKey = new Uint8Array([...this.serverPubKey, ...this.vtxoTapKey])

    // Convert to 5-bit words
    const words = bech32m.toWords(Array.from(combinedKey))
    // Encode with bech32m
    return bech32m.encode(this.hrp, words, 1023)
  }

  static decode(addr: string): ArkAddress {
    if (!addr) {
      throw new Error('address is empty')
    }

    // Decode the bech32m string
    const { prefix, words } = bech32m.decode(addr, 1023)

    // Validate prefix
    if (![Networks.Bitcoin.Addr, Networks.TestNet.Addr].includes(prefix)) {
      throw new Error('invalid prefix')
    }

    // Convert from 5-bit words to bytes
    const bytes = new Uint8Array(bech32m.fromWords(words))

    // Split the combined key into server pubkey and vtxo tapkey
    if (bytes.length !== 64) {
      throw new Error('invalid key length')
    }

    const serverPubKey = bytes.slice(0, 32)
    const vtxoTapKey = bytes.slice(32)

    return new ArkAddress(prefix, serverPubKey, vtxoTapKey)
  }
}
