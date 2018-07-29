import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import * as _ from 'lodash';

import { DecodedLogEntry, SignedOrder } from '@marketprotocol/types';

import {
  BlockParamLiteral,
  LogEntryEvent,
  MarketError,
  OnOrderStateChangeCallback,
  OrderState,
  OrderStateWatcherConfig
} from '../types';
import { assert } from '../assert';
import { ExpirationWatcher } from './ExpirationWatcher';
import EventWatcher from './EventWatcher';
import { Utils } from '..';
import { OrderFilledCancelledLazyStore } from '../OrderFilledCancelledLazyStore';
import { BalanceAndAllowanceLazyStore } from '../BalanceAndAllowanceLazyStore';
import { MarketContractWrapper } from '../contract_wrappers/MarketContractWrapper';
import { IntervalUtils } from '../lib/Utils';
import { AbiDecoder } from '../lib/AbiDecoder';
import {
  ApprovalContractEventArgs,
  ContractEventArgs,
  MarketContractEvents,
  MarketTokenEvents,
  OrderCancelledEventArgs,
  OrderFilledEventArgs,
  TokenEvents,
  TransferContractEventArgs,
  UserUpdatedLockedBalanceEventArgs
} from '../types/ContractEvents';
import { ERC20TokenContractWrapper } from '../contract_wrappers/ERC20TokenContractWrapper';
import OrderStateUtils from '../utilities/OrderStateUtils';

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

const DEFAULT_CLEANUP_JOB_INTERVAL_MS = 1000 * 60 * 60; // 1h

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
  private _eventWatcher: EventWatcher;
  private _orderFilledCancelledStore: OrderFilledCancelledLazyStore;
  private _collateralBalanceAndAllowanceStore: BalanceAndAllowanceLazyStore;
  private _web3: Web3;
  private _abiDecoder: AbiDecoder;
  private _marketContractWrapper: MarketContractWrapper;
  private _orderStateUtils: OrderStateUtils;
  private _cleanupJobInterval: number;
  private _cleanupJobIntervalIdIfExists?: NodeJS.Timer;

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(
    web3: Web3,
    abiDecoder: AbiDecoder,
    tokenWrapper: ERC20TokenContractWrapper,
    marketContractWrapper: MarketContractWrapper,
    config?: OrderStateWatcherConfig
  ) {
    this._web3 = web3;
    this._abiDecoder = abiDecoder;
    this._marketContractWrapper = marketContractWrapper;
    this._orderFilledCancelledStore = new OrderFilledCancelledLazyStore(marketContractWrapper);
    this._collateralBalanceAndAllowanceStore = new BalanceAndAllowanceLazyStore(tokenWrapper);
    this._orderStateUtils = new OrderStateUtils(
      this._marketContractWrapper,
      this._collateralBalanceAndAllowanceStore,
      this._orderFilledCancelledStore
    );
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

    const pollingIntervalIfExistsMs = _.isUndefined(config)
      ? undefined
      : config.eventPollingIntervalMs;
    const stateLayer =
      _.isUndefined(config) || _.isUndefined(config.stateLayer)
        ? BlockParamLiteral.Latest
        : config.stateLayer;
    this._eventWatcher = new EventWatcher(this._web3, pollingIntervalIfExistsMs, stateLayer);

    this._cleanupJobInterval =
      _.isUndefined(config) || _.isUndefined(config.cleanupJobIntervalMs)
        ? DEFAULT_CLEANUP_JOB_INTERVAL_MS
        : config.cleanupJobIntervalMs;
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
    this._eventWatcher.subscribe(this._onEventWatcherCallbackAsync.bind(this));
    this._cleanupJobIntervalIdIfExists = IntervalUtils.setAsyncExcludingInterval(
      this._cleanupAsync.bind(this),
      this._cleanupJobInterval,
      (err: Error) => {
        this.unsubscribe();
        callback(err);
      }
    );
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
   * Add to dependent order hashes to keep track of
   * makers orders relating to a Market Contract and Collateral token
   *
   * @param {string} orderHash
   * @param {string} signedOrder
   */
  private _addToDependentOrderHashes(orderHash: string, signedOrder: SignedOrder) {
    if (_.isUndefined(this._dependentOrderHashes[signedOrder.maker])) {
      this._dependentOrderHashes[signedOrder.maker] = {};
    }

    const collateralTokenAddress = '';
    if (_.isUndefined(this._dependentOrderHashes[signedOrder.maker][collateralTokenAddress])) {
      this._dependentOrderHashes[signedOrder.maker][collateralTokenAddress] = new Set();
    }
    this._dependentOrderHashes[signedOrder.maker][collateralTokenAddress].add(orderHash);

    const mktContractAddress = '';
    if (_.isUndefined(this._dependentOrderHashes[signedOrder.maker][mktContractAddress])) {
      this._dependentOrderHashes[signedOrder.maker][mktContractAddress] = new Set();
    }
    this._dependentOrderHashes[signedOrder.maker][mktContractAddress].add(orderHash);
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

  private async _cleanupAsync(): Promise<void> {
    for (const orderHash of _.keys(this._orderByOrderHash)) {
      this._cleanupOrderRelatedState(orderHash);
      await this._emitRevalidateOrdersAsync([orderHash]);
    }
  }

  private _cleanupOrderRelatedState(orderHash: string): void {
    const signedOrder = this._orderByOrderHash[orderHash];
    const marketContractAddress = '';
    this._orderFilledCancelledStore.deleteQtyFilledOrCancelled(marketContractAddress, orderHash);

    const collateralTokenAddress = '';
    const collateralPoolAddress = '';
    this._collateralBalanceAndAllowanceStore.deleteBalance(signedOrder.maker, signedOrder.maker);
    this._collateralBalanceAndAllowanceStore.deleteAllowance(
      collateralTokenAddress,
      signedOrder.maker
    );
    this._collateralBalanceAndAllowanceStore.deleteBalance(
      collateralTokenAddress,
      signedOrder.taker
    );
    this._collateralBalanceAndAllowanceStore.deleteAllowance(
      collateralTokenAddress,
      signedOrder.taker
    );

    const mktTokenAddress = this._getMKTTokenAddress();
    if (!signedOrder.makerFee.isZero()) {
      this._collateralBalanceAndAllowanceStore.deleteBalance(mktTokenAddress, signedOrder.maker);
      this._collateralBalanceAndAllowanceStore.deleteAllowance(mktTokenAddress, signedOrder.maker);
    }
    if (!signedOrder.takerFee.isZero()) {
      this._collateralBalanceAndAllowanceStore.deleteBalance(mktTokenAddress, signedOrder.taker);
      this._collateralBalanceAndAllowanceStore.deleteAllowance(mktTokenAddress, signedOrder.taker);
    }
  }

  private async _onEventWatcherCallbackAsync(
    err: Error | null,
    logIfExists?: LogEntryEvent
  ): Promise<void> {
    if (!_.isNull(err)) {
      if (!_.isUndefined(this._callbackIfExists)) {
        this._callbackIfExists(err);
        this.unsubscribe();
      }
      return;
    }

    const log = logIfExists as LogEntryEvent;
    const maybeDecodedLog = this._abiDecoder.decodeLogEntryEvent<ContractEventArgs>(log);
    const isLogDecoded = !_.isUndefined(
      (maybeDecodedLog as DecodedLogEntry<ContractEventArgs>).event
    );
    if (!isLogDecoded) {
      return;
    }

    const decodedLog = maybeDecodedLog as DecodedLogEntry<ContractEventArgs>;
    let makerToken: string;
    let makerAddress: string;
    switch (decodedLog.event) {
      case TokenEvents.Approval:
        // Invalidate cache
        const approvalArgs = decodedLog.args as ApprovalContractEventArgs;
        this._collateralBalanceAndAllowanceStore.deleteAllowance(
          decodedLog.address,
          approvalArgs.owner
        );
        // Revalidate orders
        makerToken = decodedLog.address;
        makerAddress = approvalArgs.owner;
        if (
          !_.isUndefined(this._dependentOrderHashes[makerAddress]) &&
          !_.isUndefined(this._dependentOrderHashes[makerAddress][makerToken])
        ) {
          const orderHashes = Array.from(this._dependentOrderHashes[makerAddress][makerToken]);
          await this._emitRevalidateOrdersAsync(orderHashes);
        }
        break;
      case TokenEvents.Transfer:
        // Invalidate cache
        const transferArgs = decodedLog.args as TransferContractEventArgs;
        this._collateralBalanceAndAllowanceStore.deleteBalance(
          decodedLog.address,
          transferArgs.from
        );
        this._collateralBalanceAndAllowanceStore.deleteBalance(decodedLog.address, transferArgs.to);
        // Revalidate orders
        makerToken = decodedLog.address;
        makerAddress = transferArgs.from;
        if (
          !_.isUndefined(this._dependentOrderHashes[makerAddress]) &&
          !_.isUndefined(this._dependentOrderHashes[makerAddress][makerToken])
        ) {
          const orderHashes = Array.from(this._dependentOrderHashes[makerAddress][makerToken]);
          await this._emitRevalidateOrdersAsync(orderHashes);
        }
        break;
      case MarketTokenEvents.UserUpdatedLockedBalance:
        const updatedArgs = decodedLog.args as UserUpdatedLockedBalanceEventArgs;
        const mktContractAddress = updatedArgs.contractAddress;
        const mktUserAddress = updatedArgs.userAddress; // ideally should be maker address

        if (
          !_.isUndefined(this._dependentOrderHashes[mktUserAddress]) &&
          !_.isUndefined(this._dependentOrderHashes[mktUserAddress][mktContractAddress])
        ) {
          const orderHashes = Array.from(
            this._dependentOrderHashes[mktUserAddress][mktContractAddress]
          );
          await this._emitRevalidateOrdersAsync(orderHashes);
        }
        break;
      case MarketContractEvents.OrderFilled:
        const filledOrderArgs = decodedLog.args as OrderFilledEventArgs;
        makerAddress = filledOrderArgs.maker;
        break;
      case MarketContractEvents.OrderCancelled:
        const OrderCancelledArgs = decodedLog.args as OrderCancelledEventArgs;
        break;
      default:
        _.noop(); // throw utils.spawnSwitchErr('decodedLog.event', decodedLog.event);
    }
  }

  private async _emitRevalidateOrdersAsync(orderHashes: string[]): Promise<void> {
    for (const orderHash of orderHashes) {
      const signedOrder = this._orderByOrderHash[orderHash];
      const orderState = await this._orderStateUtils.getOrderStateAsync(signedOrder);
      if (_.isUndefined(this._callbackIfExists)) {
        break; // callback doesn't exist
      }

      if (!_.isEqual(orderState, this._orderStateByOrderHashCache[orderHash])) {
        // state has changes
        this._orderStateByOrderHashCache[orderHash] = orderState;
        this._callbackIfExists(null, orderState);
      }
    }
  }

  private _getMKTTokenAddress(): string {
    return '';
  }

  // endregion //Private Methods
  // region Event Handlers
  // *****************************************************************
  // ****                     Event Handlers                     ****
  // *****************************************************************
  // endregion //Event Handlers
}
