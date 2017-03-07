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
var recovery;
var contracts = {
  'identity': null
}

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
  contracts.identity.getDetails.call({from: address}, function(err, result) {
    if(!hasError(err) && result[0] > 0){
      // Show details in identity section
      show_hide("details", "new");
      document.getElementById("owner").innerHTML = result[0];
      document.getElementById("ipfshash").innerHTML = result[1] || '(none)';
      document.getElementById("recovery").innerHTML = result[2];
      document.getElementById("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=" + QRCODE_SIZE + "&chl=" + result[0];
      if(result[1])
        getAttributes(result[1]);
      updateRecovery(result[2]);
    } else
      show_hide("new", "details");
  });
}

function setIPFSHash(hash) {
  log("Updating IPFS hash in user profile...");
  contracts.identity.setIPFSHash.sendTransaction(hash, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("IPFS hash updated successfully.");
      getIdentity();
    }
  });
}


/* RECOVERY FUNCTIONS */
function updateRecovery(recovery_address) {
  var recovery_abi = web3.eth.contract(JSON.parse(localStorage.getItem('recovery_abi')));
  contracts.recovery = recovery_abi.at(recovery_address);
  localStorage.setItem('recovery_address', recovery_address);
}

function getRecovery() {
  contracts.recovery.getContacts.call({from: address}, function(err, result) {
    if(!hasError(err) && result){
      for (var contact of result)
        document.getElementById('contact-' + contact).className = "contact selected";
    }
  });
}

function setContacts() {
  var contacts = getContacts();
  log("Updating contacts in recovery profile...");
  contracts.identity.setContacts.sendTransaction(contacts, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("Recovery contacts updated successfully.");
      getRecovery();
    }
  });
}


/* ATTRIBUTE SETTING FUNCTIONS */
function setAttributes(input) {
  var attributes = getAttributesFromForm();
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
      stream.on('end', function(){
        // Update attributes form
        var attributes = JSON.parse(file.toString()).attributes;
        document.getElementById('attributes').innerHTML = '';
        for (var att in attributes)
          if (attributes.hasOwnProperty(att))
            addAttribute(att, attributes[att]);
        // Update user data section
        document.getElementById("data").innerHTML = JSON.stringify(
          JSON.parse(file.toString()), null, 2);
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


/* ATTRIBUTE ELEMENT FUNCTIONS */
function addAttribute(name, value){
  var attributes = document.getElementById('attributes');
  attributes.dataset.num += 1;
  attributes.innerHTML +=
    '<div class="attribute">' +
      '<input type="text" value="' + name + '""><input type="text" value="' + value + '"> ' +
      '<button>&nbsp;-&nbsp;</button>' +
    '</div>';
}

function getAttributesFromForm() {
  var attributes = {};
  var elements = document.getElementsByClassName('attribute');
  for(var elem of elements){
    var inputs = elem.getElementsByTagName('input');
    attributes[inputs[0].value] = inputs[1].value;
  }
  return attributes;
}


/* CONTRACT FUNCTIONS */
function deployIdentity(contract_id) {
  setUUID(contract_id);
  getIdentity();
}

function compileContract(contract, callback) {
  log("Compiling " + contract + " contract...");
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/contracts/" + contract + ".sol");
  xhr.onload = function() {
    web3.eth.compile.solidity(this.response, function(err, result) {
      if(!hasError(err)) {
        log(contract + " contract compiled.");
        var contract_abi = web3.eth.contract(result.info.abiDefinition);
        localStorage.setItem(contract.toLowerCase() + '_abi', JSON.stringify(result.info.abiDefinition));
        if(callback)
          deployContract(contract, contract_abi, result, callback);
      }
    });
  };
  xhr.send();
}

function deployContract(contract, contractABI, compiledContract, callback) {
  log("Creating " + contract + " contract...");

  // Get gas estimation
  web3.eth.estimateGas({data: compiledContract.code}, function(err, gasEstimate) {
    log(contract + " contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!hasError(err))
      contracts[contract.toLowerCase()] = contractABI.new(
        {from: address, data: compiledContract.code, gas: gasEstimate},
        function(err, deployResult){
          // Show deployed contract results
          if(!hasError(err))
            if(!deployResult.address) {
              log(contract + " contract tx sent. Waiting for deploy...");
            } else {
              var contract_id = deployResult.address;
              log(contract + " contract deployed. Address: " + contract_id);
              localStorage.setItem(contract.toLowerCase() + '_address', contract_id);
              callback(contract_id);
            }
        }
      );
  });
}


/* CONTACTS ELEMENT FUNCTIONS */
function showContacts() {
  for(var i = 0; i < 10; i++){
    var addr = "0x" + generateWallet(mnemonic, i).getAddress().toString("hex");
    document.getElementById("contacts").innerHTML += 
      '<span id="contact-' + addr + '" class="contact' + (i == parseInt(user_index) ? ' disabled' : '') + '">' +
        'User ' + i +
      '</span>';
  }
}

function getContacts() {
  var contacts = document.getElementsByClassName('contact selected');
  var contacts_arr = [].slice.call(contacts);
  return contacts_arr.map(function(elem) { return elem.id.substr(8); });
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
    localStorage.removeItem('identity_abi');
    localStorage.removeItem('recovery_abi');
    localStorage.removeItem('identity_address');
    localStorage.removeItem('recovery_address');
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
  if(!(localStorage.getItem('mnemonic') && localStorage.getItem('identity_address'))){
    localStorage.setItem('mnemonic', mnemonic);
    compileContract('Identity', deployIdentity);
    compileContract('Recovery', null);
  } else {
    setUUID(localStorage.getItem('identity_address'));
    var identity_abi = web3.eth.contract(JSON.parse(localStorage.getItem('identity_abi')));
    var recovery_abi = web3.eth.contract(JSON.parse(localStorage.getItem('recovery_abi')));
    contracts.identity = identity_abi.at(localStorage.getItem('identity_address'));
    contracts.recovery = recovery_abi.at(localStorage.getItem('recovery_address'));
    getIdentity();
    getRecovery();
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
  document.getElementById('setContacts').addEventListener('click', function() {
    setContacts();
  });
  document.getElementById('addAttribute').addEventListener('click', function() {
    addAttribute('', '');
  });
  document.getElementById('attributes').addEventListener('click', function() {
    if(event.target.tagName == 'BUTTON')
      event.target.parentElement.parentElement.removeChild(event.target.parentElement);
  });

  // Show contacts on page
  showContacts();
});
