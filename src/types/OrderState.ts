import BigNumber from 'bignumber.js';

export interface OrderRelevantState {
  makerBalance: BigNumber;
  makerProxyAllowance: BigNumber;
  makerFeeBalance: BigNumber;
  makerFeeProxyAllowance: BigNumber;
  filledTakerTokenAmount: BigNumber;
  cancelledTakerTokenAmount: BigNumber;
  remainingFillableMakerTokenAmount: BigNumber;
  remainingFillableTakerTokenAmount: BigNumber;
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
