import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EsploraProvider } from '../esplora'
import type { UTXO } from '../../types/internal'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('EsploraProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('constructor', () => {
    it('should use default mempool.space URL for mainnet', () => {
      const provider = new EsploraProvider('bitcoin')
      expect((provider as any).baseUrl).toBe('https://mempool.space/api')
    })

    it('should use custom base URL when provided', () => {
      const customUrl = 'https://blockstream.info/api'
      const provider = new EsploraProvider('bitcoin', customUrl)
      expect((provider as any).baseUrl).toBe(customUrl)
    })

    it('should throw error for unsupported network', () => {
      expect(() => new EsploraProvider('invalidnet' as any)).toThrow()
    })
  })

  describe('getUTXOs', () => {
    const mockUTXOs: UTXO[] = [
      {
        txid: '1234',
        vout: 0,
        value: 100000,
        status: {
          confirmed: true,
          block_height: 100,
          block_hash: 'abcd',
          block_time: 1600000000
        }
      }
    ]

    it('should fetch UTXOs successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUTXOs)
      })

      const provider = new EsploraProvider('bitcoin')
      const utxos = await provider.getUTXOs('bc1qtest')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mempool.space/api/address/bc1qtest/utxo'
      )
      expect(utxos).toEqual(mockUTXOs)
    })

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })

      const provider = new EsploraProvider('bitcoin')
      await expect(provider.getUTXOs('bc1qtest')).rejects.toThrow('Failed to fetch UTXOs')
    })
  })

  describe('getFeeRate', () => {
    it('should fetch fee rate successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ halfHourFee: 10 })
      })

      const provider = new EsploraProvider('bitcoin')
      const feeRate = await provider.getFeeRate()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mempool.space/api/v1/fees/recommended'
      )
      expect(feeRate).toBe(10)
    })

    it('should throw error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      })

      const provider = new EsploraProvider('bitcoin')
      await expect(provider.getFeeRate()).rejects.toThrow('Failed to fetch fee rate')
    })
  })

  describe('broadcastTransaction', () => {
    const mockTxHex = '0200000001...'
    const mockTxId = 'abcd1234...'

    it('should broadcast transaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockTxId)
      })

      const provider = new EsploraProvider('bitcoin')
      const txid = await provider.broadcastTransaction(mockTxHex)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mempool.space/api/tx',
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: mockTxHex
        }
      )
      expect(txid).toBe(mockTxId)
    })

    it('should throw error on failed broadcast', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Transaction rejected')
      })

      const provider = new EsploraProvider('bitcoin')
      await expect(provider.broadcastTransaction(mockTxHex)).rejects.toThrow('Failed to broadcast transaction')
    })
  })
})
