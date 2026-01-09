import { ethers } from "ethers";
import {
  BatchTransaction,
  BatchTransactionType,
  BatchWalletConfig,
  DepositTransaction,
  SwapTransaction,
  TransferTransaction,
  WithdrawTransaction,
} from "./types";
import { suppressLogs } from "./logger";
import { IHinkal, ERC20Token, getERC20Token, networkRegistry, ExternalActionId, getUniswapPrice, getAmountInToken } from '@hinkal/common';
import { sleep } from "./sleep";

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  result?: any;
}

const handleResponse = async (tx: any): Promise<ExecutionResult> => {
  if (typeof tx === "bigint") {
    return { success: true, result: { gasEstimate: tx.toString() } };
  }

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
  chainId: number
): Promise<ERC20Token> => {
  return (
    getERC20Token(address, chainId) || {
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
      console.log("getting events");
      await hinkal.getEventsFromHinkal();
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

  signer.sendTransaction = async (
    txReq: ethers.providers.TransactionRequest
  ) => {
    const { maxFeePerGas, maxPriorityFeePerGas, ...txReqWithoutEip1559 } =
      txReq;

    const patched: ethers.providers.TransactionRequest = {
      ...txReqWithoutEip1559,
      type: 0,
    };

    console.log("patched and sending");

    return originalSend(patched);
  };
};

export const initializeHinkal = async (
  wallet: BatchWalletConfig
): Promise<IHinkal> => {
  const { prepareEthersHinkal } = await import(
    "@hinkal/common/providers/prepareEthersHinkal"
  );

  const rpcUrl = networkRegistry[wallet.chainId]?.fetchRpcUrl;
  if (!rpcUrl) throw new Error(`RPC URL not found for chain ${wallet.chainId}`);

  const provider = rpcUrl.includes("wss")
    ? new ethers.providers.WebSocketProvider(rpcUrl)
    : new ethers.providers.StaticJsonRpcProvider(rpcUrl);

  const signer = new ethers.Wallet(wallet.privateKey, provider);

  forceLegacyType0(signer);

  return prepareEthersHinkal(signer);
};

const executeDeposit = async (
  hinkal: IHinkal,
  tx: DepositTransaction
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);

    const result = await suppressLogs(async () => {
      console.log("starting deposit");
      return await hinkal.deposit(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [BigInt(tx.amount)]
      );
    });

    return handleResponse(result);
  } catch (error) {
    return fail(error);
  }
};

const executeWithdraw = async (
  hinkal: IHinkal,
  tx: WithdrawTransaction
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);

    const result = await suppressLogs(async () => {
      return await hinkal.withdraw(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [-BigInt(tx.amount)],
        tx.recipientAddress,
        tx.isRelayerOff ?? false,
        undefined,
        undefined,
        undefined,
        false
      );
    });

    return handleResponse(result);
  } catch (error) {
    return fail(error);
  }
};

const executeTransfer = async (
  hinkal: IHinkal,
  tx: TransferTransaction
): Promise<ExecutionResult> => {
  try {
    const recipient = tx.recipientAddress.trim();

    await syncMerkleTree(hinkal);

    const result = await suppressLogs(async () => {
      return await hinkal.transfer(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [-BigInt(tx.amount)],
        recipient,
        tx.feeToken
      );
    });

    return handleResponse(result);
  } catch (e) {
    return fail(e);
  }
};

const executeSwap = async (
  hinkal: IHinkal,
  tx: SwapTransaction
): Promise<ExecutionResult> => {
  try {
    if (!tx.amountIn) {
      throw new Error("Transaction amountIn is required");
    }
    const chainId = hinkal.getCurrentChainId();

    await syncMerkleTree(hinkal);

    const tokenIn = await getToken(tx.tokenIn, chainId);
    const tokenOut = await getToken(tx.tokenOut, chainId);

    const priceDict = await getUniswapPrice(hinkal, chainId, getAmountInToken(tokenIn, BigInt(tx.amountIn)), tokenIn, tokenOut);

    const result = await suppressLogs(async () => {
      return await hinkal.swap(
        [tokenIn, tokenOut],
        [-BigInt(tx.amountIn), 0n],
        ExternalActionId.Uniswap,
        priceDict.poolFee,
        tx.feeToken
      );
    });

    return handleResponse(result);
  } catch (e) {
    return fail(e);
  }
};

export const executeTransaction = async (
  hinkal: IHinkal,
  tx: BatchTransaction
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
