import { readFileSync } from "fs";
import { join } from "path";
import {
  BatchTransactionInput,
  BatchTransaction,
  BatchTransactionType,
} from "./types";

const REQUIRED_FIELDS: Record<BatchTransactionType, string[]> = {
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

const validateRequiredField = (tx: any, field: string, txId: string): void => {
  if (!tx[field]) {
    throw new Error(`Transaction ${txId}: missing '${field}'`);
  }
};

const validateTransferRecipient = (recipient: string, txId: string): void => {
  const trimmed = recipient.trim();
  if (!trimmed.includes(",") || trimmed.split(",").length !== 3) {
    throw new Error(
      `Transaction ${txId}: Invalid recipient format. Must be "randomization,stealthAddress,encryptionKey".`
    );
  }
};

const validateTransaction = (
  tx: any,
  defaultChainId: number
): BatchTransaction => {
  const txId = tx.id || "unknown";

  if (!tx.id || !tx.type) {
    throw new Error(`Transaction ${txId}: missing 'id' or 'type'`);
  }

  validateRequiredField(tx, "privateKey", txId);

  const requiredFields = REQUIRED_FIELDS[tx.type as BatchTransactionType];
  if (!requiredFields) {
    throw new Error(
      `Transaction ${txId}: Unknown transaction type '${tx.type}'`
    );
  }

  for (const field of requiredFields) {
    validateRequiredField(tx, field, txId);
  }

  if (tx.type === BatchTransactionType.Transfer) {
    validateTransferRecipient(tx.recipientAddress, txId);
  }

  const chainId = tx.chainId || defaultChainId;
  if (!chainId) {
    throw new Error(
      `Transaction ${txId}: missing 'chainId' (not specified in transaction or default)`
    );
  }

  return { ...tx, chainId } as BatchTransaction;
};

const parseChainId = (chainId: unknown): number | null => {
  if (chainId === undefined || chainId === null) {
    console.error("Error: 'chainId' is missing in transactions.json");
    return null;
  }

  const parsed =
    typeof chainId === "number" ? chainId : parseInt(String(chainId), 10);
  if (isNaN(parsed)) {
    console.error(
      "Error: 'chainId' must be a valid number in transactions.json"
    );
    return null;
  }

  return parsed;
};

const validateConfigStructure = (
  data: any
): data is { chainId: unknown; transactions: unknown[] } => {
  if (!Array.isArray(data.transactions)) {
    console.error(
      "Error: 'transactions' array is missing in transactions.json"
    );
    return false;
  }

  return true;
};

export const loadConfig = (): BatchTransactionInput | null => {
  try {
    const configPath = join(process.cwd(), "transactions.json");
    const data = JSON.parse(readFileSync(configPath, "utf-8"));

    if (!validateConfigStructure(data)) {
      return null;
    }

    const defaultChainId = parseChainId(data.chainId);
    if (defaultChainId === null) {
      return null;
    }

    return {
      chainId: defaultChainId,
      transactions: data.transactions.map((tx: any) =>
        validateTransaction(tx, defaultChainId)
      ),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load configuration: ${errorMessage}`);
    return null;
  }
};
