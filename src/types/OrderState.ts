import BigNumber from 'bignumber.js';

export interface OrderRelevantState {
  makerCollateralBalance: BigNumber;
  makerCollateralAllowance: BigNumber;
  makerFeeBalance: BigNumber;
  makerFeeAllowance: BigNumber;
  remainingMakerFillableQty: BigNumber;
  remainingTakerFillableQty: BigNumber;
}

export interface OrderStateValid {
  isValid: true;
  orderHash: string;
  orderRelevantState: OrderRelevantState;
}

export interface OrderStateInvalid {
  isValid: false;
  orderHash: string;
  error: [string];
}

export type OrderState = OrderStateValid | OrderStateInvalid;

export type OnOrderStateChangeCallback = (err: Error | null, orderState?: OrderState) => void;
