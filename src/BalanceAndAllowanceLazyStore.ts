import { BigNumber } from 'bignumber.js';
import * as _ from 'lodash';

import { ERC20TokenContractWrapper } from './contract_wrappers/ERC20TokenContractWrapper';

/**
 * Store to keep track of token balances and collateral allowance
 *
 */
export class BalanceAndAllowanceLazyStore {
  // region Members
  // *****************************************************************
  // ****                     Members                             ****
  // *****************************************************************

  private _tokenWrapper: ERC20TokenContractWrapper;

  // keep track of balances of tokens
  private _balance: {
    [tokenAddress: string]: {
      [userAddress: string]: BigNumber;
    };
  };

  // keep track of allowances set
  private _allowance: {
    [tokenAddress: string]: {
      [userAddress: string]: BigNumber;
    };
  };

  // endregion // members
  // region Constructors
  // *****************************************************************
  // ****                     Constructors                        ****
  // *****************************************************************

  constructor(tokenWrapper: ERC20TokenContractWrapper) {
    this._tokenWrapper = tokenWrapper;
    this._balance = {};
    this._allowance = {};
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
   * Get balance of user for a token and caches it.
   * It balance is already cached, the cached value is returned.
   *
   * @param {string} tokenAddress Address of token to get balance
   * @param {string} userAddress Address of user
   */
  public async getBalanceAsync(tokenAddress: string, userAddress: string): Promise<BigNumber> {
    if (
      _.isUndefined(this._balance[tokenAddress]) ||
      _.isUndefined(this._balance[tokenAddress][userAddress])
    ) {
      const balance = await this._tokenWrapper.getBalanceAsync(tokenAddress, userAddress);
      this.setBalance(tokenAddress, userAddress, balance);
    }
    const cachedBalance = this._balance[tokenAddress][userAddress];
    return cachedBalance;
  }

  /**
   * Set the balance for the user in the store (cache locally).
   *
   * @param {string} tokenAddress
   * @param {string} userAddress
   * @param {BigNumber} balance
   */
  public setBalance(tokenAddress: string, userAddress: string, balance: BigNumber): void {
    if (_.isUndefined(this._balance[tokenAddress])) {
      this._balance[tokenAddress] = {};
    }
    this._balance[tokenAddress][userAddress] = balance;
  }

  /**
   * Delete the cached balance for this user
   *
   * @param {string} tokenAddress
   * @param {string} userAddress
   */
  public deleteBalance(tokenAddress: string, userAddress: string): void {
    if (!_.isUndefined(this._balance[tokenAddress])) {
      delete this._balance[tokenAddress][userAddress];
      if (_.isEmpty(this._balance[tokenAddress])) {
        delete this._balance[tokenAddress];
      }
    }
  }

  /**
   * Fetch users allowance for token and caches it.
   * If allowance is already cached. The cached value is returned.
   *
   * @param {string} tokenAddress
   * @param {string} userAddress
   */
  public async getAllowanceAsync(tokenAddress: string, userAddress: string): Promise<BigNumber> {
    if (
      _.isUndefined(this._allowance[tokenAddress]) ||
      _.isUndefined(this._allowance[tokenAddress][userAddress])
    ) {
      const collateralPoolAddress = '';
      const proxyAllowance = await this._tokenWrapper.getAllowanceAsync(
        tokenAddress,
        userAddress,
        collateralPoolAddress
      );
      this.setAllowance(tokenAddress, userAddress, proxyAllowance);
    }
    const cachedProxyAllowance = this._allowance[tokenAddress][userAddress];
    return cachedProxyAllowance;
  }

  /**
   * Store allowance in cache
   *
   * @param {string} tokenAddress
   * @param {string} userAddress
   * @param {string} allowance
   */
  public setAllowance(tokenAddress: string, userAddress: string, allowance: BigNumber): void {
    if (_.isUndefined(this._allowance[tokenAddress])) {
      this._allowance[tokenAddress] = {};
    }
    this._allowance[tokenAddress][userAddress] = allowance;
  }

  /**
   * Delete token allowance for user from cache
   *
   * @param {string} tokenAddress
   * @param {string} userAddress
   */
  public deleteAllowance(tokenAddress: string, userAddress: string): void {
    if (!_.isUndefined(this._allowance[tokenAddress])) {
      delete this._allowance[tokenAddress][userAddress];
      if (_.isEmpty(this._allowance[tokenAddress])) {
        delete this._allowance[tokenAddress];
      }
    }
  }

  /**
   * Deletes all stored balances and allowances
   *
   */
  public deleteAll(): void {
    this._balance = {};
    this._allowance = {};
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
