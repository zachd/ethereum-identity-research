# Ethereum Identity Research

This repository contains the source code accompanying my Master's thesis work entitled "_Self-Sovereign Identity using Smart Contracts on the Ethereum Blockchain_" which can be found [here](https://github.com/zachd/masters-thesis).

### Structure
The core of the system is two smart contracts, namely the _Identity Contract_ and _Recovery Contract_. These can be interacted with via the Web3.js interface. Identity attributes are represented in JSON and stored on IPFS. Transaction signing is done on the Ethereum node.

### Dependencies
[Node.js](https://github.com/nodejs/node), [TestRPC](https://github.com/ethereumjs/testrpc), [JS-IPFS](https://github.com/ipfs/js-ipfs) (optional).

### Setup
TestRPC is required for testing, as the web app chooses a randomly indexed key pair stored on the node. Ensure TestRPC is installed, then run it with `testrpc -a 100`.

A local IPFS node can be set up, or the app can be pointed at a remote node. To set up a local node, install JS-IPFS and initialise it with `jsipfs init` and `jsipfs daemon`.

Ensure that the config lines `21` and `25` in app.js point to the correct addresses of the IPFS and Ethereum node. The mnemonic used for generating the addresses on the TestRPC node must also be put in the config on line `26`.

### Installation
The web app dependencies can be installed and the web server started the commands below. The front end is compiled using [webpack](https://webpack.github.io/) and served using the webpack-dev-server module.
```sh
$ npm install
$ npm run dev
```

