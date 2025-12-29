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

type HinkalInstance = any;
type ERC20Token = any;

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
  const { getERC20Token } = await import("@sabaaa1/common");
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

const syncMerkleTree = async (hinkal: HinkalInstance): Promise<void> => {
  try {
    await hinkal.getEventsFromHinkal();
    await hinkal.resetMerkleTreesIfNecessary();
  } catch (err) {
    console.warn("Warning: Merkle tree sync failed:", err);
  }
};

const forceLegacyType0 = (
  signer: ethers.Wallet,
  provider:
    | ethers.providers.StaticJsonRpcProvider
    | ethers.providers.WebSocketProvider
): void => {
  const originalSend = signer.sendTransaction.bind(signer);

  signer.sendTransaction = async (
    txReq: ethers.providers.TransactionRequest
  ) => {
    let gasPrice = await provider.getGasPrice();

    const GASPRICE_CAP_GWEI = "25";
    const gasPriceCap = ethers.utils.parseUnits(GASPRICE_CAP_GWEI, "gwei");
    if (gasPrice.gt(gasPriceCap)) gasPrice = gasPriceCap;

    const { maxFeePerGas, maxPriorityFeePerGas, ...txReqWithoutEip1559 } =
      txReq;

    const patched: ethers.providers.TransactionRequest = {
      ...txReqWithoutEip1559,
      type: 0,
      gasPrice,
    };

    return originalSend(patched);
  };
};

export const initializeHinkal = async (
  wallet: BatchWalletConfig
): Promise<HinkalInstance> => {
  const { prepareEthersHinkal } = await import(
    "@sabaaa1/common/providers/prepareEthersHinkal"
  );
  const { networkRegistry } = await import("@sabaaa1/common");

  const rpcUrl = networkRegistry[wallet.chainId]?.fetchRpcUrl;
  if (!rpcUrl) throw new Error(`RPC URL not found for chain ${wallet.chainId}`);

  const provider = rpcUrl.includes("wss")
    ? new ethers.providers.WebSocketProvider(rpcUrl)
    : new ethers.providers.StaticJsonRpcProvider(rpcUrl);

  const signer = new ethers.Wallet(wallet.privateKey, provider);

  forceLegacyType0(signer, provider);

  return prepareEthersHinkal(signer);
};

const executeDeposit = async (
  hinkal: HinkalInstance,
  tx: DepositTransaction
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);
    return handleResponse(
      await hinkal.deposit(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [BigInt(tx.amount)]
      )
    );
  } catch (error) {
    return fail(error);
  }
};

const executeWithdraw = async (
  hinkal: HinkalInstance,
  tx: WithdrawTransaction
): Promise<ExecutionResult> => {
  try {
    await syncMerkleTree(hinkal);
    return handleResponse(
      await hinkal.withdraw(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [-BigInt(tx.amount)],
        tx.recipientAddress,
        tx.isRelayerOff ?? false,
        undefined,
        undefined,
        undefined,
        false
      )
    );
  } catch (error) {
    return fail(error);
  }
};

const executeTransfer = async (
  hinkal: HinkalInstance,
  tx: TransferTransaction
): Promise<ExecutionResult> => {
  try {
    const recipient = tx.recipientAddress.trim();

    if (!recipient.includes(",") || recipient.split(",").length !== 3) {
      throw new Error(
        `Invalid Hinkal Address: ${recipient}. Format: "randomization,stealthAddress,encryptionKey".`
      );
    }

    await syncMerkleTree(hinkal);

    return handleResponse(
      await hinkal.transfer(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [BigInt(tx.amount)],
        recipient,
        tx.feeToken
      )
    );
  } catch (e) {
    return fail(e);
  }
};

const executeSwap = async (
  hinkal: HinkalInstance,
  tx: SwapTransaction
): Promise<ExecutionResult> => {
  try {
    const chainId = hinkal.getCurrentChainId();
    const { ExternalActionId, getUniswapPrice } = await import(
      "@sabaaa1/common"
    );

    await syncMerkleTree(hinkal);

    const tokenIn = await getToken(tx.tokenIn, chainId);
    const tokenOut = await getToken(tx.tokenOut, chainId);

    let swapData = tx.swapData || "0x";

    if (swapData === "0x") {
      console.log("Fetching swap quote...");
      const amountInToken = (
        Number(tx.amountIn) / Math.pow(10, tokenIn.decimals)
      ).toString();
      const quote = await getUniswapPrice(
        hinkal,
        chainId,
        amountInToken,
        tokenIn,
        tokenOut
      );
      swapData = quote.poolFee;
      console.log("Quote fetched successfully");
    }

    return handleResponse(
      await hinkal.swap(
        [tokenIn, tokenOut],
        [-BigInt(tx.amountIn), BigInt(0)],
        ExternalActionId.Uniswap,
        swapData,
        undefined
      )
    );
  } catch (e) {
    return fail(e);
  }
};

export const executeTransaction = async (
  hinkal: HinkalInstance,
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
