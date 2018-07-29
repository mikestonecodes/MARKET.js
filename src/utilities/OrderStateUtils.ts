import BigNumber from 'bignumber.js';

import { OrderFilledCancelledLazyStore } from '../OrderFilledCancelledLazyStore';
import { BalanceAndAllowanceLazyStore } from '../BalanceAndAllowanceLazyStore';
import { SignedOrder } from '@marketprotocol/types';
import {
  MarketError,
  OrderRelevantState,
  OrderState,
  OrderStateInvalid,
  OrderStateValid
} from '../types';
import { Utils } from '../lib/Utils';
import { RemainingFillableCalculator } from '../order_watcher/RemainingFillableCalc';
import { MarketContractWrapper } from '../contract_wrappers/MarketContractWrapper';

/**
 * Utility for computing and returning the state of an order.
 */
export default class OrderStateUtils {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  private _marketWrapper: MarketContractWrapper;
  private _orderFilledCancelledLazyStore: OrderFilledCancelledLazyStore;
  private _balanceAndAllowanceLazyStore: BalanceAndAllowanceLazyStore;

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(
    marketWrapper: MarketContractWrapper,
    balanceAndProxyAllowanceLazyStore: BalanceAndAllowanceLazyStore,
    orderFilledCancelledLazyStore: OrderFilledCancelledLazyStore
  ) {
    this._marketWrapper = marketWrapper;
    this._balanceAndAllowanceLazyStore = balanceAndProxyAllowanceLazyStore;
    this._orderFilledCancelledLazyStore = orderFilledCancelledLazyStore;
  }

  // endregion//Constructors
  // region Properties
  // *****************************************************************
  // ****                     Properties                          ****
  // *****************************************************************

  private static _validateIfOrderIsValid(
    signedOrder: SignedOrder,
    orderRelevantState: OrderRelevantState
  ): void {
    if (orderRelevantState.remainingMakerFillableQty.eq(0)) {
      throw new Error(MarketError.OrderDead);
    }

    if (orderRelevantState.makerCollateralBalance.eq(0)) {
      throw new Error(MarketError.InsufficientCollateralBalance);
    }
    if (orderRelevantState.makerCollateralAllowance.eq(0)) {
      throw new Error(MarketError.InsufficientAllowanceForTransfer);
    }
    if (!signedOrder.makerFee.eq(0)) {
      if (orderRelevantState.makerFeeBalance.eq(0)) {
        throw new Error(MarketError.InsufficientBalanceForTransfer);
      }
      if (orderRelevantState.makerFeeAllowance.eq(0)) {
        throw new Error(MarketError.InsufficientAllowanceForTransfer);
      }
    }
  }

  // endregion //Properties
  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************
  public async getOrderStateAsync(signedOrder: SignedOrder): Promise<OrderState> {
    const orderRelevantState = await this.getOrderRelevantStateAsync(signedOrder);
    const orderHash = Utils.getOrderHash(signedOrder);
    try {
      OrderStateUtils._validateIfOrderIsValid(signedOrder, orderRelevantState);
      const orderState: OrderStateValid = {
        isValid: true,
        orderHash,
        orderRelevantState
      };
      return orderState;
    } catch (err) {
      const orderState: OrderStateInvalid = {
        isValid: false,
        orderHash,
        error: err.message
      };
      return orderState;
    }
  }

  public async getOrderRelevantStateAsync(signedOrder: SignedOrder): Promise<OrderRelevantState> {
    const mktTokenAddress = '';
    const mtkContractAddress = signedOrder.contractAddress;
    const marketCollateralPoolAddress = await this._marketWrapper.getCollateralPoolContractAddressAsync(
      mtkContractAddress
    );

    const orderHash = Utils.getOrderHash(signedOrder);
    const makerCollateralBalance = await this._balanceAndAllowanceLazyStore.getBalanceAsync(
      marketCollateralPoolAddress,
      signedOrder.maker
    );
    const makerCollateralAllowance = await this._balanceAndAllowanceLazyStore.getAllowanceAsync(
      marketCollateralPoolAddress,
      signedOrder.maker
    );
    const makerFeeBalance = await this._balanceAndAllowanceLazyStore.getBalanceAsync(
      mktTokenAddress,
      signedOrder.maker
    );
    const makerFeeAllowance = await this._balanceAndAllowanceLazyStore.getAllowanceAsync(
      mktTokenAddress,
      signedOrder.maker
    );
    const qtyFilledOrCancelled = await this._orderFilledCancelledLazyStore.getQtyFilledOrCancelledAsync(
      mtkContractAddress,
      orderHash
    );
    const remainingFillableQty = signedOrder.orderQty.minus(qtyFilledOrCancelled);

    // const remainingFillableCalculator = new RemainingFillableCalculator(
    //   '',
    //   '',
    //   '',
    //   signedOrder,
    //   orderHash
    // );
    // const remainingMakerFillableQty = remainingFillableCalculator.computeRemainingMakerFillable();
    // const remainingTakerFillableQty = remainingFillableCalculator.computeRemainingTakerFillable();
    const orderRelevantState = {
      makerCollateralBalance,
      makerCollateralAllowance,
      makerFeeBalance,
      makerFeeAllowance,
      remainingMakerFillableQty: remainingFillableQty,
      remainingTakerFillableQty: remainingFillableQty
    };
    return orderRelevantState;
  }

  // endregion //Public Methods
  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  // endregion //Private Methods
  // region Event Handlers
  // *****************************************************************
  // ****                     Event Handlers                     ****
  // *****************************************************************
  // endregion //Event Handlers
}
