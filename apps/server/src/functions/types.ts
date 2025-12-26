export enum BatchTransactionType {
  Deposit = "deposit",
  Withdraw = "withdraw",
  Transfer = "transfer",
  Swap = "swap",
}

export interface BatchWalletConfig {
  privateKey: string;
  chainId: number;
}

export interface BaseBatchTransaction {
  id: string;
  type: BatchTransactionType;
  privateKey: string;
  chainId?: number;
}

export interface DepositTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Deposit;
  tokenAddress: string;
  amount: string;
}

export interface WithdrawTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Withdraw;
  tokenAddress: string;
  amount: string;
  recipientAddress: string;
  isRelayerOff?: boolean;
  feeToken?: string;
}

export interface TransferTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Transfer;
  tokenAddress: string;
  amount: string;
  recipientAddress: string;
  feeToken?: string;
}

export interface SwapTransaction extends BaseBatchTransaction {
  type: BatchTransactionType.Swap;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  externalActionId?: number;
  swapData: string;
  feeToken?: string;
}

export type BatchTransaction =
  | DepositTransaction
  | WithdrawTransaction
  | TransferTransaction
  | SwapTransaction;

export interface BatchTransactionInput {
  chainId: number;
  transactions: BatchTransaction[];
}
