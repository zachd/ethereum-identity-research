var Web3 = require("web3");
require("../stylesheets/app.css");
var wallet_hdpath = "m/44'/60'/0'/0/";

// HD/BIP39 Imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
var bip39 = require("bip39");
var hdkey = require('ethereumjs-wallet/hdkey');
var HDWalletProvider = require("truffle-hdwallet-provider");

// Global variables
var contract;
var mnemonic;
var address;

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

function getIdent() {
  contract.getDetails.call({from: address}, function(err, result) {
    if(result[0] > 0){
      show_hide("details", "new");
      document.getElementById("userid").innerHTML = result[0];
      document.getElementById("username").innerHTML = result[1];
      document.getElementById("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=125x125&chl=" + result[0];
    } else {  
      show_hide("new", "details");
    }
  })
};

function getRecovery() {
  setStatus("Initiating transaction...");
  contract.getRecovery.call({from: address}, function(err, result) {
    setStatus("Transaction complete! Result: " + result);
  });
};

function getUrlParameter(input) {
    var vars = decodeURIComponent(window.location.search.substring(1)).split('&'), param;
    for (var i = 0; i < vars.length; i++) {
        param = vars[i].split('=');
        if (param[0] === input)
          return param[1] === undefined ? true : param[1];
    }
}

function show_hide(show, hide){
  document.getElementById(show).style.display = "block";
  document.getElementById(hide).style.display = "none";
}

function compileIdentity() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/contracts/Identity.sol");
  xhr.onload = function() {
    web3.eth.compile.solidity(this.response, function(err, result) {
      if(!err)
        deployIdentity(result);
      else
        setStatus(err);
    });
  };
  xhr.send();
}

function deployIdentity(compiledContract) {
  // Create contract object
  var contractObj = web3.eth.contract(compiledContract.info.abiDefinition);
  setStatus("Creating Identity contract");

  // Get gas estimation
  web3.eth.estimateGas({data: compiledContract.code}, function(err, gasEstimate) {
    setStatus("Contract deploy gas estimate: " + gasEstimate);
    // Deploy contract
    if(!err)
      contract = contractObj.new({from: address, data: compiledContract.code, gas: gasEstimate}, function(err, deployResult){
        if(!err)
          // Show deployed contract results
          if(!deployResult.address) {
            setStatus("Contract transaction sent. Waiting for deploy...");
          } else {
            // Update contract object with web3 provider
            var contract_id = deployResult.address;
            setStatus("Contract deployed! Address: " + contract_id);
            localStorage.setItem('contract_id', contract_id);
            getIdent();
          }
        else
          setStatus(err);
      });
    else
      setStatus(err);
  });
}

function generateMnemonic() {
  return bip39.generateMnemonic();
}

window.addEventListener('load', function() {

  // Generate Wallet
  mnemonic = localStorage.getItem('mnemonic') || generateMnemonic();
  var hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  var wallet = hdwallet.derivePath(wallet_hdpath + "0").getWallet();
  address = "0x" + wallet.getAddress().toString("hex");

  // Supports Metamask and Mist, and other wallets that provide 'web3'
  // http://truffleframework.com/tutorials/bundling-with-webpack
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    var provider = new HDWalletProvider(mnemonic, "http://localhost:8545");
    window.web3 = new Web3(provider);
  }

  // Get address balance
  web3.eth.getBalance(address, function(err, result){
    document.getElementById('balance').innerHTML = web3.fromWei(result, 'ether');
  });

  // Save user mnemonic and create ident
  if(!(localStorage.getItem('mnemonic') && localStorage.getItem('contract_id'))){
    localStorage.setItem('mnemonic', mnemonic);
    compileIdentity();
  }

  // Show data on page
  document.getElementById('address').innerHTML = address;
  document.getElementById('mnemonic').innerHTML = mnemonic;

  // Add event listeners
  document.getElementById("getRecovery").addEventListener("click", function() {getRecovery();});

});

