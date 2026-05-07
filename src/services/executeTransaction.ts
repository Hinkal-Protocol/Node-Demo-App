import { ethers } from "ethers";
import {
  BatchTransaction,
  BatchTransactionType,
  BatchWalletConfig,
  DepositTransaction,
  SwapTransaction,
  TransferTransaction,
  WithdrawTransaction,
} from "../types";
import { suppressLogs } from "../utils/logger";
import {
  IHinkal,
  ERC20Token,
  getErc20Token,
  ExternalActionId,
  getUniswapPrice,
  prepareEthersHinkal,
  getFeeStructure,
} from "@gurg/hi-test";
import { sleep } from "../utils/sleep";
import { getChainIdFromHinkal } from "../utils/generalUtils";
import { networkRegistry } from "../constants";
import { getAmountInToken } from "../utils/amount.utils";

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  result?: any;
}

const getFee = async (
  hinkal: IHinkal,
  tokenAddress: string,
  actionId: ExternalActionId = ExternalActionId.Transact,
) => {
  const chainId = getChainIdFromHinkal(hinkal);
  try {
    return await getFeeStructure(
      chainId,
      tokenAddress,
      [tokenAddress],
      actionId,
    );
  } catch {
    return undefined;
  }
};

const handleResponse = async (tx: any): Promise<ExecutionResult> => {
  if (typeof tx === "bigint")
    return { success: true, result: { gasEstimate: tx.toString() } };

  if (tx?.transactionHash && typeof tx.transactionHash === "string") {
    return {
      success: true,
      txHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed?.toString(),
    };
  }

  if (tx?.wait instanceof Function) {
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    };
  }

  return {
    success: true,
    txHash: tx.hash || tx.transactionHash,
    blockNumber: tx.blockNumber,
    gasUsed: tx.gasUsed?.toString() || tx.gasUsed?.hex,
  };
};

const getToken = async (
  address: string,
  chainId: number,
): Promise<ERC20Token> => {
  return (
    getErc20Token(chainId, address) || {
      chainId,
      erc20TokenAddress: address,
      name: "Unknown",
      symbol: "???",
      decimals: 18,
    }
  );
};

const fail = (error: unknown): ExecutionResult => {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  return { success: false, error: errorMessage };
};

const syncMerkleTree = async (hinkal: IHinkal): Promise<void> => {
  try {
    await suppressLogs(async () => {
      await sleep(20 * 1000);
      console.log("resetting merkle trees");
      await hinkal.resetMerkleTreesIfNecessary();
    });
  } catch (err) {
    console.log(err);
    if (err instanceof Error && !err.message.includes("CustomEvent")) {
      console.warn("⚠️  Merkle tree sync warning:", err.message);
    }
  }
};

const forceLegacyType0 = (signer: ethers.Wallet): void => {
  const originalSend = signer.sendTransaction.bind(signer);

  signer.sendTransaction = async (txReq: ethers.TransactionRequest) => {
    const { maxFeePerGas, maxPriorityFeePerGas, ...txReqWithoutEip1559 } =
      txReq;

    const patched: ethers.TransactionRequest = {
      ...txReqWithoutEip1559,
      type: 0,
    };

    console.log("patched and sending");

    return originalSend(patched);
  };
};

export const initializeHinkal = async (
  wallet: BatchWalletConfig,
): Promise<IHinkal> => {
  const rpcUrl = networkRegistry[wallet.chainId]?.fetchRpcUrl;
  if (!rpcUrl) throw new Error(`RPC URL not found for chain ${wallet.chainId}`);

  const provider = rpcUrl.includes("wss")
    ? new ethers.WebSocketProvider(rpcUrl)
    : new ethers.JsonRpcProvider(rpcUrl);

  const signer = new ethers.Wallet(wallet.privateKey, provider);

  forceLegacyType0(signer);

  return prepareEthersHinkal(signer);
};

const executeDeposit = async (
  hinkal: IHinkal,
  tx: DepositTransaction,
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);

    const result = await suppressLogs(async () => {
      return await hinkal.deposit(
        [await getToken(tx.tokenAddress, getChainIdFromHinkal(hinkal))],
        [BigInt(tx.amount)],
      );
    });

    return handleResponse(result);
  } catch (error) {
    return fail(error);
  }
};

const executeWithdraw = async (
  hinkal: IHinkal,
  tx: WithdrawTransaction,
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);
    const token = await getToken(tx.tokenAddress, getChainIdFromHinkal(hinkal));
    const fee = await getFee(hinkal, tx.tokenAddress);

    const result = await suppressLogs(async () => {
      return await hinkal.withdraw(
        [token],
        [-BigInt(tx.amount)],
        tx.recipientAddress,
        tx.isRelayerOff ?? false,
        tx.feeToken,
        fee,
      );
    });

    return handleResponse(result);
  } catch (error) {
    return fail(error);
  }
};

const executeTransfer = async (
  hinkal: IHinkal,
  tx: TransferTransaction,
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);
    const token = await getToken(tx.tokenAddress, getChainIdFromHinkal(hinkal));
    const fee = await getFee(hinkal, tx.tokenAddress);

    const result = await suppressLogs(async () => {
      return await hinkal.transfer(
        [token],
        [-BigInt(tx.amount)],
        tx.recipientAddress.trim(),
        tx.feeToken,
        fee,
      );
    });

    return handleResponse(result);
  } catch (e) {
    return fail(e);
  }
};

const executeSwap = async (
  hinkal: IHinkal,
  tx: SwapTransaction,
): Promise<ExecutionResult> => {
  try {
    if (!tx.amountIn) throw new Error("Transaction amountIn is required, ");

    const chainId = getChainIdFromHinkal(hinkal);
    console.log("chainId", { tx });

    await syncMerkleTree(hinkal);

    console.log("synced merkle tree");

    const tokenIn = await getToken(tx.tokenIn, chainId);
    const tokenOut = await getToken(tx.tokenOut, chainId);
    const fee = await getFee(hinkal, tx.tokenIn, ExternalActionId.Uniswap);

    const priceDict = await getUniswapPrice(
      hinkal,
      chainId,
      getAmountInToken(tokenIn, BigInt(tx.amountIn)),
      tokenIn,
      tokenOut,
    );

    console.log({ tokenIn, tokenOut, priceDict });

    const result = await hinkal.swap(
      [tokenIn, tokenOut],
      [-BigInt(tx.amountIn), 0n],
      ExternalActionId.Uniswap,
      priceDict.poolFee,
      tx.feeToken,
      fee,
    );

    console.log("after transaction", { result });

    return handleResponse(result);
  } catch (e) {
    console.log("swap error", { e });
    return fail(e);
  }
};

export const executeTransaction = async (
  hinkal: IHinkal,
  tx: BatchTransaction,
): Promise<ExecutionResult> => {
  try {
    switch (tx.type) {
      case BatchTransactionType.Deposit:
        return await executeDeposit(hinkal, tx as DepositTransaction);
      case BatchTransactionType.Withdraw:
        return await executeWithdraw(hinkal, tx as WithdrawTransaction);
      case BatchTransactionType.Transfer:
        return await executeTransfer(hinkal, tx as TransferTransaction);
      case BatchTransactionType.Swap:
        return await executeSwap(hinkal, tx as SwapTransaction);
      default:
        return {
          success: false,
          error: `Unknown transaction type: ${(tx as any).type}`,
        };
    }
  } catch (error) {
    return fail(error);
  }
};
