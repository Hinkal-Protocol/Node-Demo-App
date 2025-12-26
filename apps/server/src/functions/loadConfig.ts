import { readFileSync } from "fs";
import { join } from "path";
import {
  BatchTransactionInput,
  BatchTransaction,
  BatchTransactionType,
} from "./types";

const REQUIRED_FIELDS: Record<string, string[]> = {
  [BatchTransactionType.Deposit]: ["tokenAddress", "amount"],
  [BatchTransactionType.Withdraw]: [
    "tokenAddress",
    "amount",
    "recipientAddress",
  ],
  [BatchTransactionType.Transfer]: [
    "tokenAddress",
    "amount",
    "recipientAddress",
  ],
  [BatchTransactionType.Swap]: ["tokenIn", "tokenOut", "amountIn", "swapData"],
};

const validateTransaction = (
  tx: any,
  defaultChainId: number
): BatchTransaction => {
  if (!tx.id || !tx.type) {
    throw new Error(
      `Transaction ${tx.id || "unknown"}: missing 'id' or 'type'`
    );
  }

  if (!tx.privateKey) {
    throw new Error(`Transaction ${tx.id}: missing 'privateKey'`);
  }

  const requiredFields = REQUIRED_FIELDS[tx.type];
  if (!requiredFields) {
    throw new Error(
      `Transaction ${tx.id}: Unknown transaction type '${tx.type}'`
    );
  }

  for (const field of requiredFields) {
    if (!tx[field]) {
      throw new Error(`Transaction ${tx.id}: missing '${field}'`);
    }
  }

  if (tx.type === BatchTransactionType.Transfer) {
    const recipient = String(tx.recipientAddress).trim();
    if (!recipient.includes(",") || recipient.split(",").length !== 3) {
      throw new Error(
        `Transaction ${tx.id}: Invalid recipient format. Must be "randomization,stealthAddress,encryptionKey".`
      );
    }
  }

  const chainId = tx.chainId || defaultChainId;
  if (!chainId) {
    throw new Error(
      `Transaction ${tx.id}: missing 'chainId' (not specified in transaction or default)`
    );
  }

  return { ...tx, chainId } as BatchTransaction;
};

export const loadConfig = (): BatchTransactionInput | null => {
  try {
    const configPath = join(process.cwd(), "transactions.json");
    const data = JSON.parse(readFileSync(configPath, "utf-8"));

    if (!Array.isArray(data.transactions)) {
      console.error(
        "Error: 'transactions' array is missing in transactions.json"
      );
      return null;
    }

    if (!data.chainId) {
      console.error("Error: 'chainId' is missing in transactions.json");
      return null;
    }

    const defaultChainId = parseInt(data.chainId, 10);
    if (isNaN(defaultChainId)) {
      console.error(
        "Error: 'chainId' must be a valid number in transactions.json"
      );
      return null;
    }

    return {
      chainId: defaultChainId,
      transactions: data.transactions.map((tx: any) =>
        validateTransaction(tx, defaultChainId)
      ),
    };
  } catch (error) {
    console.error(`Failed to load configuration: ${(error as Error).message}`);
    return null;
  }
};
