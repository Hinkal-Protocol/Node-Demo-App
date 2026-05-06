import { readFileSync } from "fs";
import { join } from "path";
import {
  BatchTransactionInput,
  BatchTransaction,
  BatchTransactionType,
} from "../types";

const TRANSACTIONS_FILE_NAME = "transactions.json";

const REQUIRED_FIELDS: Record<BatchTransactionType, string[]> = {
  [BatchTransactionType.Deposit]: ["tokenAddress", "amount"],
  [BatchTransactionType.Withdraw]: [
    "tokenAddress",
    "recipientAddress",
    "amount",
  ],
  [BatchTransactionType.Transfer]: [
    "tokenAddress",
    "recipientAddress",
    "amount",
  ],
  [BatchTransactionType.Swap]: ["tokenIn", "tokenOut", "amountIn"],
};

const validateRequiredField = (tx: any, field: string, txId: string): void => {
  if (!tx[field]) throw new Error(`Transaction ${txId}: missing '${field}'`);
};

const validateTransferRecipient = (recipient: string, txId: string): void => {
  const trimmed = recipient.trim();
  if (!trimmed.includes(",") || trimmed.split(",").length !== 5)
    throw new Error(`Transaction ${txId}: Invalid recipient format".`);
};

const validateTransaction = async (
  tx: any,
  defaultChainId: number,
): Promise<BatchTransaction> => {
  const txId = tx.id || "unknown";

  if (!tx.id || !tx.type)
    throw new Error(`Transaction ${txId}: missing 'id' or 'type'`);

  validateRequiredField(tx, "privateKey", txId);

  const requiredFields = REQUIRED_FIELDS[tx.type as BatchTransactionType];
  if (!requiredFields) {
    throw new Error(
      `Transaction ${txId}: Unknown transaction type '${tx.type}'`,
    );
  }

  for (const field of requiredFields) {
    validateRequiredField(tx, field, txId);
  }

  if (tx.type === BatchTransactionType.Transfer)
    validateTransferRecipient(tx.recipientAddress, txId);

  const chainId = tx.chainId || defaultChainId;
  if (!chainId)
    throw new Error(
      `Transaction ${txId}: missing 'chainId' (not specified in transaction or default)`,
    );

  const processedTx = { ...tx, chainId };

  const amountField =
    tx.type === BatchTransactionType.Swap ? "amountIn" : "amount";
  const amountValue = processedTx[amountField];

  if (!amountValue || typeof amountValue !== "string") {
    throw new Error(
      `Transaction ${txId}: '${amountField}' must be a valid string`,
    );
  }
  try {
    BigInt(amountValue);
  } catch {
    throw new Error(
      `Transaction ${txId}: '${amountField}' value '${amountValue}' cannot be converted to BigInt`,
    );
  }

  return processedTx as BatchTransaction;
};

const parseChainId = (chainId: unknown): number | null => {
  if (chainId === undefined || chainId === null) {
    console.error("Error: 'chainId' is missing in ", {
      TRANSACTIONS_FILE_NAME,
    });
    return null;
  }

  const parsed =
    typeof chainId === "number" ? chainId : parseInt(String(chainId), 10);
  if (isNaN(parsed)) {
    console.error("Error: 'chainId' must be a valid number in ", {
      TRANSACTIONS_FILE_NAME,
    });
    return null;
  }

  return parsed;
};

const validateConfigStructure = (
  data: any,
): data is { chainId: unknown; transactions: unknown[] } => {
  if (!Array.isArray(data.transactions)) {
    console.error("Error: 'transactions' array is missing in ", {
      TRANSACTIONS_FILE_NAME,
    });
    return false;
  }

  return true;
};

export const loadConfig = async (): Promise<BatchTransactionInput | null> => {
  try {
    const configPath = join(process.cwd(), TRANSACTIONS_FILE_NAME);
    const data = JSON.parse(readFileSync(configPath, "utf-8"));

    if (!validateConfigStructure(data)) return null;

    const defaultChainId = parseChainId(data.chainId);
    if (defaultChainId === null) return null;

    const transactions: BatchTransaction[] = [];
    for (const tx of data.transactions) {
      const processedTx = await validateTransaction(tx, defaultChainId);
      transactions.push(processedTx);
    }

    return {
      chainId: defaultChainId,
      transactions,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load configuration: ${errorMessage}`);
    return null;
  }
};
