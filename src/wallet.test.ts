import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Wallet } from './wallet'
import type { Identity, WalletConfig } from './types/wallet'
import { EsploraProvider } from './providers/esplora'
import { ArkProvider } from './providers/ark'

// Mock providers
vi.mock('./providers/esplora')
vi.mock('./providers/ark')

describe('Wallet', () => {
  let mockIdentity: Identity
  let config: WalletConfig
  let wallet: Wallet

  beforeEach(() => {
    // Create a valid 32-byte private key and ark server key
    const mockPrivKey = new Uint8Array(32).fill(1)
    mockPrivKey[0] = 1  // Make sure it's not all zeros
    
    const mockArkServerKey = new Uint8Array(32).fill(2)
    mockArkServerKey[0] = 2  // Make sure it's not all zeros
    
    mockIdentity = {
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      publicKey: vi.fn().mockReturnValue(mockPrivKey.slice(0, 32)), // 32 bytes for x-only pubkey
      privateKey: vi.fn().mockReturnValue(mockPrivKey)
    }

    config = {
      network: 'bitcoin',
      identity: mockIdentity,
      arkServerUrl: 'http://localhost:3000',
      arkServerPublicKey: '0202020202020202020202020202020202020202020202020202020202020202'  // 32 bytes of 0x02
    }

    wallet = new Wallet(config)
  })

  describe('getBalance', () => {
    it('should calculate balance from coins', async () => {
      const mockCoins = [
        { value: 100000, status: { confirmed: true }, isVirtual: false },
        { value: 50000, status: { confirmed: false }, isVirtual: false },
        { value: 75000, status: { confirmed: true }, isVirtual: true }
      ]

      // @ts-ignore - Mock implementation
      wallet.getCoins = vi.fn().mockResolvedValue(mockCoins)

      const balance = await wallet.getBalance()
      expect(balance).toEqual({
        confirmed: 175000, // 100000 + 75000
        unconfirmed: 50000,
        total: 225000 // 100000 + 50000 + 75000
      })
    })
  })

  describe('getCoins', () => {
    it('should combine UTXOs and VTXOs', async () => {
      const mockUtxos = [{
        txid: '1234',
        vout: 0,
        value: 100000,
        status: {
          confirmed: true,
          block_height: 100
        }
      }]

      const mockVtxos = [{
        txid: '5678',
        vout: 1,
        value: 200000,
        status: {
          state: 'safe',
          batchOutpoint: {
            txid: 'batch1234',
            vout: 0
          }
        }
      }]

      // Mock getAddress to avoid ARK address generation issues
      // @ts-ignore - Mock implementation
      wallet.getAddress = vi.fn().mockResolvedValue({
        onchain: 'bc1ptest',
        offchain: 'ark1test',
        bip21: 'bitcoin:bc1ptest'
      })

      // @ts-ignore - Mock implementation
      EsploraProvider.prototype.getUTXOs.mockResolvedValue(mockUtxos)
      // @ts-ignore - Mock implementation
      ArkProvider.prototype.getVTXOs.mockResolvedValue(mockVtxos)

      const coins = await wallet.getCoins()
      expect(coins).toHaveLength(2)
      expect(coins[0]).toMatchObject({
        txid: '1234',
        value: 100000,
        isVirtual: false
      })
      expect(coins[1]).toMatchObject({
        txid: '5678',
        value: 200000,
        isVirtual: true
      })
    })
  })

  describe('sendBitcoin', () => {
    const sendParams = {
      address: 'bc1qtest',
      amount: 50000
    }

    it('should use offchain when suitable', async () => {
      const mockTxid = 'vtxo1234'
      // @ts-ignore - Mock implementation
      wallet.isOffchainSuitable = vi.fn().mockReturnValue(true)
      // @ts-ignore - Mock implementation
      wallet.sendOffchain = vi.fn().mockResolvedValue(mockTxid)

      const txid = await wallet.sendBitcoin(sendParams)
      expect(txid).toBe(mockTxid)
      // @ts-ignore - Mock implementation
      expect(wallet.sendOffchain).toHaveBeenCalledWith(sendParams)
    })

    it('should fallback to onchain when not suitable for offchain', async () => {
      const mockTxid = 'tx1234'
      // @ts-ignore - Mock implementation
      wallet.isOffchainSuitable = vi.fn().mockReturnValue(false)
      // @ts-ignore - Mock implementation
      wallet.sendOnchain = vi.fn().mockResolvedValue(mockTxid)

      const txid = await wallet.sendBitcoin(sendParams)
      expect(txid).toBe(mockTxid)
      // @ts-ignore - Mock implementation
      expect(wallet.sendOnchain).toHaveBeenCalledWith(sendParams)
    })
  })

  describe('signMessage', () => {
    it('should sign message and return hex signature', async () => {
      const message = 'Hello, World!'
      const signature = await wallet.signMessage(message)
      expect(signature).toBe('010203') // hex of [1,2,3]
      expect(mockIdentity.sign).toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('should cleanup event subscriptions', () => {
      const mockUnsubscribe = vi.fn()
      // @ts-ignore - Set private field
      wallet.unsubscribeEvents = mockUnsubscribe

      wallet.dispose()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })
})
