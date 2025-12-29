const SUPPRESS_SDK_LOGS = process.env.SUPPRESS_SDK_LOGS !== "false";

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const isVerboseSDKLog = (args: any[]): boolean => {
  if (args.length === 0) return false;

  const firstArg = args[0];
  const message = String(firstArg);

  if (typeof firstArg === "object" && firstArg !== null) {
    return (
      "publicSignalCount" in firstArg ||
      "verifier" in firstArg ||
      "publicSignals" in firstArg ||
      "circomData" in firstArg ||
      "gasCosts" in firstArg ||
      "signerAddress" in firstArg ||
      "chainIdHinkal" in firstArg ||
      "ethersNetwork" in firstArg
    );
  }

  return (
    message.includes("publicSignalCount") ||
    message.includes("verifier:") ||
    message.includes("publicSignals:") ||
    message.includes("circomData:") ||
    message.includes("gasCosts:") ||
    message.includes("signerAddress:") ||
    message.includes("chainIdHinkal:") ||
    message.includes("ethersNetwork:")
  );
};

const isCustomEventError = (args: any[]): boolean => {
  if (args.length === 0) return false;

  for (const arg of args) {
    const message = String(arg);

    if (
      message.includes("CustomEvent") ||
      message.includes("retrieveEvents error")
    ) {
      return true;
    }

    if (typeof arg === "object" && arg !== null) {
      if ("err" in arg) {
        const errMessage = String(arg.err || "");
        if (errMessage.includes("CustomEvent")) {
          return true;
        }
      }
      try {
        const objString = JSON.stringify(arg);
        if (
          objString.includes("CustomEvent") ||
          objString.includes("retrieveEvents error")
        ) {
          return true;
        }
      } catch {
        const objString = String(arg);
        if (
          objString.includes("CustomEvent") ||
          objString.includes("retrieveEvents error")
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

export const initializeLogger = (): void => {
  if (!SUPPRESS_SDK_LOGS) {
    return;
  }

  console.log = (...args: any[]) => {
    if (isVerboseSDKLog(args) || isCustomEventError(args)) {
      return;
    }
    originalLog(...args);
  };

  console.warn = (...args: any[]) => {
    if (isCustomEventError(args)) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    if (isCustomEventError(args)) {
      return;
    }
    originalError(...args);
  };
};

export const suppressLogs = <T>(fn: () => T | Promise<T>): T | Promise<T> => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }) as Promise<T>;
    }
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    return result;
  } catch (error) {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    throw error;
  }
};

export const logTransaction = (
  index: number,
  total: number,
  type: string,
  id: string
): void => {
  console.log("\n" + "=".repeat(60));
  console.log(`📝 [${index}/${total}] ${type.toUpperCase()}: ${id}`);
};

export const logWallet = (
  address: string,
  balance: string,
  chainId: number
): void => {
  console.log(`💰 Wallet: ${address}`);
  console.log(`💵 Balance: ${balance} ETH | Chain: ${chainId}`);
};

export const logConversion = (
  usdAmount: string,
  ethAmount: string,
  weiAmount: string
): void => {
  console.log(`   💱 ${usdAmount} USD → ${ethAmount} ETH (${weiAmount} wei)`);
};

export const logSuccess = (
  txHash: string,
  blockNumber?: number,
  gasUsed?: string
): void => {
  console.log(`✅ Success! Transaction: ${txHash}`);
  if (blockNumber) {
    console.log(`   Block: ${blockNumber}`);
  }
  if (gasUsed) {
    console.log(`   Gas used: ${gasUsed}`);
  }
};

export const logError = (message: string, details?: string): void => {
  console.error(`\n❌ ${message}`);
  if (details) {
    console.error(`   ${details}`);
  }
};

export const logWarning = (message: string): void => {
  console.warn(`⚠️  ${message}`);
};

export const logBatchStart = (
  jobId: string,
  transactionCount: number,
  chainId: number
): void => {
  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Starting Batch Processing`);
  console.log(`   Job ID: ${jobId}`);
  console.log(`   Transactions: ${transactionCount}`);
  console.log(`   Chain ID: ${chainId}`);
  console.log("=".repeat(60));
};

export const logBatchComplete = (
  duration: string,
  completed: number,
  total: number
): void => {
  console.log("\n" + "=".repeat(60));
  console.log(`✅ Batch Completed Successfully!`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Transactions: ${completed}/${total}`);
  console.log("=".repeat(60) + "\n");
};

export const logBatchFailure = (
  txId: string,
  index: number,
  total: number,
  error: string
): void => {
  console.error(`\n❌ Transaction failed: ${txId}`);
  console.error(`   Error: ${error}`);
  console.error(`\n🛑 Batch stopped at transaction ${index}/${total}`);
};
