import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { TAP_LEAF_VERSION } from '@scure/btc-signer/payment'
import { Bytes } from '@scure/btc-signer/utils'

export function defaultVtxoTapscripts(pubKey: Bytes, serverPubKey: Bytes): string[] {
  // Create 2-of-2 multisig script with user and server pubkeys
  const multisigScript = btc.p2tr_ms(2, [pubKey, serverPubKey]).script

  // Create CSV timelock script
  const csvScript = btc.Script.encode([
    144, // OP_PUSHNUM_144 (direct number)
    btc.OP.CHECKSEQUENCEVERIFY,
    btc.OP.DROP,
    pubKey,
    btc.OP.CHECKSIG
  ])

  return [
    hex.encode(multisigScript),
    hex.encode(csvScript)
  ]
}

export function vtxoScript(tapscripts: string[], network: typeof btc.NETWORK = btc.NETWORK): ReturnType<typeof btc.p2tr> {
  const tapTree = btc.taprootListToTree(tapscripts.map(s => ({ script: hex.decode(s), leafVersion: TAP_LEAF_VERSION })))
  return btc.p2tr(btc.TAPROOT_UNSPENDABLE_KEY, tapTree, network, true)
}
