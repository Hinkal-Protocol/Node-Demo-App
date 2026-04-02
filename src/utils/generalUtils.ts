import { IHinkal } from "h_test_1";

export const getChainIdFromHinkal = (hinkal: IHinkal) => {
  const providerAdapter = hinkal.getProviderAdapter();
  const chainId = providerAdapter.getChainId();
  if (!chainId) throw new Error("Chain ID not found");
  return chainId;
};
