import * as _ from 'lodash';

import { ContractWrapper } from './contract_wrappers/ContractWrapper';
import { SignedOrder } from '@marketprotocol/types';
import { Utils } from '.';

/**
 * Cache to make fetching collateral pool and collateral token addresses
 * for orders easy.
 *
 */
export class OrderCollateralPoolAndTokenLazyStore {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************
  private _poolAddresses: {
    [orderHash: string]: string;
  };

  private _tokenAddreses: {
    [orderHash: string]: string;
  };

  private _contractWrapper: ContractWrapper;
  // endregion // members

  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************
  constructor(marketContractWrapper: ContractWrapper) {
    this._contractWrapper = marketContractWrapper;
    this._poolAddresses = {};
    this._tokenAddreses = {};
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
   * Get collateral pool address for an order and caches it.
   * If address is already cached, the cached value is returned.
   *
   * @param {SignedOrder} orderHash order to track
   */
  public async getCollateralPoolAddressAsync(signedOrder: SignedOrder): Promise<string> {
    const orderHash = this._getHash(signedOrder);
    if (_.isUndefined(this._poolAddresses[orderHash])) {
      const poolAddress = await this._contractWrapper.getCollateralPoolContractAddressAsync(
        signedOrder.contractAddress
      );
      this.setCollateralPoolAddress(signedOrder, poolAddress);
    }
    const cachedAddress = this._poolAddresses[orderHash];
    return cachedAddress;
  }

  /**
   * Set the collateral pool address for the order in the store (cache locally).
   *
   * @param {SignedOrder} signedOrder
   * @param {string} address
   */
  public setCollateralPoolAddress(signedOrder: SignedOrder, address: string): void {
    const orderHash = this._getHash(signedOrder);
    this._poolAddresses[orderHash] = address;
  }

  /**
   * Delete the cached collateral pool address for this order
   *
   * @param {SignedOrder} signedOrder
   */
  public deleteCollateralPoolAddress(signedOrder: SignedOrder): void {
    const orderHash = this._getHash(signedOrder);
    delete this._poolAddresses[orderHash];
  }

  /**
   * Get collateral token address for an order and caches it.
   * If address is already cached, the cached value is returned.
   *
   * @param {SignedOrder} orderHash order to track
   */
  public async getCollateralTokenAddressAsync(signedOrder: SignedOrder): Promise<string> {
    const orderHash = this._getHash(signedOrder);
    if (_.isUndefined(this._tokenAddreses[orderHash])) {
      const tokenAddress = await this._contractWrapper.getCollateralTokenAddressAsync(
        signedOrder.contractAddress
      );
      this.setCollateralTokenAddress(signedOrder, tokenAddress);
    }
    const cachedAddress = this._tokenAddreses[orderHash];
    return cachedAddress;
  }

  /**
   * Set the collateral token address for the order in the store (cache locally).
   *
   * @param {SignedOrder} signedOrder
   * @param {string} address
   */
  public setCollateralTokenAddress(signedOrder: SignedOrder, address: string): void {
    const orderHash = this._getHash(signedOrder);
    this._tokenAddreses[orderHash] = address;
  }

  /**
   * Delete the cached collateral token address for this order
   *
   * @param {SignedOrder} signedOrder
   */
  public deleteCollateralTokenAddress(signedOrder: SignedOrder): void {
    const orderHash = this._getHash(signedOrder);
    delete this._tokenAddreses[orderHash];
  }

  /**
   * Deletes all stored balances and allowances
   *
   */
  public deleteAll(): void {
    this._poolAddresses = {};
    this._tokenAddreses = {};
  }

  // endregion //Public Methods
  // region Private Methods
  // *****************************************************************
  // ****                     Private Methods                     ****
  // *****************************************************************
  private _getHash(signedOrder: SignedOrder): string {
    return Utils.getOrderHash(signedOrder);
  }
  // endregion //Private Methods
  // region Event Handlers
  // *****************************************************************
  // ****                     Event Handlers                     ****
  // *****************************************************************
  // endregion //Event Handlers
}
