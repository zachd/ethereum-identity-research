var Web3 = require("web3");
require("../stylesheets/app.css");
var Identity = require("../../contracts/Identity.sol");

// HD/BIP39 Imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
var bip39 = require("bip39");
var hdkey = require('ethereumjs-wallet/hdkey');

// Detecting Web3: http://truffleframework.com/tutorials/bundling-with-webpack#detecting-web3
window.addEventListener('load', function() {
  // Supports Metamask and Mist, and other wallets that provide 'web3'
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io')); 
  }
  Identity.setProvider(window.web3.currentProvider);
});

// Global variables
var identity;
var mnemonic;
var hdwallet;
var address;

function getIdent() {
  identity.getIdent.call(account, {from: account}).then(function(resp) {
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

function newIdent() {
  var name = document.getElementById("name").value;
  setStatus("Initiating transaction...");
  contract.newIdent(name, {from: account}).then(function(value) {
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

function generateAddress() {
  var wallet_hdpath = "m/44'/60'/0'/0/";
  mnemonic = bip39.generateMnemonic();
  hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  var wallet = hdwallet.derivePath(wallet_hdpath + "0").getWallet();
  return "0x" + wallet.getAddress().toString("hex");
}

window.onload = function() {
  identity = Identity.deployed();
  address = localStorage.getItem('address') || generateAddress();
  mnemonic = localStorage.getItem('mnemonic') || mnemonic;

  localStorage.setItem('address', address);
  localStorage.setItem('mnemonic', mnemonic);

  document.getElementById('address').innerHTML = address;
  document.getElementById('mnemonic').innerHTML = mnemonic;

  //getIdent();
}
