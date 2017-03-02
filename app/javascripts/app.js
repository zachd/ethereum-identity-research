var Web3 = require("web3");
require("../stylesheets/app.css");
var wallet_hdpath = "m/44'/60'/0'/0/";
var Identity = require("../../contracts/Identity.sol");

// HD/BIP39 Imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
var bip39 = require("bip39");
var hdkey = require('ethereumjs-wallet/hdkey');
var HDWalletProvider = require("truffle-hdwallet-provider");

// Global variables
var identity;
var mnemonic;
var address;

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

function getIdent() {
  identity.getIdent.call(address, {from: address}).then(function(resp) {
    if(resp[0] > 0){
      show_hide("details", "new");
      document.getElementById("userid").innerHTML = resp[0];
      document.getElementById("username").innerHTML = resp[1];
      document.getElementById("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=125x125&chl=" + resp[0];
    } else {
      show_hide("new", "details");
    }
  }).catch(function(e) {
    console.log(e);
    setStatus("Error getting identity; see log.");
  });
};

window.newIdent = function newIdent() {
  var name = document.getElementById("name").value;
  setStatus("Initiating transaction...");
  identity.newIdent(name, {from: address}).then(function(value) {
    setStatus("Transaction complete!");
    getIdent();
  }).catch(function(e) {
    setStatus("Error: Invalid transaction or identity already exists.");
    console.log(e);
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

function getRandomId() {
  return Math.floor(Math.random() * 100) + 1;
}

function generateMnemonic() {
  return bip39.generateMnemonic();
}

window.addEventListener('load', function() {
  identity = Identity.deployed();

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

  // Update contract with current provider
  Identity.setProvider(window.web3.currentProvider);

  // Save user data to local storage
  localStorage.setItem('mnemonic', mnemonic);

  // Show
  document.getElementById('address').innerHTML = address;
  document.getElementById('mnemonic').innerHTML = mnemonic;

  //getIdent();
});