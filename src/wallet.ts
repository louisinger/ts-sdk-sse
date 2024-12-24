import { base64, hex } from '@scure/base'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import * as btc from '@scure/btc-signer'

import type {
  Wallet as IWallet,
  WalletConfig,
  WalletBalance,
  SendBitcoinParams,
  AddressInfo,
  Coin,
  Identity,
  Network,
} from './types/wallet'
import type { UTXO, VTXO, VirtualTx } from './types/internal'
import { EsploraProvider } from './providers/esplora'
import { ArkProvider } from './providers/ark'
import { BIP21, BIP21Params } from './utils/bip21'
import { ArkAddress } from './utils/ark/address'

const NETWORK_CONFIG = {
  bitcoin: btc.NETWORK,
  testnet: btc.TEST_NETWORK,
  signet: btc.TEST_NETWORK,
  mutinynet: {
    ...btc.TEST_NETWORK,
    bech32: 'tb',
    messagePrefix: '\x18Bitcoin Signet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    }
  },
  regtest: btc.TEST_NETWORK
}

export class Wallet implements IWallet {
  private identity: Identity
  private network: Network
  private onchainProvider: EsploraProvider
  private arkProvider?: ArkProvider
  private unsubscribeEvents?: () => void

  constructor(config: WalletConfig) {
    this.identity = config.identity
    this.network = config.network
    this.onchainProvider = new EsploraProvider(config.network)

    if (config.arkServerUrl && config.arkServerPublicKey) {
      this.arkProvider = new ArkProvider(config.arkServerUrl, config.arkServerPublicKey)
    }
  }

  private async subscribeToArkEvents() {
    if (!this.arkProvider) return

    this.unsubscribeEvents = await this.arkProvider.subscribeToEvents((event) => {
      // Handle events (e.g., VTXO state changes)
      console.log('Received ARK event:', event)
    })
  }

  async getAddress(): Promise<AddressInfo> {
    const pubkey = this.identity.publicKey()
    if (!pubkey) {
      throw new Error('Invalid public key')
    }

    // Generate P2TR address from pubkey
    const onchainAddress = btc.getAddress('tr', pubkey, NETWORK_CONFIG[this.network])
    if (typeof onchainAddress !== 'string') {
      throw new Error('Failed to generate onchain address')
    }

    // Generate ARK address if ARK is enabled
    let offchainAddress = ''
    if (this.arkProvider) {
      try {
        const serverPubkey = hex.decode(this.arkProvider.pubkey)
        const arkAddress = ArkAddress.fromPubKey(
          pubkey,
          serverPubkey,
          this.network
        )
        offchainAddress = arkAddress.encode()
      } catch (error) {
        console.error('Error generating ARK address:', error)
      }
    }

    // Create BIP21 URI with default options and ARK address
    const bip21Params: BIP21Params = {
      address: onchainAddress,
      label: 'ARK Wallet',
      message: 'Payment to ARK Wallet',
    }

    // Add ARK address if available
    if (offchainAddress) {
      bip21Params.ark = offchainAddress
    }

    const bip21Uri = BIP21.create(bip21Params)

    return {
      onchain: onchainAddress,
      offchain: offchainAddress,
      bip21: bip21Uri
    }
  }

  async getBalance(): Promise<WalletBalance> {
    const coins = await this.getCoins()

    const confirmed = coins.reduce((sum, coin) =>
      sum + (coin.status.confirmed ? coin.value : 0), 0)

    const total = coins.reduce((sum, coin) => sum + coin.value, 0)

    return {
      confirmed,
      unconfirmed: total - confirmed,
      total
    }
  }

  async getCoins(): Promise<Coin[]> {
    const address = await this.getAddress()

    // Get onchain UTXOs
    const utxos = await this.onchainProvider.getUTXOs(address.onchain)
    const coins: Coin[] = this.convertUTXOsToCoins(utxos)

    // Get VTXOs if ARK is enabled
    if (this.arkProvider && address.offchain) {
      const vtxos = await this.arkProvider.getVTXOs(address.offchain)
      coins.push(...this.convertVTXOsToCoins(vtxos))
    }

    return coins
  }

  private convertUTXOsToCoins(utxos: UTXO[]): Coin[] {
    return utxos.map(utxo => ({
      ...utxo,
      isVirtual: false
    }))
  }

  private convertVTXOsToCoins(vtxos: VTXO[]): Coin[] {
    return vtxos.map(vtxo => ({
      txid: vtxo.txid,
      vout: vtxo.vout,
      value: vtxo.value,
      status: {
        confirmed: vtxo.status.state === 'safe',
        // Optional fields not applicable for VTXOs
      },
      isVirtual: true,
      virtualState: vtxo.status
    }))
  }

  async sendBitcoin(params: SendBitcoinParams): Promise<string> {
    // If ARK is enabled and amount is suitable for offchain, use that
    if (this.arkProvider && this.isOffchainSuitable(params)) {
      return this.sendOffchain(params)
    }
    // Otherwise use onchain
    return this.sendOnchain(params)
  }

  private isOffchainSuitable(params: SendBitcoinParams): boolean {
    // TODO: Add proper logic to determine if transaction is suitable for offchain
    // For now, just check if amount is less than 1 BTC
    return params.amount < 100_000_000
  }

  async sendOnchain(params: SendBitcoinParams): Promise<string> {
    const DUST_AMOUNT = BigInt(546); // Bitcoin dust limit in satoshis
    const FEE_RATE = 2; // sats/vbyte
    const ESTIMATED_TX_VSIZE = 500; // conservative estimate for 1-2 inputs P2TR tx
    const ESTIMATED_FEE = BigInt(FEE_RATE * ESTIMATED_TX_VSIZE);

    const coins = await this.getCoins()
    const onchainCoins = coins.filter(coin => !coin.isVirtual)
    if (!onchainCoins.length) {
      throw new Error("No UTXOs available");
    }

    // Calculate total available amount
    const totalAmount = onchainCoins.reduce((sum, coin) => sum + coin.value, 0);
    if (totalAmount < params.amount) {
      throw new Error("Insufficient funds");
    }

    // Create a new transaction
    const tx = new btc.Transaction();
    const network = NETWORK_CONFIG[this.network]
    const pubkey = this.identity.publicKey()
    const privkey = this.identity.privateKey()

    // Add all spendable inputs
    let inputAmount = BigInt(0);
    for (const coin of onchainCoins) {
      const p2tr = btc.p2tr(pubkey, undefined, network);
      tx.addInput({
        txid: coin.txid,
        index: coin.vout,
        witnessUtxo: {
          script: p2tr.script,
          amount: BigInt(coin.value)
        },
        tapInternalKey: pubkey
      });
      inputAmount += BigInt(coin.value);
    }

    // Calculate change after fee
    const changeAmount = inputAmount - BigInt(params.amount) - ESTIMATED_FEE;

    // If change would be dust, send everything minus fee
    if (changeAmount > BigInt(0) && changeAmount < DUST_AMOUNT) {
      // Send all funds minus fee
      const sendAmount = inputAmount - ESTIMATED_FEE;
      tx.addOutputAddress(params.address, sendAmount, network);
    } else {
      // Normal transaction with change
      tx.addOutputAddress(params.address, BigInt(params.amount), network);

      if (changeAmount > DUST_AMOUNT) {
        const changeAddress = await this.getAddress()
        tx.addOutputAddress(changeAddress.onchain, changeAmount, network);
      }
    }

    // Sign all inputs with taproot key
    for (let i = 0; i < onchainCoins.length; i++) {
      tx.signIdx(privkey, i);
    }

    tx.finalize();

    // Broadcast
    return this.onchainProvider.broadcastTransaction(tx.hex)
  }

  async sendOffchain(params: SendBitcoinParams): Promise<string> {
    if (!this.arkProvider) {
      throw new Error('ARK provider not configured')
    }

    const coins = await this.getCoins()
    const vtxos = coins.filter(coin =>
      coin.isVirtual &&
      coin.virtualState?.state === 'safe'
    )

    const amount = BigInt(params.amount);
    if (amount <= BigInt(0)) {
      throw new Error("Amount must be greater than 0");
    }

    // Calculate total available amount
    const spendableAmount = vtxos.reduce((sum, vtxo) => sum + vtxo.value, 0);
    if (spendableAmount < params.amount) {
      throw new Error("Insufficient virtual funds");
    }

    // Find a suitable VTXO
    const vtxo = vtxos.find(v => v.value >= params.amount);
    if (!vtxo) {
      throw new Error("No suitable VTXO found");
    }

    // Create tx using btc-signer
    const tx = new btc.Transaction()
    const network = NETWORK_CONFIG[this.network]
    const pubkey = this.identity.publicKey()
    const privkey = this.identity.privateKey()

    // Add input
    const p2tr = btc.p2tr(pubkey, undefined, network)
    tx.addInput({
      txid: vtxo.txid,
      index: vtxo.vout,
      witnessUtxo: {
        script: p2tr.script,
        amount: BigInt(vtxo.value)
      },
      tapInternalKey: pubkey
    })

    // Add recipient output
    tx.addOutputAddress(params.address, amount, network)

    // Add change output if needed
    const changeAmount = BigInt(vtxo.value) - amount - BigInt(1000) // Basic fee estimation
    if (changeAmount > BigInt(546)) { // Dust limit
      const changeAddress = await this.getAddress()
      if (!changeAddress.offchain) {
        throw new Error('No offchain address available for change')
      }
      tx.addOutputAddress(changeAddress.offchain, changeAmount, network)
    }

    // Sign all inputs
    tx.signIdx(privkey, 0)

    // Create VirtualTx
    const virtualTx: VirtualTx = {
      psbt: base64.encode(tx.toBytes()),
      inputs: [{ txid: vtxo.txid, vout: vtxo.vout }],
      outputs: [{
        address: params.address,
        value: Number(amount)
      }]
    }

    if (changeAmount > BigInt(546)) {
      const changeAddress = await this.getAddress()
      if (!changeAddress.offchain) {
        throw new Error('No offchain address available for change')
      }
      virtualTx.outputs.push({
        address: changeAddress.offchain,
        value: Number(changeAmount)
      })
    }

    return this.arkProvider.submitVirtualTx(virtualTx)
  }

  async signMessage(message: string): Promise<string> {
    const messageHash = sha256(new TextEncoder().encode(message))
    const signature = await this.identity.sign(messageHash)
    return bytesToHex(signature)
  }

  async verifyMessage(message: string, signature: string, address: string): Promise<boolean> {
    // TODO: Implement message verification
    // Need to verify schnorr signature against P2TR address
    return true
  }

  dispose() {
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents()
    }
  }
}
