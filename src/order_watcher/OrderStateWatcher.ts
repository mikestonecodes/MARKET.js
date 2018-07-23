import BigNumber from 'bignumber.js';
import * as _ from 'lodash';

import { SignedOrder } from '@marketprotocol/types';

import { MarketError, OnOrderStateChangeCallback, OrderState } from '../types';

interface OrderStateByOrderHash {
  [orderHash: string]: OrderState;
}

/**
 * Watcher for a set of Transaction Orders
 *
 */
export default class OrderStateWatcher {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************

  private _orderStateByOrderHashCache: OrderStateByOrderHash = {};

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor() {
    _.noop;
  }

  // endregion//Constructors
  // region Properties
  // *****************************************************************
  // ****                     Properties                          ****
  // *****************************************************************
  // endregion //Properties
  // region Public Methods
  // *****************************************************************
  // ****                     Public Methods                      ****
  // *****************************************************************

  /**
   * subscribes callback to receive updates in regards to the state of an order
   *
   * @param {OnOrderStateChangeCallback} callback  callback function
   */
  public subscribe(callback: OnOrderStateChangeCallback): void {
    _.noop;
  }

  /**
   * Allows caller to stop receiving callbacks.
   *
   */
  public unsubscribe(): void {
    _.noop;
  }

  /**
   * Adds an order to the order state watcher.  Before the order is added, it's
   * signature is verified.
   *
   * @param {SignedOrder} order
   */
  public addOrder(orderHash: SignedOrder): void {
    _.noop;
  }

  /**
   * Removes an order from the order state watcher
   *
   * @param {string} orderHash The hash of order you wish to stop
   */
  public removeOrder(orderHash: string): void {
    _.noop;
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
