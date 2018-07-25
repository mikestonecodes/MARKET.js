import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import * as _ from 'lodash';

import { SignedOrder } from '@marketprotocol/types';

import {
  MarketError,
  OnOrderStateChangeCallback,
  OrderState,
  OrderStateWatcherConfig
} from '../types';
import { assert } from '../assert';
import { ExpirationWatcher } from './ExpirationWatcher';
import { Utils } from '..';

interface DependentOrderHashes {
  [makerAddress: string]: {
    [makerToken: string]: Set<string>;
  };
}

interface OrderStateByOrderHash {
  [orderHash: string]: OrderState;
}

interface OrderByOrderHash {
  [orderHash: string]: SignedOrder;
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
  private _dependentOrderHashes: DependentOrderHashes = {};
  private _orderByOrderHash: OrderByOrderHash = {};
  private _callbackIfExists?: OnOrderStateChangeCallback;
  private _expirationWatcher: ExpirationWatcher;
  private _web3: Web3;

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(web3: Web3, config?: OrderStateWatcherConfig) {
    this._web3 = web3;
    const orderExpirationCheckingIntervalMsIfExists = _.isUndefined(config)
      ? undefined
      : config.orderExpirationCheckingIntervalMs;
    const expirationMarginIfExistsMs = _.isUndefined(config)
      ? undefined
      : config.expirationMarginMs;
    this._expirationWatcher = new ExpirationWatcher(
      expirationMarginIfExistsMs,
      orderExpirationCheckingIntervalMsIfExists
    );
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
    assert.isFunction('callback', callback);
    if (!_.isUndefined(this._callbackIfExists)) {
      throw new Error(MarketError.SubscriptionAlreadyPresent);
    }
    this._callbackIfExists = callback;
    this._expirationWatcher.subscribe(this._onOrderExpired.bind(this));
  }

  /**
   * Allows caller to stop receiving callbacks.
   *
   */
  public unsubscribe(): void {
    if (
      _.isUndefined(this._callbackIfExists) ||
      _.isUndefined(this._cleanupJobIntervalIdIfExists)
    ) {
      throw new Error(MarketError.SubscriptionNotFound);
    }

    delete this._callbackIfExists;
    this._expirationWatcher.unsubscribe();
  }

  /**
   * Adds an order to the order state watcher.
   * Before the order is added, it's signature is verified.
   *
   * @param {SignedOrder} signedOrder
   */
  public addOrder(signedOrder: SignedOrder): void {
    const orderHash = Utils.getOrderHash(signedOrder);
    assert.isValidSignature(orderHash, signedOrder.ecSignature, signedOrder.maker);

    this._orderByOrderHash[orderHash] = signedOrder;
    this._addToDependentOrderHashes(orderHash, signedOrder);
    const expirationUnixTimestampMs = signedOrder.expirationTimestamp.times(1000);
    this._expirationWatcher.addOrder(orderHash, expirationUnixTimestampMs);
  }

  /**
   * Removes an order from the order state watcher
   *
   * @param {string} orderHash The hash of order you wish to stop
   */
  public removeOrder(orderHash: string): void {
    const signedOrder = this._orderByOrderHash[orderHash];
    if (_.isUndefined(signedOrder)) {
      return;
    }
    delete this._orderByOrderHash[orderHash];
    delete this._orderStateByOrderHashCache[orderHash];

    this._expirationWatcher.removeOrder(orderHash);
  }

  // endregion //Public Methods
  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************

  private _onOrderExpired(orderHash: string): void {
    const orderState: OrderState = {
      isValid: false,
      orderHash,
      error: [MarketError.OrderExpired]
    };

    if (!_.isUndefined(this._orderByOrderHash[orderHash])) {
      this.removeOrder(orderHash);
      if (!_.isUndefined(this._callbackIfExists)) {
        this._callbackIfExists(null, orderState);
      }
    }
  }

  /**
   *
   *
   * @param {string} orderHash
   * @param {string} signedOrder
   */
  private _addToDependentOrderHashes(orderHash: string, signedOrder: SignedOrder) {
    if (_.isUndefined(this._dependentOrderHashes[signedOrder.maker])) {
      this._dependentOrderHashes[signedOrder.maker] = {};
    }
    const tokenAddress = '';
    if (_.isUndefined(this._dependentOrderHashes[signedOrder.maker][signedOrder.maker])) {
      this._dependentOrderHashes[signedOrder.maker][tokenAddress] = new Set();
    }
    this._dependentOrderHashes[signedOrder.maker][tokenAddress].add(orderHash);
  }

  /**
   *
   * @param {string} makerAddress
   * @param {string} tokenAddress
   * @param {string} orderHash
   */
  private _removeFromDependentOrderHashes(
    makerAddress: string,
    tokenAddress: string,
    orderHash: string
  ) {
    this._dependentOrderHashes[makerAddress][tokenAddress].delete(orderHash);
    if (this._dependentOrderHashes[makerAddress][tokenAddress].size === 0) {
      delete this._dependentOrderHashes[makerAddress][tokenAddress];
    }
    if (_.isEmpty(this._dependentOrderHashes[makerAddress])) {
      delete this._dependentOrderHashes[makerAddress];
    }
  }

  // endregion //Private Methods
  // region Event Handlers
  // *****************************************************************
  // ****                     Event Handlers                     ****
  // *****************************************************************
  // endregion //Event Handlers
}
