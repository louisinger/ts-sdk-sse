import type { Network } from '../types/wallet'
import type { UTXO, VTXO, VirtualTx } from '../types/internal'

export interface OnchainProvider {
  getUTXOs(address: string): Promise<UTXO[]>
  getFeeRate(): Promise<number>
  broadcastTransaction(txHex: string): Promise<string>
}

export interface ArkProvider {
  getVTXOs(address: string): Promise<VTXO[]>
  submitVirtualTx(tx: VirtualTx): Promise<string>
}

export abstract class BaseOnchainProvider implements OnchainProvider {
  constructor(protected network: Network) {}

  abstract getUTXOs(address: string): Promise<UTXO[]>
  abstract getFeeRate(): Promise<number>
  abstract broadcastTransaction(txHex: string): Promise<string>
}

export abstract class BaseArkProvider implements ArkProvider {
  constructor(protected serverUrl: string, protected serverPublicKey: string) {}

  abstract getVTXOs(address: string): Promise<VTXO[]>
  abstract submitVirtualTx(tx: VirtualTx): Promise<string>
  abstract subscribeToEvents(callback: (event: any) => void): Promise<() => void>

  get url(): string {
    return this.serverUrl
  }

  get pubkey(): string {
    return this.serverPublicKey
  }
}
