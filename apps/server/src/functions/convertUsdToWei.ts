import { ethers } from "ethers";

const getTokenPriceUsd = async (
  tokenAddress: string,
  chainId: number
): Promise<number> => {
  const chainIdToPlatform: Record<number, string> = {
    1: "ethereum",
    10: "optimistic-ethereum",
    137: "polygon-pos",
    42161: "arbitrum-one",
    8453: "base",
  };

  const platform = chainIdToPlatform[chainId];
  if (!platform) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const isNative =
    tokenAddress === "0x0000000000000000000000000000000000000000";

  try {
    const { getCoingeckoPrice, getCoingeckoPrice2, getTokenPrice } =
      await import("@sabaaa1/common");

    let priceUsd = 0;

    if (isNative) {
      try {
        const priceData = await getCoingeckoPrice("ethereum");
        priceUsd = priceData.usd || 0;
      } catch (error) {
        console.warn(
          "getCoingeckoPrice failed, trying getTokenPrice...",
          error
        );
        const priceData = await getTokenPrice(chainId);
        priceUsd = priceData.price || 0;
      }
    } else {
      try {
        const priceData = await getCoingeckoPrice2(
          tokenAddress.toLowerCase(),
          platform
        );
        priceUsd = priceData.usd || 0;
      } catch (error) {
        console.warn(
          "getCoingeckoPrice2 failed, trying getTokenPrice...",
          error
        );
        const priceData = await getTokenPrice(chainId, tokenAddress);
        priceUsd = priceData.price || 0;
      }
    }

    if (priceUsd <= 0) {
      throw new Error(
        `Unable to fetch price for token ${tokenAddress} on chain ${chainId}`
      );
    }

    return priceUsd;
  } catch (error) {
    console.error("Error fetching token price:", error);
    throw error;
  }
};

export const convertUsdToWei = async (
  usdAmount: string,
  tokenAddress: string,
  chainId: number,
  decimals: number = 18
): Promise<string> => {
  try {
    const usdValue = parseFloat(usdAmount);
    if (isNaN(usdValue) || usdValue <= 0) {
      throw new Error(`Invalid USD amount: ${usdAmount}`);
    }

    const tokenPriceUsd = await getTokenPriceUsd(tokenAddress, chainId);
    if (tokenPriceUsd <= 0) {
      throw new Error(
        `Unable to fetch price for token ${tokenAddress} on chain ${chainId}`
      );
    }

    const tokenAmount = usdValue / tokenPriceUsd;

    const weiAmount = ethers.utils.parseUnits(
      tokenAmount.toFixed(decimals),
      decimals
    );

    return weiAmount.toString();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert USD to wei: ${errorMessage}`);
  }
};

export const getTokenDecimals = async (
  tokenAddress: string,
  chainId: number
): Promise<number> => {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return 18;
  }

  try {
    const { getERC20Token } = await import("@sabaaa1/common");
    const token = getERC20Token(tokenAddress, chainId);
    return token?.decimals || 18;
  } catch (error) {
    console.warn(
      `Could not get decimals for token ${tokenAddress}, defaulting to 18`
    );
    return 18;
  }
};

export const isUsdAmount = (amount: string): boolean => {
  if (amount.includes(".")) {
    return true;
  }

  const numValue = parseFloat(amount);
  if (!isNaN(numValue) && numValue < 1e15) {
    return true;
  }

  return false;
};
