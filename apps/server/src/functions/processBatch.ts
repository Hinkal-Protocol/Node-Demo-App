import { BatchTransactionInput } from "./types";
import { executeTransaction, initializeHinkal } from "./executeTransaction";
import { ethers } from "ethers";
import {
  logBatchStart,
  logTransaction,
  logWallet,
  logWarning,
  logSuccess,
  logBatchFailure,
  logBatchComplete,
} from "./logger";
import { networkRegistry } from "@hinkal/common";

export interface BatchProcessResult {
  jobId: string;
  success: boolean;
  totalTransactions: number;
  completedTransactions: number;
  failedTransactionId?: string;
  error?: string;
}

const providerCache = new Map<number, ethers.providers.Provider>();
const hinkalCache = new Map<string, any>();

const getProvider = (
  chainId: number,
  rpcUrl: string
): ethers.providers.Provider => {
  if (!providerCache.has(chainId)) {
    providerCache.set(chainId, new ethers.providers.JsonRpcProvider(rpcUrl));
  }
  return providerCache.get(chainId)!;
};

const getHinkal = async (walletConfig: {
  privateKey: string;
  chainId: number;
}): Promise<any> => {
  const key = `${walletConfig.privateKey}-${walletConfig.chainId}`;
  if (!hinkalCache.has(key)) {
    hinkalCache.set(key, await initializeHinkal(walletConfig));
  }
  return hinkalCache.get(key)!;
};

export const processBatch = async (
  input: BatchTransactionInput
): Promise<BatchProcessResult> => {
  const jobId = `batch-${Date.now()}`;
  const startTime = Date.now();
  let completedCount = 0;

  try {
    if (!input.transactions?.length) {
      throw new Error("No transactions found in batch");
    }

    logBatchStart(jobId, input.transactions.length, input.chainId);

    for (let i = 0; i < input.transactions.length; i++) {
      const tx = input.transactions[i];
      const chainId = tx.chainId || input.chainId;

      if (!chainId) {
        throw new Error(
          `Transaction ${tx.id}: missing chainId (not specified in transaction or default)`
        );
      }

      if (!tx.privateKey) {
        throw new Error(`Transaction ${tx.id}: missing privateKey`);
      }

      const rpcUrl = networkRegistry[chainId]?.fetchRpcUrl;
      if (!rpcUrl) {
        throw new Error(`RPC URL not found for chain ${chainId}`);
      }

      const provider = getProvider(chainId, rpcUrl);
      const wallet = new ethers.Wallet(tx.privateKey, provider);
      const walletAddress = wallet.address;
      const balance = await provider.getBalance(walletAddress);
      const balanceNative = ethers.utils.formatEther(balance);

      logTransaction(i + 1, input.transactions.length, tx.type, tx.id);
      logWallet(walletAddress, balanceNative, chainId);

      if (parseFloat(balanceNative) < 0.01) {
        logWarning("Low balance warning - may fail due to insufficient gas");
      }

      const walletConfig = {
        privateKey: tx.privateKey,
        chainId,
      };

      const hinkal = await getHinkal(walletConfig);
      const result = await executeTransaction(hinkal, tx);

      if (!result.success) {
        const errorMessage = result.error || "Unknown error";
        logBatchFailure(tx.id, i + 1, input.transactions.length, errorMessage);

        return {
          jobId,
          success: false,
          totalTransactions: input.transactions.length,
          completedTransactions: completedCount,
          failedTransactionId: tx.id,
          error: errorMessage,
        };
      }

      completedCount++;
      if (result.txHash) {
        logSuccess(result.txHash, result.blockNumber, result.gasUsed);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logBatchComplete(duration, completedCount, input.transactions.length);

    return {
      jobId,
      success: true,
      totalTransactions: input.transactions.length,
      completedTransactions: completedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Critical batch failure: ${errorMessage}`);

    return {
      jobId,
      success: false,
      totalTransactions: input.transactions?.length || 0,
      completedTransactions: completedCount,
      error: errorMessage,
    };
  }
};
