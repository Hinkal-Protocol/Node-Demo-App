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
    txHash: tx.transactionHash,
    blockNumber: tx.blockNumber,
    gasUsed: tx.gasUsed?.hex,
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

const fail = async (error: unknown): Promise<ExecutionResult> => {
  const { getErrorMessage } = await import("@sabaaa1/common");
  return { success: false, error: getErrorMessage(error) };
};

export const initializeHinkal = async (
  wallet: BatchWalletConfig
): Promise<HinkalInstance> => {
  const { prepareEthersHinkal } = await import(
    "@sabaaa1/common/providers/prepareEthersHinkal"
  );
  const { networkRegistry, createTorRpcProvider } = await import(
    "@sabaaa1/common"
  );

  const rpcUrl = networkRegistry[wallet.chainId]?.fetchRpcUrl;
  if (!rpcUrl) throw new Error(`RPC URL not found for chain ${wallet.chainId}`);

  let provider;
  try {
    provider = createTorRpcProvider(rpcUrl);
  } catch {
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  return prepareEthersHinkal(new ethers.Wallet(wallet.privateKey, provider));
};

const executeDeposit = async (
  hinkal: HinkalInstance,
  tx: DepositTransaction
): Promise<ExecutionResult> => {
  try {
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
    return handleResponse(
      await hinkal.withdraw(
        [await getToken(tx.tokenAddress, hinkal.getCurrentChainId())],
        [BigInt(tx.amount)],
        tx.recipientAddress,
        tx.isRelayerOff ?? false,
        tx.feeToken
      )
    );
  } catch (e) {
    return fail(e);
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
    const { ExternalActionId } = await import("@sabaaa1/common");

    return handleResponse(
      await hinkal.swap(
        [
          await getToken(tx.tokenIn, chainId),
          await getToken(tx.tokenOut, chainId),
        ],
        [BigInt(tx.amountIn), BigInt(0)],
        tx.externalActionId || ExternalActionId.Uniswap,
        tx.swapData,
        tx.feeToken
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
  switch (tx.type) {
    case BatchTransactionType.Deposit:
      return executeDeposit(hinkal, tx as DepositTransaction);
    case BatchTransactionType.Withdraw:
      return executeWithdraw(hinkal, tx as WithdrawTransaction);
    case BatchTransactionType.Transfer:
      return executeTransfer(hinkal, tx as TransferTransaction);
    case BatchTransactionType.Swap:
      return executeSwap(hinkal, tx as SwapTransaction);
    default:
      return {
        success: false,
        error: `Unknown transaction type: ${(tx as any).type}`,
      };
  }
};
