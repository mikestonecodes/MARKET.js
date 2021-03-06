<img src="https://github.com/MARKETProtocol/dApp/blob/master/src/img/MARKETProtocol-Light.png?raw=true" align="middle">

[![Build Status](https://travis-ci.org/MARKETProtocol/MARKET.js.svg?branch=develop)](https://travis-ci.org/MARKETProtocol/MARKET.js) [![Coverage Status](https://coveralls.io/repos/github/MARKETProtocol/MARKET.js/badge.svg?branch=master)](https://coveralls.io/github/MARKETProtocol/MARKET.js?branch=master)

MARKET Protocol has been created to provide a secure, flexible, open source foundation for decentralized trading on the Ethereum blockchain. We provide the pieces necessary to create a decentralized exchange, including the requisite clearing and collateral pool infrastructure, enabling third parties to build applications for trading.

# MARKET.js

Take a look at our [docs](https://docs.marketprotocol.io) for a little more explanation.

Join our [Discord Community](https://marketprotocol.io/discord) to interact with members of our dev staff and other contributors.

MARKET.js is a library for interacting with MARKET Protocol Smart Contracts. 

## Functionality

- Orders 
  - generating and signing
  - filling and cancelling
  - verifying signature
  - calculating remaining Qtys
  - watching for events affecting validity.
- Collateral
  - checking a users unallocated collateral balances
  - checking a users allocated collateral
  - calculation of needed collateral
  - wrapper for ERC20 token functionality.
- Positions
  - querying users open positions (qty and price)
- Events
  - Fills
  - Collateral Deposit / Withdraw
  - Contract Settlement
  - Cancelled / Expired orders
- Contract Registry
- MKT Token Access to contracts


## Contributing

Want to hack on MARKET Protocol? Awesome!

MARKET Protocol is an Open Source project and we welcome contributions of all sorts. There are many ways to help, from reporting issues, contributing code, and helping us improve our community.

Ready to jump in? Check [docs.marketprotocol.io/#contributing](https://docs.marketprotocol.io/#contributing). 

## Questions?

Join our [Discord Community](https://marketprotocol.io/discord) to get in touch with our dev staff and other contributors.

## Usage

A Makefile is provided for easy setup of the local development environment.

Some pre-requisites are required in order to utilize the Makefile.

NodeJS 8.11.2 LTS is recommended for compatibility.

```
$ git clone https://github.com/MARKETProtocol/MARKET.js  # clone this repository
$ git clone https://github.com/MARKETProtocol/ethereum-bridge.git # and the needed oraclize.it bridge (for local test rpc)
```

From here you will be able to use make commands assuming npm is already installed.

Assuming you have npm already, Install truffle
```
$ make install_truffle # may require sudo
```

Install needed dependencies.  If this fails on your ubuntu install it may require you to run `sudo apt-get install build-essential -y` prior to installing.
```
$ make install_deps
```
If you get an error on the `node-gyp rebuild` line during `make install_deps`, `node-gyp` doesn't support Python v3.x.x; v2.7 is recommended. There are several solutions based upon your platform.

The easiest solution?
```
make install_deps_python2.7
```
to use Python 2.7. See [stack overflow](https://stackoverflow.com/questions/20454199/how-to-use-a-different-version-of-python-during-npm-install) or the [npm node-gyp project](https://github.com/nodejs/node-gyp) for details.

You can start the truffle development environment and console
```
$ make start_console
```

From here, in a separate console, we now need to bring up the ethereum bridge for the Oraclize.it service.
```
$ make start_bridge
```

Once the bridge has fully initialized, you should be able to run the example migrations for the MARKET Protocol smart contracts.
```
truffle(develop)> migrate --reset
```
If this fails due to a `revert`, please be sure the bridge is listening prior to attempting the migration.

A local blockchain is now running with a fully deployed suite of MARKET Protocol smart contracts.
The needed `json` ABI files can now be found in `./build/contracts/`

## Testing

In order for the tests to work, you will need to have followed the above steps to ensure truffle is running, `ethereum-bridge` is running, and the migrations have deployed our contracts.

If all of this is set up correctly, the below should work.

```shell
$ npm run test
```

## Using Docker

It is possible to build and execute tests in the same way as in Travis CI by using Docker orchestration.

Prerequisites: docker and docker-compose installed.

### Running tests

#### Import environment variables

```
set -a
source .env
```

#### Start containers

```
docker-compose up -d
```

The first run will take a while since images will be pulled from Docker registry. After that images are cached and the start will be much faster.


#### Install dependencies

```
docker-compose exec marketjs npm install
docker-compose exec eth-bridge scripts/wait_for_oraclize_connector.sh
```

#### Build

```
docker-compose exec marketjs truffle migrate
docker-compose exec marketjs npm run build
```

#### Start tests

```
docker-compose exec marketjs env TRUFFLE_DEVELOP_HOST="$TRUFFLE_DEVELOP_HOST" npm run test:prod
```


## Importing library

You can import the generated bundle to use the library modules generated by this project:

```javascript
import { Contract, Collateral, Order, Settlement } from './marketjs'
```

Additionally, you can import the transpiled modules from `dist/lib` in case you have a modular library:

```javascript
import { something } from 'marketjs/dist/lib/something'
```

## NPM scripts

 - `npm run test`: Run test suite
 - `npm run start`: Run `npm run build` in watch mode
 - `npm run test:watch`: Run test suite in [interactive watch mode](http://facebook.github.io/jest/docs/cli.html#watch)
 - `npm run test:prod`: Run linting and generate coverage
 - `npm run build`: Generate bundles and typings, create docs
 - `npm run lint`: Lints code
 - `npm run commit`: Commit using conventional commit style ([husky](https://github.com/typicode/husky) will tell you to use it if you haven't :wink:)

