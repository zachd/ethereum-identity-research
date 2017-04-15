const Web3 = require("web3");
const swal = require('sweetalert2');
require("../stylesheets/app.css");
require("sweetalert2/dist/sweetalert2.min.css");
require("semantic-ui-css/semantic.min.css");

// HD/BIP39 imports: http://truffleframework.com/tutorials/using-infura-custom-provider#full-code
const bip39 = require("bip39");
const wallet_hdpath = "m/44'/60'/0'/0/";
const ethUtils = require("ethereumjs-util");
const hdkey = require('ethereumjs-wallet/hdkey');
const HDWalletProvider = require("truffle-hdwallet-provider");

// Include IPFS
const ipfsapi = require('ipfs-api');
const ipfs = ipfsapi(window.location.hostname, '5002');

// Global settings
const QRCODE_SIZE = "75";
const PROVIDER = 'http://' + window.location.hostname + ':8545';
const REGISTRY_ADDRESS = "0x5a7533b8b41517b9b7301d06ccbbb2a2d51996af";
const DEFAULT_MNEMONIC = "palace blind basic business first term share tonight orphan unhappy hurdle unable";

// Contract variables
var uuid;
var recovery;
var contracts = {}

// Wallet variables
var user_index;
var profile_index;
var mnemonic;
var wallet;
var address;
var profile_address;

// JSON profile
var profile = {
  "uuid": null,
  "attributes": null,
  "signatures": null
};

/* IDENTITY FUNCTIONS */
function getIdentity(contract_address) {
  var identity_abi = web3.eth.contract(JSON.parse(localStorage.getItem('identity_abi')));
  var contract = identity_abi.at(contract_address);
  elem("profileuuid").innerHTML = contract_address + ' (User ' + profile_index + ')';
  contract.getDetails.call({from: address}, function(err, result) {
    if(!hasError(err))
      showIdentity(result);
  });
}

function showIdentity(result) {
  if(result[0] > 0){
    // Update profile box
    elem("owner").innerHTML = result[0];
    elem("ipfshash").innerHTML = result[1] || '(none)';
    elem("recovery").innerHTML = result[2];
    elem("qrcode").src = "http://chart.apis.google.com/chart?cht=qr&chs=" 
      + QRCODE_SIZE + "x" + QRCODE_SIZE + "&chl=" + result[0];
    elem("qrcode").style = "width: " + QRCODE_SIZE + "px; height:" + QRCODE_SIZE + "px";
    elem('attributes').innerHTML = '';
    elem('ipfs-attributes').innerHTML = '';
    // Update attributes section
    if(result[1])
      getAttributes(result[1]);
    // Update recovery contacts
    if(user_index == profile_index){
      if(result[2]){
        setContract('Recovery', result[2]);
        getRecoveryContacts();
      }
    }
  }
}

function setIPFSHash(hash) {
  log("Updating IPFS hash in user profile...");
  contracts.identity.setIPFSHash.sendTransaction(hash, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("IPFS hash updated successfully.");
      elem("ipfshash").innerHTML = hash || '(none)';
      getAttributes(hash);
    }
  });
}


/* RECOVERY FUNCTIONS */
function getRecoveryContacts() {
  refreshContacts();
  contracts.recovery.getContacts.call({from: address}, function(err, result) {
    if(!hasError(err) && result){
      for (var contact of result)
        elem('contact-' + contact).className = "contact selected";
    }
  });
}

function setRecoveryContacts() {
  var contacts = getContacts();
  log("Updating contacts in recovery profile...");
  contracts.identity.setContacts.sendTransaction(contacts, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("Recovery contacts updated successfully.");
      getRecoveryContacts();
    }
  });
}

/* REGISTRY FUNCTIONS */
function compileContracts() {
  if(!localStorage.getItem('identity_abi'))
    compileContract('Identity', checkUsers);
  else
    checkUsers();
  if(!localStorage.getItem('recovery_abi'))
    compileContract('Recovery', null);
}

function checkUsers(contract_result) {
  findUUID(address, showUser, registerUser, contract_result);
  findUUID(profile_address, showProfile, profileNotFound);
}

function findUUID(key, found, not_found, contract_result) {
  contracts.registry.get.call(key, {from: address}, function(err, result) {
    if(!hasError(err) && web3.toDecimal(result)){
      log("Registry result found: " + result);
      found(result, contract_result);
    } else {
      log("Registry result not found: " + result);
      not_found(result, contract_result);
    }
  });
}

function showUser(contract_address) {
  setUUID(contract_address);
}

function registerUser(contract_address, contract_result) {
  if(contract_result)
    deployContract(contract_result, "Identity", registerUUID);
  else
    compileContract("Identity", deployContract, registerUUID);
}

function showProfile(contract_address) {
  getIdentity(contract_address);
}

function profileNotFound(contract_address) {
  log("Error: Profile not found.");
}

function registerUUID(contract_address) {
  setUUID(contract_address);

  log("Adding UUID to Registry...");
  contracts.registry.add.sendTransaction(address, contract_address, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("UUID registered successfully.");
    }
  });

  if(user_index == profile_index)
    getIdentity(contract_address);
}

function setUUID(contract_address) {
  uuid = contract_address;
  setContract('Identity', contract_address);
  elem('uuid').innerHTML = contract_address 
    + ' (User ' + user_index + ')';
}

/* POPUP FUNCTIONS */
function showSigningPopup(elem) {
  var inputs = elem.getElementsByTagName('input');
  var json = getSigningJson(inputs[0].value, inputs[1].value);
  showQRPopup('Request Attestation', json);
}

function getQRCodeResult() {
  var code = getUrlParameter('code');
  if (code) {
    var parsed = JSON.parse(decodeURIComponent(code));
    swal({
      title: "QR Code",
      html: 'Here is the code:' +
        '<div class="ui form"><div class="field"><textarea rows="8">' +
        JSON.stringify(parsed, null, 2) +
        '</textarea></div></div>',
      confirmButtonText: 'Sweet'
    });
  }
}


function showQRPopup(title, json) {
  swal({
    title: title,
    html:
      '<img src="http://chart.apis.google.com/chart?cht=qr&chs=200x200&chl=' + 
      encodeURI(JSON.stringify(json)) + '"><br />' +
      '<div class="ui form"><div class="field"><textarea rows="8">' +
      JSON.stringify(json, null, 2) +
      '</textarea></div></div>',
    showCloseButton: true
  });
}


/* ATTRIBUTE SETTING FUNCTIONS */
function setAttributes(input) {
  var attributes = getAttributesFromForm();
  var signatures = {};
  log("Signing attributes...");
  for (var att in attributes) {
    if (attributes.hasOwnProperty(att)){
      signatures[att] = {'address': address};
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
        var data = JSON.parse(file.toString());
        elem('attributes').innerHTML = '';
        elem('ipfs-attributes').innerHTML = '';
        for (var att in data.attributes){
          if (data.attributes.hasOwnProperty(att)){
            addAttributeFormRow(att, data.attributes[att]);
            addAttributeIDElem(att, data.attributes[att], 
              data.signatures[att].address, data.signatures[att].signature);
          }
        }
      });
    }
  });
}


/* ATTRIBUTE SIGNATURE FUNCTIONS */
function signAttribute(attribute) {
  var hash = ethUtils.sha3(attribute);
  var sig = ethUtils.ecsign(hash, wallet.getPrivateKey());
  var RPCsig = ethUtils.toRpcSig(sig.v, sig.r, sig.s);
  return RPCsig;
}

function verifyAttribute(attribute, RPCsig) {
  var hash = ethUtils.sha3(attribute);
  var sig = ethUtils.fromRpcSig(RPCsig);
  return ethUtils.ecrecover(hash, sig.v, sig.r, sig.s);
}

function getSigningJson(key, value) {
  var result = {};
  result.action = "sign";
  result.owner = uuid;
  result.key = key;
  result.value = value;
  return result;
}

function setVerified(element, result) {
  var textresult = result ? 'Verified' : 'Unverified';
  element.className = textresult.toLowerCase();
  element.innerHTML = textresult;
}


/* ATTRIBUTE ELEMENT FUNCTIONS */
function addAttributeFormRow(name, value){
  var container = elem('attributes');
  var attribute = document.createElement('div');
  attribute.className = 'attribute';
  attribute.innerHTML =
    '<div class="fields"><span class="three field"><input type="text" value="' + name + '"></span>' +
    '<span class="three field"><input type="text" value="' + value + '"></span>' +
    '<span class="one field"><button class="ui button primary" data-action="sign">Request Attestation</button></span>' +
    '<span class="one field"><button class="ui button negative" data-action="delete">Delete</button></span></div>';
  container.appendChild(attribute);
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

function addAttributeIDElem(name, value, signer, signature) {
  var ipfsattributes = elem('ipfs-attributes');
  ipfsattributes.innerHTML +=
    '<div class="ipfs-attribute">' +
      '<div><span class="ipfs-attribute-name">' + name + '</span>: ' +
      '<span class="ipfs-attribute-value">' + value + '</span></div>' +
      '<div>Signed by: <span class="ipfs-attribute-signer overflow-ellipsis">' + signer + '</span></div>' +
      '<div class="ipfs-attribute-buttons" data-attribute="' + name + ':' + value + '">' +
        '<button id="ipfs-attr-sign" class="mini ui basic grey button">Sign</button>' +
        '<button id="ipfs-attr-verify" class="mini ui basic grey button" data-signature="' + signature + '">Verify</button>' +
        '<span class="unverified">Unverified</span>'
      '</div>' + 
    '</div>';
}


/* CONTRACT FUNCTIONS */
function setRegistry() {
  setContract('Registry', REGISTRY_ADDRESS);
  compileContracts();
}

function setContract(contract_name, contract_address) {
  var contract_obj = web3.eth.contract(JSON.parse(localStorage.getItem(contract_name.toLowerCase() + '_abi')));
  contracts[contract_name.toLowerCase()] = contract_obj.at(contract_address);
  localStorage.setItem(contract_name.toLowerCase() + '_address', contract_address);
}

function compileContract(contract_name, callback, deploy_callback) {
  log("Compiling " + contract_name + " contract...");
  var params = params || [];
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/contracts/" + contract_name + ".sol");
  xhr.onload = function() {
    web3.eth.compile.solidity(this.response, function(err, result) {
      if(!hasError(err)) {
        log(contract_name + " contract compiled.");
        localStorage.setItem(contract_name.toLowerCase() + '_abi', JSON.stringify(result.info.abiDefinition));
        if(callback)
          callback.apply(null, [result, contract_name, deploy_callback]);
      }
    });
  };
  xhr.send();
}

function deployContract(result, contract_name, callback) {
  log("Deploying " + contract_name + " contract...");
  var contract_obj = web3.eth.contract(result.info.abiDefinition);

  // Get gas estimation
  web3.eth.estimateGas({data: result.code}, function(err, gasEstimate) {
    log(contract_name + " contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!hasError(err))
      contracts[contract_name.toLowerCase()] = contract_obj.new(
        {from: address, data: result.code, gas: gasEstimate},
        function(err, deployResult){
          // Show deployed contract results
          if(!hasError(err))
            if(!deployResult.address) {
              log(contract_name + " contract tx sent. Waiting for deploy...");
            } else {
              var contract_id = deployResult.address;
              log(contract_name + " contract deployed. Address: " + contract_id);
              localStorage.setItem(contract_name.toLowerCase() + '_address', contract_id);
              if(callback)
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
    elem("contacts").innerHTML +=
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

function refreshContacts() {
  var contacts = document.getElementsByClassName('contact');
  for(var contact of contacts)
    contact.className = 'contact';
}


/* HELPER FUNCTIONS */
function log(msg) {
  var logger = elem("logger");
  logger.innerHTML += '<br />' + (msg.toString().match(/error/i) ? '<span class="err">' + msg + '</span>' : msg);
  logger.scrollTop = logger.scrollHeight;
}

function hasError(err) {
  if(err)
    log(err);
  return err;
}

function elem(id){
  return document.getElementById(id);
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
  elem(show).style.display = "block";
  elem(hide).style.display = "none";
}

/* KEY GENERATION FUNCTIONS */
function generateMnemonic() {
  return bip39.generateMnemonic();
}

function generateWallet(mnemonic, index) {
  var hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  return hdwallet.derivePath(wallet_hdpath + index).getWallet();
}


/* LOGIN FUNCTION */
function walletLogin(user_index, first_run) {
  log("Logging in as User " + user_index);

  // Reset saved state from previous user
  if(user_index !== localStorage.getItem('user_index')){
    localStorage.setItem('user_index', user_index);
    localStorage.removeItem('identity_address');
    localStorage.removeItem('recovery_address');
  }

  // Generate Wallet
  mnemonic = localStorage.getItem('mnemonic') || DEFAULT_MNEMONIC || generateMnemonic();
  wallet = generateWallet(mnemonic, user_index);
  address = "0x" + wallet.getAddress().toString("hex");
  profile_address = "0x" + generateWallet(mnemonic, profile_index).getAddress().toString("hex");

  log("User Address: " + address);
  log("Mnemonic: " + mnemonic);

  // Supports Metamask and Mist, and other wallets that provide 'web3'
  // http://truffleframework.com/tutorials/bundling-with-webpack
  if (first_run && typeof window.web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    var provider = new HDWalletProvider(mnemonic, PROVIDER, user_index);
    window.web3 = new Web3(provider);
  }
  log("Web3 Provider: " + web3.currentProvider.constructor.name);

  // Get address balance
  web3.eth.getBalance(address, function(err, result){
    if(!hasError(err)) {
      elem('balance').innerHTML = web3.fromWei(result, 'ether');
      log("User Balance: " + web3.fromWei(result, 'ether'));
    }
  });

  // Compile Registry and find profiles
  if(!localStorage.getItem('registry_abi'))
    compileContract('Registry', setRegistry);
  else
    setRegistry();

  // Show data on page
  elem('address').innerHTML = address;
  elem('mnemonic').innerHTML = mnemonic;
}

/* MAIN LOAD EVENT */
window.addEventListener('load', function() {
  // Start logger
  elem('logger').innerHTML = "Ethereum Identity 1.0";
  elem('scanner').href = "zxing://scan/?ret=" + 
  encodeURIComponent(location.protocol + '//' + location.host 
    + location.pathname + "?code={CODE}");

  // Set sweetalert defaults
  swal.setDefaults({
    reverseButtons: true
  });

  // Get user and profile index
  user_index = localStorage.getItem('user_index') || "0";
  profile_index = getUrlParameter('id') || user_index;

  // Login to wallet
  walletLogin(user_index, true);

  // Check for incoming code
  getQRCodeResult();

  // Compile and deploy registry if not defined
  if (REGISTRY_ADDRESS == "")
    compileContract('Registry', deployContract);

  // Add button event listeners
  elem('setAttributes').addEventListener('click', function() {
    setAttributes(elem('attributes').value);
  });
  elem('contacts').addEventListener('click', function() {
    if(event.target.tagName == 'SPAN')
      event.target.className = event.target.className == 'contact' ? 'contact selected' : 'contact';
  });
  elem('setContacts').addEventListener('click', function() {
    setRecoveryContacts();
  });
  elem('menu').addEventListener('click', function() {
    var prev = elem('menu').getElementsByClassName('active')[0];
    if(event.target.tagName == 'A' && prev !== event.target){
      prev.className = 'item';
      event.target.className = 'active item';
      show_hide(event.target.dataset.tab, prev.dataset.tab);
    }
  });
  elem('addAttributeFormRow').addEventListener('click', function() {
    addAttributeFormRow('', '');
  });
  elem('attributes').addEventListener('click', function() {
    var attr = event.target.parentElement.parentElement;
    if(event.target.dataset.action == 'sign')
      showSigningPopup(attr);
    if(event.target.dataset.action == 'delete')
      swal({
        title: "Confirm Delete",
        text: "Are you sure you want to delete this attribute?",
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        showCancelButton: true
      }).then(function() {
          attr.parentElement.removeChild(attr);
      });
  });
  elem('ipfs-attributes').addEventListener('click', function() {
    if(event.target.id == 'ipfs-attr-verify'){
      var result = verifyAttribute(event.target.parentNode.dataset.attribute, event.target.dataset.signature);
      setVerified(event.target.nextElementSibling, result);
    }
  });
  /*elem('user_changer').addEventListener('change', function() {
    // Set indexes
    user_index = event.target.value;
    profile_index = getUrlParameter('id') || user_index;
    // Hide user details
    elem("uuid").innerHTML = "(none)";
    // Reset logger
    var logger = elem("logger");
    logger.innerHTML = "Changing User...";
    // Login as user
    walletLogin(user_index, false);
  });*/

  // Show contacts on page
  //showContacts();
});
