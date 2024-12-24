# @arklabs/wallet-sdk

A Bitcoin wallet SDK with Taproot and ARK integration, built with security and privacy in mind.

## Features

- Pure TypeScript implementation
- Secure key management using Noble/Secure libraries
- Support for Taproot and ARK protocols
- BIP21 payment request handling
- Integration with Mempool.space
- Comprehensive test coverage

## Installation

```bash
npm install @arklabs/wallet-sdk
```

## Usage

```typescript
import { createWallet } from '@arklabs/wallet-sdk'

// Initialize wallet
const wallet = createWallet({
  network: 'testnet',
  privateKey: process.env.BITCOIN_PRIVATE_KEY
})

// Get wallet address
const address = await wallet.getAddress()

// Get balance
const balance = await wallet.getBalance()

// Send bitcoin
const txid = await wallet.send({
  address: 'tb1...',
  amount: 10000, // satoshis
  feeRate: 1 // sat/vB
})
```

## Configuration

The SDK can be configured using environment variables:

- `BITCOIN_PRIVATE_KEY`: Your wallet's private key
- `BITCOIN_NETWORK`: Network to use (mainnet, testnet, regtest)
- `BITCOIN_ARK_SERVER_URL`: ARK server URL
- `BITCOIN_ARK_SERVER_PUBLIC_KEY`: ARK server public key

## Security

This SDK prioritizes security by:
- Never exposing private keys
- Using constant-time operations
- Maintaining deterministic builds
- Minimizing dependencies

## License

MIT
