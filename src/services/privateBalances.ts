import { IHinkal, type PrivateBalancesState } from "@hinkal/common";
import { getAmountInToken } from "../utils/amount.utils";
import { logAlways } from "../utils/logger";
import { findToken } from "../constants/token-data";

function formatPrivateBalances(state: PrivateBalancesState): string {
  const ids = Object.keys(state)
    .map(Number)
    .sort((a, b) => a - b);
  if (!ids.length) return "(empty)";
  return ids
    .map((cid) => {
      const rows = state[cid];
      if (!rows?.length) return `chain ${cid}: (none)`;
      const line = rows
        .filter((b) => b.balance > 0n)
        .map((b) => {
          const token = findToken(cid, b.erc20Address);
          if (!token) return "Unknown token";
          const amount = getAmountInToken(token, b.balance);
          return `${token.symbol}=${amount} (~$${(b.usdValue ?? 0).toFixed(2)})`;
        })
        .join(" | ");
      return line ? `chain ${cid}: ${line}` : `chain ${cid}: (none)`;
    })
    .join("\n");
}

export function attachPrivateBalancesStoreConsoleLogger(
  hinkal: IHinkal,
): () => void {
  const log = () =>
    logAlways(
      "🔒 Private balances\n" +
        formatPrivateBalances(hinkal.privateBalancesWithUSD),
    );
  log();
  return hinkal.onPrivateBalancesWithUSDChange(log);
}
