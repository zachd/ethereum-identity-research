const Web3 = require("web3");
require("../stylesheets/app.css");
const wallet_hdpath = "m/44'/60'/0'/0/";
const ethUtils = require("ethereumjs-util");

// HD/BIP39 imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
const bip39 = require("bip39");
const hdkey = require('ethereumjs-wallet/hdkey');
const HDWalletProvider = require("truffle-hdwallet-provider");


// Include IPFS
const ipfsapi = require('ipfs-api')
const ipfs = ipfsapi('localhost', '5002')

// Global variables
var identity;
var uuid;
var mnemonic;
var wallet;
var address;

// JSON profile
var profile = {
  "uuid": uuid,
  "attributes": null,
  "signatures": null
};

function log(msg) {
  var logger = document.getElementById("logger");
  logger.innerHTML += '<br />' + (msg.toString().match(/error/i) ? '<span class="err">' + msg + '</span>' : msg);
  logger.scrollTop = logger.scrollHeight;
};

function getIdentity() {
  identity.getDetails.call({from: address}, function(err, result) {
    if(!err && result[0] > 0){
      show_hide("details", "new");
      document.getElementById("owner").innerHTML = result[0];
      document.getElementById("ipfshash").innerHTML = result[1];
      document.getElementById("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=125x125&chl=" + result[0];
      if(result[1])
        getAttributes(result[1]);
    } else {  
      log(err);
      show_hide("new", "details");
    }
  });
};

function setIPFSHash(hash) {
  log("Updating IPFS hash in user profile...");
  identity.setIPFSHash.sendTransaction(hash, {from: address}, function(err, result) {
    if (!err) {
      log("IPFS hash updated successfully.");
      getIdentity();
    } else
      log(err);
  });
}

function setAttributes(input) {
  var attributes = JSON.parse(input);
  var signatures = {};
  log("Signing attributes...");
  for (var att in attributes) {
    if (attributes.hasOwnProperty(att))
      signatures[att + '_signed'] = signAttribute(att);
  }
  profile.uuid = uuid;
  profile.attributes = attributes;
  profile.signatures = signatures;
  log("Saving attributes to IPFS...");
  ipfs.files.add(new Buffer(JSON.stringify(profile)), function (err, result) {
    if (!err) {
      log("Attributes saved successfully.");
      var hash = result[0].hash;
      setIPFSHash(hash);
    } else
      log(err);
  });
}

function signAttribute(attribute) {
  var hash = ethUtils.sha3(attribute);
  var signature = ethUtils.ecsign(hash, wallet.getPrivateKey());
  verifyAttribute(hash, signature);
  return signature;
}

function verifyAttribute(hash, signature) {
  return ethUtils.ecrecover(hash, signature.v, signature.r, signature.s)
}

function getAttributes(hash) {
  ipfs.files.cat(hash, function (err, stream) {
    if(!err) {
      var file = '';
      stream.on('data', function(buffer){
        file += buffer.toString();
      });
      stream.on('end',function(){
        var attributes = JSON.stringify(JSON.parse(file.toString()).attributes);
        document.getElementById("data").innerHTML = file.toString();
        document.getElementById("attributes").value = attributes;
      });
    } else
      log(err);
  });
}

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

function compileContract(contract, callback) {
  log("Compiling " + contract + " contract...");
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/contracts/" + contract + ".sol");
  xhr.onload = function() {
    web3.eth.compile.solidity(this.response, function(err, result) {
      if(!err){
        log(contract + " contract compiled.");
        callback(result);
      }
      else
        log(err);
    });
  };
  xhr.send();
}

function deployIdentity(compiledContract) {
  // Create contract object
  var contract_abi = web3.eth.contract(compiledContract.info.abiDefinition);
  localStorage.setItem('contract_abi', JSON.stringify(compiledContract.info.abiDefinition));
  log("Creating Identity contract...");

  // Get gas estimation
  web3.eth.estimateGas({data: compiledContract.code}, function(err, gasEstimate) {
    log("Identity contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!err)
      identity = contract_abi.new({from: address, data: compiledContract.code, gas: gasEstimate}, function(err, deployResult){
        if(!err)
          // Show deployed contract results
          if(!deployResult.address) {
            log("Contract transaction sent. Waiting for deploy...");
          } else {
            // Update contract object with web3 provider
            var contract_id = deployResult.address;
            log("Contract deployed. Address: " + contract_id);
            setUUID(contract_id);
            getIdentity();
          }
        else
          log(err);
      });
    else
      log(err);
  });
}

function showContacts() {
  for(var i = 1; i <= 5; i++){
    var contact = generateAddress(mnemonic, i);
    document.getElementById("contacts").innerHTML += 
      '<span id="contact-' + i + '" class="contact">User ' + i + '</span>';
  }
}

function setUUID(contract_id) {
  uuid = contract_id;
  localStorage.setItem('contract_id', contract_id);
  document.getElementById('uuid').innerHTML = contract_id;
}

function generateMnemonic() {
  return bip39.generateMnemonic();
}

function generateAddress(mnemonic, index) {
  var hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  wallet = hdwallet.derivePath(wallet_hdpath + index.toString()).getWallet();
  return "0x" + wallet.getAddress().toString("hex");
}

window.addEventListener('load', function() {
  // Start logger
  document.getElementById('logger').innerHTML = "Ethereum Identity 1.0";

  // Generate Wallet
  mnemonic = localStorage.getItem('mnemonic') || generateMnemonic();
  address = generateAddress(mnemonic, 0);

  log("User Address: " + address);
  log("Mnemonic: " + mnemonic);

  // Supports Metamask and Mist, and other wallets that provide 'web3'
  // http://truffleframework.com/tutorials/bundling-with-webpack
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    var provider = new HDWalletProvider(mnemonic, "http://localhost:8545");
    window.web3 = new Web3(provider);
  }
  log("Web3 Provider: " + web3.currentProvider.constructor.name);

  // Get address balance
  web3.eth.getBalance(address, function(err, result){
    document.getElementById('balance').innerHTML = web3.fromWei(result, 'ether');
    log("User Balance: " + web3.fromWei(result, 'ether'));
  });

  // Save user mnemonic and create ident
  if(!(localStorage.getItem('mnemonic') && localStorage.getItem('contract_id'))){
    localStorage.setItem('mnemonic', mnemonic);
    compileContract('Identity', deployIdentity);
  } else {
    var contract_abi = web3.eth.contract(JSON.parse(localStorage.getItem('contract_abi')));
    setUUID(localStorage.getItem('contract_id'));
    identity = contract_abi.at(localStorage.getItem('contract_id'));
    getIdentity();
  }

  // Show data on page
  document.getElementById('address').innerHTML = address;
  document.getElementById('mnemonic').innerHTML = mnemonic;

  // Add event listener
  document.getElementById('setAttributes').addEventListener('click', function() {
    setAttributes(document.getElementById('attributes').value);
  });
  document.getElementById('contacts').addEventListener('click', function() {
    if(event.target.tagName == "SPAN")
      event.target.className = event.target.className == "contact" ? "contact selected" : "contact";
  });

  showContacts();
});
