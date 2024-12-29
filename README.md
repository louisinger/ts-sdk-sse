# ARK Wallet SDK

The ARK Wallet SDK is a TypeScript library for building Bitcoin wallets with support for both on-chain and off-chain transactions via ARK protocol.

## Requirements

- [pnpm](https://pnpm.io/) - Package manager
- [nigiri](https://github.com/vulpemventures/nigiri) - For running integration tests with a local Bitcoin regtest network

## Installation

```bash
pnpm add @arklabs/wallet-sdk
```

## Usage

### Creating a Wallet

```typescript
import { InMemoryKey, Wallet } from '@arklabs/wallet-sdk'

// Create a new in-memory key (or use an external signer)
const identity = InMemoryKey.fromHex('your_private_key_hex')

// Create a wallet with ARK support
const wallet = new Wallet({
  network: 'testnet',  // 'bitcoin', 'testnet', 'regtest', 'signet' or 'mutinynet'
  identity: identity,
  esploraUrl: 'https://mempool.space/testnet/api', // Optional Esplora URL
  // Optional ARK configuration
  arkServerUrl: 'https://master.signet.arklabs.to',
  arkServerPublicKey: 'your_ark_server_public_key'
})

// Get wallet addresses
const { onchain, offchain, bip21 } = wallet.getAddress()
console.log('Bitcoin Address:', onchain)
console.log('ARK Address:', offchain)
console.log('BIP21 URI:', bip21)
```

### Sending Bitcoin

```typescript
// Send bitcoin (automatically chooses on-chain or off-chain based on amount)
const txid = await wallet.sendBitcoin({
  address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  amount: 50000,  // in satoshis
  feeRate: 1      // optional, in sats/vbyte
})

// Force on-chain transaction
const txid = await wallet.sendOnchain({
  address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  amount: 50000,
  feeRate: 1
})

// Force off-chain transaction (requires ARK configuration)
const txid = await wallet.sendOffchain({
  address: 'tark1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  amount: 50000,
  feeRate: 1
})
```

### Checking Balance

```typescript
// Get detailed balance information
const balance = await wallet.getBalance()
console.log('Total Balance:', balance.total)

// Onchain balances
console.log('Onchain Total:', balance.onchain.total)
console.log('Onchain Confirmed:', balance.onchain.confirmed)
console.log('Onchain Unconfirmed:', balance.onchain.unconfirmed)

// Offchain balances (if ARK is configured)
console.log('Offchain Total:', balance.offchain.total)
console.log('Offchain Settled:', balance.offchain.settled)
console.log('Offchain Pending:', balance.offchain.pending)
console.log('Offchain Swept:', balance.offchain.swept)
```

### Getting UTXOs and Virtual UTXOs

```typescript
// Get on-chain UTXOs
const coins = await wallet.getCoins()

// Get off-chain virtual UTXOs (requires ARK configuration)
const virtualCoins = await wallet.getVirtualCoins()
```

### Message Signing

```typescript
// Sign a message
const signature = await wallet.signMessage('Hello, World!')

// Verify a message
const isValid = await wallet.verifyMessage(
  'Hello, World!',
  signature,
  'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
)
```

## API Reference

### Wallet

#### Constructor Options

```typescript
interface WalletConfig {
  /** Network to use ('bitcoin', 'testnet', 'regtest', 'signet', or 'mutinynet') */
  network: NetworkName;
  /** Identity for signing transactions */
  identity: Identity;
  /** Optional Esplora API URL */
  esploraUrl?: string;
  /** ARK server URL (optional) */
  arkServerUrl?: string;
  /** ARK server public key (optional) */
  arkServerPublicKey?: string;
}
```

#### Identity Interface

The SDK provides two implementations of the `Identity` interface:

1. `InMemoryKey`: For managing private keys in memory
```typescript
class InMemoryKey {
  static fromPrivateKey(privateKey: Uint8Array): InMemoryKey;
  static fromHex(privateKeyHex: string): InMemoryKey;
}
```

2. `ExternalSigner`: For integrating with external signing devices (hardware wallets, etc.)
```typescript
class ExternalSigner {
  static fromSigner(signer: any): ExternalSigner;
}
```

## Development

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Install nigiri for integration tests:
```bash
curl https://getnigiri.vulpem.com | bash
```

### Running Tests

```bash
# Run unit tests
pnpm test

# Run integration tests (requires nigiri)
nigiri start
pnpm test:e2e
nigiri stop
```

## License

MIT
