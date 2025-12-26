import { ethers } from "ethers";
import {
  BatchTransaction,
  BatchTransactionType,
  BatchWalletConfig,
  DepositTransaction,
  PrivateWalletTransaction,
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

const formatError = (error: any): string => {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("insufficient funds") ||
    msg.includes("INSUFFICIENT_FUNDS") ||
    msg.includes("gas required exceeds allowance") ||
    msg.includes("UNPREDICTABLE_GAS_LIMIT")
  ) {
    return "Insufficient ETH for gas fees. Please fund the wallet.";
  }
  return msg;
};

const handleResponse = async (tx: any): Promise<ExecutionResult> => {
  if (typeof tx === "bigint") {
    return { success: true, result: { gasEstimate: tx.toString() } };
  }

  if ("wait" in tx && typeof tx.wait === "function") {
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

  const signer = new ethers.Wallet(wallet.privateKey, provider);
  return prepareEthersHinkal(signer);
};

const executeDeposit = async (
  hinkal: HinkalInstance,
  tx: DepositTransaction
): Promise<ExecutionResult> => {
  try {
    const token = await getToken(tx.tokenAddress, hinkal.getCurrentChainId());
    const res = await hinkal.deposit([token], [BigInt(tx.amount)]);
    return handleResponse(res);
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

const executeWithdraw = async (
  hinkal: HinkalInstance,
  tx: WithdrawTransaction
): Promise<ExecutionResult> => {
  try {
    const token = await getToken(tx.tokenAddress, hinkal.getCurrentChainId());
    const res = await hinkal.withdraw(
      [token],
      [BigInt(tx.amount)],
      tx.recipientAddress,
      tx.isRelayerOff ?? false,
      tx.feeToken
    );
    return handleResponse(res);
  } catch (error) {
    return { success: false, error: formatError(error) };
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

    const token = await getToken(tx.tokenAddress, hinkal.getCurrentChainId());
    const res = await hinkal.transfer(
      [token],
      [BigInt(tx.amount)],
      recipient,
      tx.feeToken
    );
    return handleResponse(res);
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

const executeSwap = async (
  hinkal: HinkalInstance,
  tx: SwapTransaction
): Promise<ExecutionResult> => {
  try {
    const chainId = hinkal.getCurrentChainId();
    const tokens = [
      await getToken(tx.tokenIn, chainId),
      await getToken(tx.tokenOut, chainId),
    ];
    const { ExternalActionId } = await import("@sabaaa1/common");

    const res = await hinkal.swap(
      tokens,
      [BigInt(tx.amountIn), BigInt(0)],
      tx.externalActionId || ExternalActionId.Uniswap,
      tx.swapData,
      tx.feeToken
    );
    return handleResponse(res);
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

const executePrivateWallet = async (
  hinkal: HinkalInstance,
  tx: PrivateWalletTransaction
): Promise<ExecutionResult> => {
  try {
    const res = await hinkal.actionPrivateWallet(
      tx.erc20Addresses,
      tx.deltaAmounts.map(BigInt),
      tx.onChainCreation,
      tx.operations,
      tx.emporiumTokenChanges
        ? await Promise.all(
            tx.emporiumTokenChanges.map(async (change) => ({
              token: await getToken(
                change.tokenAddress,
                hinkal.getCurrentChainId()
              ),
              amount: BigInt(change.amount),
            }))
          )
        : [],
      undefined,
      tx.feeToken
    );
    return handleResponse(res);
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

export const executeTransaction = async (
  hinkal: HinkalInstance,
  transaction: BatchTransaction
): Promise<ExecutionResult> => {
  try {
    switch (transaction.type) {
      case BatchTransactionType.Deposit:
        return await executeDeposit(hinkal, transaction as DepositTransaction);
      case BatchTransactionType.Withdraw:
        return await executeWithdraw(
          hinkal,
          transaction as WithdrawTransaction
        );
      case BatchTransactionType.Transfer:
        return await executeTransfer(
          hinkal,
          transaction as TransferTransaction
        );
      case BatchTransactionType.Swap:
        return await executeSwap(hinkal, transaction as SwapTransaction);
      case BatchTransactionType.PrivateWallet:
        return await executePrivateWallet(
          hinkal,
          transaction as PrivateWalletTransaction
        );
      default:
        return {
          success: false,
          error: `Unknown transaction type: ${(transaction as any).type}`,
        };
    }
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};
