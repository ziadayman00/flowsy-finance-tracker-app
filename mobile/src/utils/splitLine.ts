import { toCents, moneySubtract, moneyAbs } from './money';

export interface SplitLineGeometry {
  availableRatio: number; // 0.0 to 1.0
  committedRatio: number; // 0.0 to 1.0
  isDeficit: boolean;
  deficitAmount: string;
  isZeroOrNegativeLiquid: boolean;
}

/**
 * Calculates exact geometry ratios for the Split Line signature component
 */
export function calculateSplitGeometry(
  totalLiquidFunds: string | number,
  totalPendingCommitments: string | number,
): SplitLineGeometry {
  const liquidCents = toCents(totalLiquidFunds);
  const commCents = toCents(totalPendingCommitments);

  if (liquidCents <= 0n) {
    const deficitStr = moneySubtract(totalPendingCommitments, totalLiquidFunds);
    return {
      availableRatio: 0,
      committedRatio: commCents > 0n ? 1 : 0,
      isDeficit: true,
      deficitAmount: moneyAbs(deficitStr),
      isZeroOrNegativeLiquid: true,
    };
  }

  if (commCents > liquidCents) {
    const deficitStr = moneySubtract(totalPendingCommitments, totalLiquidFunds);
    return {
      availableRatio: 0,
      committedRatio: 1,
      isDeficit: true,
      deficitAmount: moneyAbs(deficitStr),
      isZeroOrNegativeLiquid: false,
    };
  }

  const lNum = Number(liquidCents);
  const cNum = Number(commCents);

  const committedRatio = cNum > 0 ? cNum / lNum : 0;
  const availableRatio = Math.max(0, 1 - committedRatio);

  return {
    availableRatio,
    committedRatio,
    isDeficit: false,
    deficitAmount: '0.00',
    isZeroOrNegativeLiquid: false,
  };
}
