# Hinkal Demo App

A batch transaction processor for the [Hinkal](https://hinkal.pro) privacy protocol, built with Nx and TypeScript. It reads a list of transactions from a local `transactions.json` file and executes them sequentially — supporting deposits, withdrawals, transfers, and swaps.

## Prerequisites

- Node.js v18+
- Yarn package manager

## Getting Started

### Installation

```bash
yarn install
```

### Transaction Config Setup

Copy the example config and fill in your private key(s) and transaction details:

```bash
cp transactions.example.json transactions.json
```

Edit `transactions.json`:

- `chainId` — default chain ID for all transactions (e.g. `137` for Polygon)
- `transactions` — array of transaction objects (see [Transaction Types](#transaction-types))

> **Security:** `transactions.json` is git-ignored because it contains private keys. Never commit it.

### Run

```bash
yarn start
```

The processor will validate the config, then execute each transaction in order. It stops on the first failure.

## Transaction Types

Each transaction requires `id`, `type`, and `privateKey`. Amounts can be specified in USD (`amountInUsds`) or wei (`amount` / `amountIn`).

| Type       | Required fields                              |
|------------|----------------------------------------------|
| `deposit`  | `tokenAddress`, `amount` or `amountInUsds`   |
| `withdraw` | `tokenAddress`, `recipientAddress`, `amount` or `amountInUsds` |
| `transfer` | `tokenAddress`, `recipientAddress`, `amount` or `amountInUsds` |
| `swap`     | `tokenIn`, `tokenOut`, `amountIn` or `amountInUsds` |

## Project Structure

```
hinkal-demo-app/
├── transactions.example.json    # Template config — copy to transactions.json
├── src/
│   ├── index.ts                 # Entry point
│   ├── types/                   # Shared TypeScript types
│   │   └── index.ts
│   ├── services/                # Core business logic
│   │   ├── loadConfig.ts
│   │   ├── processBatch.ts
│   │   └── executeTransaction.ts
│   └── utils/                   # Shared utilities
│       ├── convertUsdToWei.ts
│       ├── logger.ts
│       └── sleep.ts
├── tsconfig.json
└── package.json
```

## Build

Compile to `dist/` with:

```bash
yarn build
```

Or run directly without compiling:

```bash
yarn start
```

## License

MIT
