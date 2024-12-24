import type { Network } from '../types/wallet'
import { NETWORK, TEST_NETWORK } from '@scure/btc-signer'

export interface NetworkConfig {
  bech32: string
  pubKeyHash: number
  scriptHash: number
  wif: number
}

export const networks: Record<Network, NetworkConfig> = {
  bitcoin: NETWORK,
  testnet: TEST_NETWORK,
  signet: TEST_NETWORK,
  mutinynet: TEST_NETWORK,
  regtest: TEST_NETWORK,
}

export const getNetwork = (network: Network): NetworkConfig => {
  return networks[network]
}

export const SIGHASH_ALL = 0x01
export const SIGHASH_NONE = 0x02
export const SIGHASH_SINGLE = 0x03
export const SIGHASH_ANYONECANPAY = 0x80

export const DEFAULT_SEQUENCE = 0xfffffffd // Opt-in RBF
export const DEFAULT_LOCKTIME = 0
