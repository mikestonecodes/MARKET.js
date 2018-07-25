import { MarketError, OrderStateWatcherConfig } from '../src/types';
import { createEVMSnapshot, restoreEVMSnapshot } from './utils';

import OrderStateWatcher from '../src/order_watcher/OrderStateWatcher';
import { Helper } from './helper';
import { Utils } from '../src';

describe('OrderStateWatcher', () => {
  let helper: Helper;
  let orderStateWatcher: OrderStateWatcher;
  let watcherConfig: OrderStateWatcherConfig;
  let snapshotId: string;

  beforeAll(async () => {
    helper = await Helper.init();
    jest.setTimeout(30000);
  });

  beforeEach(async () => {
    snapshotId = await createEVMSnapshot(helper.web3);
    orderStateWatcher = new OrderStateWatcher(helper.web3, watcherConfig);
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

  describe('addOrder', () => {
    it('should throw if order is not signed by maker', async () => {
      const signedOrder = await helper.createOrderAsync();
      signedOrder.maker = helper.ethAccounts[4]; // change maker
      expect(() => orderStateWatcher.addOrder(signedOrder)).toThrow();
    });
  });

  describe('removeOrder', () => {
    it('should remove existing order without throwing error', async () => {
      const signedOrder = await helper.createOrderAsync();
      const orderHash = Utils.getOrderHash(signedOrder);

      orderStateWatcher.addOrder(signedOrder);

      expect(() => orderStateWatcher.removeOrder(orderHash)).not.toThrow();
    });

    it('should remove non-existing order without throwing error', async () => {
      expect(() => orderStateWatcher.removeOrder('0x000')).not.toThrow();
    });
  });
});
