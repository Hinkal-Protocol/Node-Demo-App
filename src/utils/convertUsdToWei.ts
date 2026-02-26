import { ethers } from "ethers";
import { getTokenPrices, getERC20Token, zeroAddress } from "@hinkal/common";

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
  if (!platform) throw new Error(`Unsupported chain ID: ${chainId}`);

  try {
    const {
      prices: [priceUsd],
    } = await getTokenPrices(chainId, [tokenAddress]);

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
    if (isNaN(usdValue) || usdValue <= 0)
      throw new Error(`Invalid USD amount: ${usdAmount}`);

    const tokenPriceUsd = await getTokenPriceUsd(tokenAddress, chainId);
    if (tokenPriceUsd <= 0) {
      throw new Error(
        `Unable to fetch price for token ${tokenAddress} on chain ${chainId}`
      );
    }

    const tokenAmount = usdValue / tokenPriceUsd;

    const weiAmount = ethers.parseUnits(
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
  try {
    const token = getERC20Token(tokenAddress, chainId);
    return token?.decimals ?? 18;
  } catch (error) {
    console.warn(
      `Could not get decimals for token ${tokenAddress}, defaulting to 18`
    );
    return 18;
  }
};
