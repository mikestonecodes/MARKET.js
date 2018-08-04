import BigNumber from 'bignumber.js';
import { join } from 'path';
import DoneCallback = jest.DoneCallback;

import {
  MarketError,
  OrderState,
  OrderStateInvalid,
  OrderStateValid,
  OrderStateWatcherConfig
} from '../src/types';
import { createEVMSnapshot, reportNodeCallbackErrors, restoreEVMSnapshot } from './utils';

import OrderStateWatcher from '../src/order_watcher/OrderStateWatcher';
import { Helper } from './helper';
import { Utils } from '../src';
import { AbiDecoder } from '../src/lib/AbiDecoder';
import { Artifact } from '@marketprotocol/types';

describe('OrderStateWatcher', () => {
  let helper: Helper;
  let orderStateWatcher: OrderStateWatcher;
  let abiDecoder: AbiDecoder;
  let watcherConfig: OrderStateWatcherConfig;
  let snapshotId: string;
  let MarketContractArtifact: Artifact;
  let MarketTokenArtifact: Artifact;

  beforeAll(async () => {
    helper = await Helper.init();
    const contractPath = './build/contracts/';
    MarketContractArtifact = Utils.loadArtifact(join(contractPath, 'MarketContractOraclize.json'));
    MarketTokenArtifact = Utils.loadArtifact(join(contractPath, 'MarketToken.json'));

    // jest.setTimeout(30000);
  });

  beforeEach(async () => {
    snapshotId = await createEVMSnapshot(helper.web3);
    abiDecoder = new AbiDecoder([MarketContractArtifact, MarketTokenArtifact]);
    orderStateWatcher = new OrderStateWatcher(
      helper.web3,
      abiDecoder,
      helper.market,
      watcherConfig
    );
  });

  afterEach(async () => {
    await restoreEVMSnapshot(helper.web3, snapshotId);
  });

  describe('subscribe', () => {
    it('should not throw if callback is a function', () => {
      expect(() => {
        orderStateWatcher.subscribe(() => ({}));
      }).not.toThrow();
    });

    it('should throw error if callback is null', () => {
      expect(() => {
        orderStateWatcher.subscribe(null);
      }).toThrow();
    });

    it('should throw error if callback is already set', () => {
      orderStateWatcher.subscribe(() => ({}));

      expect(() => {
        orderStateWatcher.subscribe(() => ({}));
      }).toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should throw error if callback is not set', () => {
      expect(() => orderStateWatcher.unsubscribe()).toThrow();
    });
  });

  describe('addOrder', () => {
    it('should throw if order is not signed by maker', async () => {
      const signedOrder = await helper.createOrderAsync();
      signedOrder.maker = helper.ethAccounts[4]; // change maker
      await expect(orderStateWatcher.addOrder(signedOrder)).rejects.toThrow();
    });
  });

  describe('removeOrder', () => {
    it('should remove existing order without throwing error', async () => {
      const signedOrder = await helper.createOrderAsync();
      const orderHash = Utils.getOrderHash(signedOrder);

      await orderStateWatcher.addOrder(signedOrder);

      await expect(orderStateWatcher.removeOrder(orderHash)).resolves;
    });

    it('should remove non-existing order without throwing error', async () => {
      await expect(orderStateWatcher.removeOrder('0x000')).resolves;
    });
  });

  it('should emit OrderStateInvalid when maker has insufficient collateral', (done: DoneCallback) => {
    (async () => {
      await helper.fundCollateral({ address: helper.maker, deposit: true });

      const signedOrder = await helper.createOrderAsync();
      await orderStateWatcher.addOrder(signedOrder);
      const callback = reportNodeCallbackErrors(done)((orderState: OrderState) => {
        expect(orderState.isValid).toEqual(false);

        const invalidOrderState = orderState as OrderStateInvalid;
        expect(invalidOrderState.error).toEqual(MarketError.InsufficientCollateralBalance);
      });
      orderStateWatcher.subscribe(callback);

      // withdraw collateral
      const initialBalance = await helper.market.getUserAccountBalanceAsync(
        signedOrder.contractAddress,
        signedOrder.maker
      );
      await helper.market.withdrawCollateralAsync(signedOrder.contractAddress, initialBalance, {
        from: helper.maker
      });
    })().catch(done);
  });

  it('should emit OrderStateInvalid when order is fully filled', (done: DoneCallback) => {
    (async () => {
      await helper.fundCollateral({ address: helper.maker, deposit: true });
      await helper.fundCollateral({ address: helper.taker, deposit: true });

      const orderQty = 5;
      const signedOrder = await helper.createOrderAsync({ orderQty });
      await orderStateWatcher.addOrder(signedOrder);
      const callback = reportNodeCallbackErrors(done)((orderState: OrderState) => {
        expect(orderState.isValid).toEqual(false);

        const invalidOrderState = orderState as OrderStateInvalid;
        expect(invalidOrderState.error).toEqual(MarketError.OrderDead);
      });
      orderStateWatcher.subscribe(callback);

      // trade full quantity
      const fillableQty = new BigNumber(orderQty);
      await helper.market.tradeOrderAsync(signedOrder, fillableQty, {
        from: helper.taker,
        gas: 400000
      });

      // mo
    })().catch(done);
  });

  it('should emit OrderStateValid when order is partially filled', (done: DoneCallback) => {
    (async () => {
      await helper.fundCollateral({ address: helper.maker, deposit: true });
      await helper.fundCollateral({ address: helper.taker, deposit: true });

      const orderQty = 10;
      const fillQty = 2;
      const signedOrder = await helper.createOrderAsync();
      const orderHash = Utils.getOrderHash(signedOrder);
      await orderStateWatcher.addOrder(signedOrder);
      const callback = reportNodeCallbackErrors(done)((orderState: OrderState) => {
        expect(orderState.isValid).toEqual(true);
        const validOrderState = orderState as OrderStateValid;
        expect(validOrderState.orderHash).toEqual(orderHash);
        expect(validOrderState.orderRelevantState.remainingFillableQty).toEqual(
          new BigNumber(orderQty - fillQty)
        );
      });
      orderStateWatcher.subscribe(callback);

      // partially fill order
      await helper.market.tradeOrderAsync(signedOrder, new BigNumber(fillQty), {
        from: helper.taker,
        gas: 400000
      });
    })().catch(done);
  });
});
