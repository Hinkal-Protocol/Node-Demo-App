import { ethers } from "ethers";
import { zeroAddress } from "viem";
import { getTokenPrices, getERC20Token } from '@sabaaa1/common';

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
    const {prices: [priceUsd]} = await getTokenPrices(chainId, [zeroAddress])

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
  if (tokenAddress === zeroAddress) {
    return 18;
  }

  try {
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
