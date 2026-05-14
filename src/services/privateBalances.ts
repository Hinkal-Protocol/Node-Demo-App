import {
  IHinkal,
  refreshBalance,
  type PrivateBalancesState,
} from "@gurg/hi-test";
import { getAmountInToken } from "../utils/amount.utils";
import { logAlways } from "../utils/logger";

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
        .map(
          (b) =>
            `${b.token.symbol}=${getAmountInToken(b.token, b.balance)} (~$${(b.usdValue ?? 0).toFixed(2)})`,
        )
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
