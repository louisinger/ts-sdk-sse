import { BaseOnchainProvider } from './base'
import type { Network } from '../types/wallet'
import type { UTXO } from '../types/internal'

export class EsploraProvider extends BaseOnchainProvider {
  private baseUrl: string

  constructor(network: Network, baseUrl?: string) {
    super(network)
    this.baseUrl = baseUrl || this.getDefaultBaseUrl(network)
  }

  private getDefaultBaseUrl(network: Network): string {
    switch (network) {
      case 'bitcoin':
        return 'https://mempool.space/api'
      case 'testnet':
        return 'https://mempool.space/testnet/api'
      case 'signet':
        return 'https://mempool.space/signet/api'
      case 'mutinynet':
        return 'https://mutinynet.com/api'
      default:
        throw new Error(`Network ${network} not supported`)
    }
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const response = await fetch(`${this.baseUrl}/address/${address}/utxo`)
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`)
    }
    return response.json()
  }

  async getFeeRate(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/v1/fees/recommended`)
    if (!response.ok) {
      throw new Error(`Failed to fetch fee rate: ${response.statusText}`)
    }
    const fees = await response.json()
    return fees.halfHourFee // Return the "medium" priority fee rate
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to broadcast transaction: ${error}`)
    }

    return response.text() // Returns the txid
  }
}
