import { BaseArkProvider } from './base'
import type { VTXO, VirtualTx } from '../types/internal'

export class ArkProvider extends BaseArkProvider {
  private async getInfo() {
    const response = await fetch(`${this.serverUrl}/v1/info`)
    if (!response.ok) {
      throw new Error(`Failed to get server info: ${response.statusText}`)
    }
    return response.json()
  }

  async getVTXOs(address: string): Promise<VTXO[]> {
    const response = await fetch(`${this.serverUrl}/v1/vtxos/${address}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch VTXOs: ${response.statusText}`)
    }
    const data = await response.json()
    
    // Convert from server format to our internal VTXO format
    return [...data.spendable_vtxos, ...data.spent_vtxos].map(vtxo => ({
      txid: vtxo.outpoint.txid,
      vout: vtxo.outpoint.vout,
      value: Number(vtxo.amount),
      status: {
        state: vtxo.spent ? 'swept' : (vtxo.is_pending ? 'unsafe' : 'safe'),
        batchOutpoint: vtxo.round_txid ? {
          txid: vtxo.round_txid,
          vout: 0 // Need to get the actual vout from the round tx
        } : undefined,
        batchExpiry: vtxo.expire_at ? Number(vtxo.expire_at) : undefined
      }
    }))
  }

  async submitVirtualTx(tx: VirtualTx): Promise<string> {
    const response = await fetch(`${this.serverUrl}/v1/redeem-tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redeem_tx: tx.psbt
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to submit virtual transaction: ${error}`)
    }

    const data = await response.json()
    return data.signed_redeem_tx
  }

  async subscribeToEvents(callback: (event: any) => void): Promise<() => void> {
    const eventSource = new EventSource(`${this.serverUrl}/v1/events`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      callback(data)
    }

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error)
    }

    // Return unsubscribe function
    return () => eventSource.close()
  }
}
