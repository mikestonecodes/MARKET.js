import { BigNumber } from 'bignumber.js';
import Web3 from 'web3';

// Types
import {
  ERC20,
  MarketCollateralPool,
  MarketContract,
  MARKETProtocolConfig,
  Order,
  SignedOrder
} from '@marketprotocol/types';

import { Market, Utils } from '../src';
import { MarketError, OrderStateWatcherConfig } from '../src/types';
import { constants } from '../src/constants';
import { createEVMSnapshot, getContractAddress, restoreEVMSnapshot } from './utils';

import {
  createOrderHashAsync,
  createSignedOrderAsync,
  isValidSignatureAsync,
  signOrderHashAsync
} from '../src/lib/Order';

interface CreateOrderParams {
  makerAddress?: string;
  takerAddress?: string;
  expirationTimeStamp?: number;
  fees?: number;
  feeRecipient?: string;
  orderQty?: number;
  price?: number;
}

/**
 * Helper class to perform repeating multi-step actions in tests.
 *
 */
export class Helper {
  public web3: Web3;
  public config: MARKETProtocolConfig = {
    networkId: constants.NETWORK_ID_TRUFFLE
  };
  public market: Market;
  public orderLibAddress: string;
  public contractAddress: string;

  private constructor() {
    this.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
    this.market = new Market(this.web3.currentProvider, this.config);
    this.orderLibAddress = getContractAddress('OrderLib', constants.NETWORK_ID_TRUFFLE);
  }

  static async init(): Promise<Helper> {
    const h = new Helper();

    const contractAddresses: string[] = await h.market.marketContractRegistry.getAddressWhiteList;
    h.contractAddress = contractAddresses[0];

    return h;
  }

  async createOrderAsync({
    makerAddress = this.web3.eth.accounts[1],
    takerAddress = constants.NULL_ADDRESS,
    fees = 0,
    feeRecipient = constants.NULL_ADDRESS,
    orderQty = 100,
    price = 100000,
    expirationTimeStamp = Math.floor(Date.now() / 1000) + 60 * 60
  }: CreateOrderParams = {}): Promise<SignedOrder> {
    const marketContractAddress = await this._getMarketContractAddressAsync();

    const feesBN: BigNumber = new BigNumber(fees);
    const orderQtyBN: BigNumber = new BigNumber(orderQty);
    const priceBN: BigNumber = new BigNumber(price);

    const signedOrder: SignedOrder = await createSignedOrderAsync(
      this.web3.currentProvider,
      this.orderLibAddress,
      marketContractAddress,
      new BigNumber(expirationTimeStamp),
      feeRecipient,
      makerAddress,
      feesBN,
      takerAddress,
      feesBN,
      orderQtyBN,
      priceBN,
      orderQtyBN,
      Utils.generatePseudoRandomSalt()
    );

    return signedOrder;
  }

  get ethAccounts(): string[] {
    return this.web3.eth.accounts;
  }

  private async _getMarketContractAddressAsync(): Promise<string> {
    const contractAddresses: string[] = await this.market.marketContractRegistry
      .getAddressWhiteList;
    return contractAddresses[0];
  }
}
