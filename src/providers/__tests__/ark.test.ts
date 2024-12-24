import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArkProvider } from '../ark'
import type { VirtualTx } from '../../types/internal'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock EventSource
const MockEventSource = vi.fn().mockImplementation((url: string) => ({
  url,
  onmessage: null,
  onerror: null,
  close: vi.fn()
}))
vi.stubGlobal('EventSource', MockEventSource)

describe('ArkProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('getVTXOs', () => {
    const mockVTXOs = {
      spendable_vtxos: [{
        outpoint: {
          txid: '1234',
          vout: 0
        },
        amount: '100000',
        spent: false,
        is_pending: false,
        round_txid: 'batch1234',
        expire_at: '1600000000'
      }],
      spent_vtxos: [{
        outpoint: {
          txid: '5678',
          vout: 1
        },
        amount: '200000',
        spent: true,
        is_pending: false,
        round_txid: 'batch5678',
        expire_at: '1600000000'
      }]
    }

    it('should fetch VTXOs successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVTXOs)
      })

      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      const vtxos = await provider.getVTXOs('bc1qtest')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/vtxos/bc1qtest'
      )
      expect(vtxos).toHaveLength(2)
      expect(vtxos[0]).toEqual({
        txid: '1234',
        vout: 0,
        value: 100000,
        status: {
          state: 'safe',
          batchOutpoint: {
            txid: 'batch1234',
            vout: 0
          },
          batchExpiry: 1600000000
        }
      })
      expect(vtxos[1]).toEqual({
        txid: '5678',
        vout: 1,
        value: 200000,
        status: {
          state: 'swept',
          batchOutpoint: {
            txid: 'batch5678',
            vout: 0
          },
          batchExpiry: 1600000000
        }
      })
    })

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })

      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      await expect(provider.getVTXOs('bc1qtest')).rejects.toThrow('Failed to fetch VTXOs')
    })
  })

  describe('submitVirtualTx', () => {
    const mockVirtualTx: VirtualTx = {
      psbt: '0200000001...',
      inputs: [{ txid: '1234', vout: 0 }],
      outputs: [{ address: 'bc1qtest', value: 100000 }]
    }
    const mockSignedTx = 'signed0200000001...'

    it('should submit virtual transaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ signed_redeem_tx: mockSignedTx })
      })

      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      const signedTx = await provider.submitVirtualTx(mockVirtualTx)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/redeem-tx',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redeem_tx: mockVirtualTx.psbt })
        }
      )
      expect(signedTx).toBe(mockSignedTx)
    })

    it('should throw error on failed submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Invalid PSBT')
      })

      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      await expect(provider.submitVirtualTx(mockVirtualTx)).rejects.toThrow('Failed to submit virtual transaction')
    })
  })

  describe('subscribeToEvents', () => {
    it('should setup event subscription and handle messages', async () => {
      const mockCallback = vi.fn()
      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      
      const unsubscribe = await provider.subscribeToEvents(mockCallback)
      
      // Get the EventSource instance
      const eventSource = MockEventSource.mock.results[0].value
      expect(eventSource.url).toBe('http://localhost:3000/v1/events')
      
      // Simulate receiving an event
      const mockEvent = { type: 'vtxo_update', data: 'test' }
      eventSource.onmessage({ data: JSON.stringify(mockEvent) })
      
      expect(mockCallback).toHaveBeenCalledWith(mockEvent)
      
      // Test unsubscribe
      unsubscribe()
      expect(eventSource.close).toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const provider = new ArkProvider('http://localhost:3000', 'pubkey123')
      
      await provider.subscribeToEvents(() => {})
      
      // Get the EventSource instance and simulate an error
      const eventSource = MockEventSource.mock.results[0].value
      const mockError = new Error('Connection failed')
      eventSource.onerror(mockError)
      
      expect(consoleSpy).toHaveBeenCalledWith('EventSource failed:', mockError)
      consoleSpy.mockRestore()
    })
  })
})
