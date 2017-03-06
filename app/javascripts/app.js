const Web3 = require("web3");
require("../stylesheets/app.css");
const wallet_hdpath = "m/44'/60'/0'/0/";

// HD/BIP39 imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
const bip39 = require("bip39");
const ethUtils = require("ethereumjs-util");
const hdkey = require('ethereumjs-wallet/hdkey');
const HDWalletProvider = require("truffle-hdwallet-provider");

// Include IPFS
const ipfsapi = require('ipfs-api');
const ipfs = ipfsapi('localhost', '5002');

// Global settings
const QRCODE_SIZE = "75x75";
const PROVIDER = "http://localhost:8545";

// Contract variables
var uuid;
var identity;
var recovery;

// Wallet variables
var user_index;
var mnemonic;
var wallet;
var address;

// JSON profile
var profile = {
  "uuid": null,
  "attributes": null,
  "signatures": null
};

/* IDENTITY FUNCTIONS */
function getIdentity() {
  identity.getDetails.call({from: address}, function(err, result) {
    if(!hasError(err) && result[0] > 0){
      show_hide("details", "new");
      document.getElementById("owner").innerHTML = result[0];
      document.getElementById("ipfshash").innerHTML = result[1];
      document.getElementById("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=" + QRCODE_SIZE + "&chl=" + result[0];
      if(result[1])
        getAttributes(result[1]);
    } else
      show_hide("new", "details");
  });
}

function setIPFSHash(hash) {
  log("Updating IPFS hash in user profile...");
  identity.setIPFSHash.sendTransaction(hash, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("IPFS hash updated successfully.");
      getIdentity();
    }
  });
}

/* ATTRIBUTE SETTING FUNCTIONS */
function setAttributes(input) {
  var attributes = JSON.parse(input);
  var signatures = {};
  log("Signing attributes...");
  for (var att in attributes) {
    if (attributes.hasOwnProperty(att)){
      signatures[att] = {'uuid': uuid};
      signatures[att]['signature'] = signAttribute(att + ":" + attributes[att]);
    }
  }
  profile.uuid = uuid;
  profile.attributes = attributes;
  profile.signatures = signatures;
  log("Saving attributes to IPFS...");
  ipfs.files.add(new Buffer(JSON.stringify(profile)), function (err, result) {
    if(!hasError(err)) {
      log("Attributes saved successfully.");
      var hash = result[0].hash;
      setIPFSHash(hash);
    }
  });
}

function getAttributes(hash) {
  ipfs.files.cat(hash, function (err, stream) {
    if(!hasError(err)) {
      var file = '';
      stream.on('data', function(buffer){
        file += buffer.toString();
      });
      stream.on('end',function(){
        var attributes = JSON.stringify(JSON.parse(file.toString()).attributes);
        document.getElementById("data").innerHTML = JSON.stringify(JSON.parse(file.toString()), null, 2);
        document.getElementById("attributes").value = attributes;
      });
    }
  });
}

/* ATTRIBUTE SIGNATURE FUNCTIONS */
function signAttribute(attribute) {
  var hash = ethUtils.sha3(attribute);
  var sig = ethUtils.ecsign(hash, wallet.getPrivateKey());
  var RPCsig = ethUtils.toRpcSig(sig.v, sig.r, sig.s);
  verifyAttribute(hash, RPCsig);
  return RPCsig;
}

function verifyAttribute(hash, RPCsig) {
  var sig = ethUtils.fromRpcSig(RPCsig);
  return ethUtils.ecrecover(hash, sig.v, sig.r, sig.s);
}


/* CONTRACT FUNCTIONS */
function compileContract(contract, callback) {
  log("Compiling " + contract + " contract...");
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/contracts/" + contract + ".sol");
  xhr.onload = function() {
    web3.eth.compile.solidity(this.response, function(err, result) {
      if(!hasError(err)) {
        var contract_abi = web3.eth.contract(result.info.abiDefinition);
        localStorage.setItem(contract.toLowerCase() + '_abi', JSON.stringify(result.info.abiDefinition));
        log(contract + " contract compiled.");
        callback(result);
      }
    });
  };
  xhr.send();
}

function deployIdentity(compiledContract) {
  // Create contract object
  log("Creating Identity contract...");

  // Get gas estimation
  web3.eth.estimateGas({data: compiledContract.code}, function(err, gasEstimate) {
    log("Identity contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!hasError(err))
      identity = contract_abi.new({from: address, data: compiledContract.code, gas: gasEstimate}, function(err, deployResult){
          // Show deployed contract results
        if(!hasError(err))
          if(!deployResult.address) {
            log("Contract transaction sent. Waiting for deploy...");
          } else {
            // Update contract object with web3 provider
            var contract_id = deployResult.address;
            log("Contract deployed. Address: " + contract_id);
            setUUID(contract_id);
            getIdentity();
          }
      });
  });
}

function deployRecovery(compiledContract) {
  log("Creating Recovery contract...");

  // Get gas estimation
  web3.eth.estimateGas({data: compiledContract.code}, function(err, gasEstimate) {
    log("Recovery contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!hasError(err))
      recovery = contract_abi.new({from: address, data: compiledContract.code, gas: gasEstimate}, function(err, deployResult){
        // Show deployed contract results
        if(!hasError(err))
          if(!deployResult.address) {
            log("Contract transaction sent. Waiting for deploy...");
          } else {
            log("Contract deployed. Address: " + deployResult.address);
          }
      });
  });
}


/* RECOVERY CONTACTS FUNCTIONS */
function showContacts() {
  for(var i = 0; i < 10; i++){
    var addr = "0x" + generateWallet(mnemonic, i).getAddress().toString("hex");
    if(i !== parseInt(user_index))
      document.getElementById("contacts").innerHTML += 
       '<span id="contact-' + i + '" class="contact" data-address="' + addr + '">User ' + i + '</span>';
  }
}

function getContacts() {
  var contacts = document.getElementsByClassName('contact selected');
  var contacts_arr = [].slice.call(contacts);
  return contacts_arr.map(function(elem) { return elem.dataset.address; });
}

function updateContacts(contacts) {
  console.log(contacts);
}


/* HELPER FUNCTIONS */
function log(msg) {
  var logger = document.getElementById("logger");
  logger.innerHTML += '<br />' + (msg.toString().match(/error/i) ? '<span class="err">' + msg + '</span>' : msg);
  logger.scrollTop = logger.scrollHeight;
}

function hasError(err) {
  if(err)
    log(err);
  return err;
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

function setUUID(contract_id) {
  uuid = contract_id;
  localStorage.setItem('uuid', contract_id);
  document.getElementById('uuid').innerHTML = contract_id;
}


/* KEY GENERATION FUNCTIONS */
function generateMnemonic() {
  return bip39.generateMnemonic();
}

function generateWallet(mnemonic, index) {
  var hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  return hdwallet.derivePath(wallet_hdpath + index).getWallet();
}


/* MAIN LOAD EVENT */
window.addEventListener('load', function() {
  // Start logger
  document.getElementById('logger').innerHTML = "Ethereum Identity 1.0";

  // Get user index
  user_index = getUrlParameter('id') || "0";
  if(user_index !== localStorage.getItem('user_index')){
    localStorage.setItem('user_index', user_index);
    localStorage.removeItem('uuid');
    localStorage.removeItem('identity_abi');
  }

  // Generate Wallet
  mnemonic = localStorage.getItem('mnemonic') || generateMnemonic();
  wallet = generateWallet(mnemonic, user_index);
  address = "0x" + wallet.getAddress().toString("hex");

  log("User Address: " + address);
  log("Mnemonic: " + mnemonic);

  // Supports Metamask and Mist, and other wallets that provide 'web3'
  // http://truffleframework.com/tutorials/bundling-with-webpack
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    var provider = new HDWalletProvider(mnemonic, PROVIDER, user_index);
    window.web3 = new Web3(provider);
  }
  log("Web3 Provider: " + web3.currentProvider.constructor.name);

  // Get address balance
  web3.eth.getBalance(address, function(err, result){
    if(!hasError(err)) {
      document.getElementById('balance').innerHTML = web3.fromWei(result, 'ether');
      log("User Balance: " + web3.fromWei(result, 'ether'));
    }
  });

  // Save user mnemonic and create ident
  if(!(localStorage.getItem('mnemonic') && localStorage.getItem('uuid'))){
    localStorage.setItem('mnemonic', mnemonic);
    compileContract('Identity', deployIdentity);
    compileContract('Recovery', deployRecovery);
  } else {
    var identity_abi = web3.eth.contract(JSON.parse(localStorage.getItem('identity_abi')));
    setUUID(localStorage.getItem('uuid'));
    identity = identity_abi.at(localStorage.getItem('uuid'));
    getIdentity();
  }

  // Show data on page
  document.getElementById('address').innerHTML = address;
  document.getElementById('mnemonic').innerHTML = mnemonic;

  // Add button event listeners
  document.getElementById('setAttributes').addEventListener('click', function() {
    setAttributes(document.getElementById('attributes').value);
  });
  document.getElementById('contacts').addEventListener('click', function() {
    if(event.target.tagName == 'SPAN')
      event.target.className = event.target.className == 'contact' ? 'contact selected' : 'contact';
  });
  document.getElementById('updateContacts').addEventListener('click', function() {
    updateContacts(getContacts());
  });

  // Show contacts on page
  showContacts();
});
