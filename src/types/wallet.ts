export type Network = 'bitcoin' | 'testnet' | 'signet' | 'mutinynet' | 'regtest'

export interface Identity {
  sign(message: Uint8Array): Promise<Uint8Array>
  publicKey(): Uint8Array
  privateKey(): Uint8Array
}

export interface WalletConfig {
  network: Network
  identity: Identity
  arkServerUrl?: string
  arkServerPublicKey?: string
}

export interface WalletBalance {
  confirmed: number
  unconfirmed: number
  total: number
}

export interface SendBitcoinParams {
  address: string
  amount: number
  feeRate?: number
  memo?: string
}

export interface AddressInfo {
  onchain: string
  offchain: string
  bip21: string
}

export interface Status {
  confirmed: boolean
  block_height?: number
  block_hash?: string
  block_time?: number
}

export interface VirtualState {
  state: 'unsafe' | 'safe' | 'swept'
  batchOutpoint?: {
    txid: string
    vout: number
  }
  batchExpiry?: number
}

export interface Coin {
  txid: string
  vout: number
  value: number
  status: Status
  isVirtual: boolean
  virtualState?: VirtualState
}

export interface Wallet {
  getAddress(): Promise<AddressInfo>
  getBalance(): Promise<WalletBalance>
  getCoins(): Promise<Coin[]>
  sendBitcoin(params: SendBitcoinParams): Promise<string>
  sendOnchain(params: SendBitcoinParams): Promise<string>
  sendOffchain(params: SendBitcoinParams): Promise<string>
  signMessage(message: string): Promise<string>
  verifyMessage(message: string, signature: string, address: string): Promise<boolean>
}
