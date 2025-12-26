import { readFileSync } from "fs";
import { join } from "path";
import { BatchTransactionInput, BatchTransaction } from "./types";

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

  const chainId = tx.chainId || defaultChainId;
  if (!chainId) {
    throw new Error(
      `Transaction ${tx.id}: missing 'chainId' (not specified in transaction or default)`
    );
  }

  switch (tx.type) {
    case "deposit":
      if (!tx.tokenAddress) {
        throw new Error(`Transaction ${tx.id}: missing 'tokenAddress'`);
      }
      if (!tx.amount) {
        throw new Error(`Transaction ${tx.id}: missing 'amount'`);
      }
      break;

    case "withdraw":
      if (!tx.tokenAddress) {
        throw new Error(`Transaction ${tx.id}: missing 'tokenAddress'`);
      }
      if (!tx.amount) {
        throw new Error(`Transaction ${tx.id}: missing 'amount'`);
      }
      if (!tx.recipientAddress) {
        throw new Error(`Transaction ${tx.id}: missing 'recipientAddress'`);
      }
      break;

    case "transfer":
      if (!tx.tokenAddress) {
        throw new Error(`Transaction ${tx.id}: missing 'tokenAddress'`);
      }
      if (!tx.amount) {
        throw new Error(`Transaction ${tx.id}: missing 'amount'`);
      }
      if (!tx.recipientAddress) {
        throw new Error(`Transaction ${tx.id}: missing 'recipientAddress'`);
      }

      const recipient = String(tx.recipientAddress).trim();
      if (!recipient.includes(",") || recipient.split(",").length !== 3) {
        throw new Error(
          `Transaction ${tx.id}: Invalid recipient format. Must be "randomization,stealthAddress,encryptionKey".`
        );
      }
      break;

    case "swap":
      if (!tx.tokenIn) {
        throw new Error(`Transaction ${tx.id}: missing 'tokenIn'`);
      }
      if (!tx.tokenOut) {
        throw new Error(`Transaction ${tx.id}: missing 'tokenOut'`);
      }
      if (!tx.amountIn) {
        throw new Error(`Transaction ${tx.id}: missing 'amountIn'`);
      }
      if (!tx.swapData) {
        throw new Error(`Transaction ${tx.id}: missing 'swapData'`);
      }
      break;

    case "privateWallet":
      if (!tx.erc20Addresses) {
        throw new Error(`Transaction ${tx.id}: missing 'erc20Addresses'`);
      }
      if (!tx.deltaAmounts) {
        throw new Error(`Transaction ${tx.id}: missing 'deltaAmounts'`);
      }
      if (!tx.onChainCreation) {
        throw new Error(`Transaction ${tx.id}: missing 'onChainCreation'`);
      }
      if (!tx.operations) {
        throw new Error(`Transaction ${tx.id}: missing 'operations'`);
      }
      break;

    default:
      throw new Error(
        `Transaction ${tx.id}: Unknown transaction type '${tx.type}'`
      );
  }

  return { ...tx, chainId } as BatchTransaction;
};

export const loadConfig = (): BatchTransactionInput | null => {
  try {
    const configPath = join(process.cwd(), "transactions.json");
    const fileContent = readFileSync(configPath, "utf-8");
    const data = JSON.parse(fileContent);

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

    const transactions = data.transactions.map((tx: any) =>
      validateTransaction(tx, defaultChainId)
    );

    return {
      chainId: defaultChainId,
      transactions,
    };
  } catch (error) {
    console.error(`Failed to load configuration: ${(error as Error).message}`);
    return null;
  }
};
