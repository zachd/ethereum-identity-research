const Web3 = require("web3");
const swal = require('sweetalert2');
var qrcode = require('jsqrcode');
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
const QRCODE_SIZE = "100";
const PROVIDER = 'http://' + window.location.hostname + ':8545';
const REGISTRY_ADDRESS = "0x34d6b890f5677b3a2b45c66e3655709f1c1c5ff7";
const DEFAULT_MNEMONIC = "mammal stand weasel cricket fortune share east desk earn salt raw water";

// Contract variables
var uuid;
var recovery;
var contracts = {}

// Wallet variables
var user_index;
var mnemonic;
var wallet;
var address;
var stopScan;

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
  elem("profileuuid").innerHTML = contract_address + ' (User ' + user_index + ')';
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
      + QRCODE_SIZE + "x" + QRCODE_SIZE + "&chl=" + encodeURIComponent(JSON.stringify(
      {'action': 'contact', 'uuid': result[0]}
    ));
    elem("qrcode").style = "width: " + QRCODE_SIZE + "px; height:" + QRCODE_SIZE + "px";
    elem('attributes').innerHTML = '';
    elem('ipfs-attributes').innerHTML = '';
    // Update attributes section
    if(result[1])
      getAttributes(result[1]);
    // Update recovery contacts
    if(result[2]){
      setContract('Recovery', result[2]);
      getRecoveryContacts();
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
  contracts.recovery.getContacts.call({from: address}, function(err, result) {
    if(!hasError(err) && result){
      elem("contacts").innerHTML = '';
      for (var addr of result)
        addContact(addr)
    }
  });
}

function setRecoveryContacts() {
  var contacts = getContactElements();
  log("Updating contacts in recovery profile...");
  contracts.identity.setContacts.sendTransaction(contacts, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("Recovery contacts updated successfully.");
      swal({
        title: "Contacts Updated",
        type: 'success',
        text: 'Contacts updated successfully.'
      });
    }
  });
}

/* REGISTRY FUNCTIONS */
function compileContracts() {
  if(!localStorage.getItem('identity_abi'))
    compileContract('Identity', findUUID);
  else
    findUUID();
  if(!localStorage.getItem('recovery_abi'))
    compileContract('Recovery', null);
}

function findUUID(contract_result) {
  contracts.registry.get.call(address, {from: address}, function(err, result) {
    if(!hasError(err) && web3.toDecimal(result)){
      log("Registry result found: " + result);
      showUser(result, contract_result);
    } else {
      log("Registry result not found: " + result);
      registerUser(result, contract_result);
    }
  });
}

function showUser(contract_address) {
  setUUID(contract_address);
  getIdentity(contract_address);
}

function registerUser(contract_address, contract_result) {
  if(contract_result)
    deployContract(contract_result, "Identity", registerUUID);
  else
    compileContract("Identity", deployContract, registerUUID);
}

function registerUUID(contract_address) {
  setUUID(contract_address);

  log("Adding UUID to Registry...");
  contracts.registry.add.sendTransaction(address, contract_address, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("UUID registered successfully.");
    }
  });

  getIdentity(contract_address);
}

function setUUID(contract_address) {
  uuid = contract_address;
  setContract('Identity', contract_address);
  elem('uuid').innerHTML = contract_address 
    + ' (User ' + user_index + ')';
}

/* POPUP FUNCTIONS */
function showRequestAttestationPopup(elem) {
  var inputs = elem.getElementsByTagName('input');
  var json = getSigningJson(inputs[0].value, inputs[1].value);
  showQRPopup('Request Attestation', json);
}

function getQRCodeResult(code) {
  var parsed;
  var action;
  try {
    parsed = JSON.parse(decodeURIComponent(code).replace('+', ' '));
    action = parsed.action;
  } catch(e) {}
  if(action === "sign"){
    swal({
      title: "Signature Request",
      html: 'User: <strong>' + parsed.owner + '</strong><br /><br />' +
        '<div class="ui form">' + 
        '<div class="inline field"><label>Attribute</label><input type="text" value="' + parsed.key + '" disabled /></div>' + 
        '<div class="inline field"><label>Value</label><input type="text" value="' + parsed.value + '" disabled /></div>' +
        '</div>',
      cancelButtonText: 'Cancel',
      showCancelButton: true,
      confirmButtonText: '<i class="ui icon checkmark"></i> Sign'
    }).then(function() {
      showSigningResultPopup(parsed);
    });
  } else if (action === "save") {
    var attributes = document.getElementsByClassName('attribute');
    var added = false;
    for (var att of attributes){
      var inputs = att.getElementsByTagName('input');
      if(inputs[0].value === parsed.key && inputs[1].value === parsed.value) {
        addSignatureToFormRow({signer: parsed.signer, signature: parsed.signature}, att);
        added = true;
      }
    }
    if(added)
      setAttributes();
    else
      hasError('Error: Attribute does not exist on profile');
    resetUrl();
  } else if (action === "contact") {
    addContact(parsed.uuid);
    setRecoveryContacts();
    resetUrl();
  } else {
    hasError("Invalid QR code.")
  }
}

function showSigningResultPopup(input) {
  delete input.action;
  input.signer = uuid;
  var signature = signAttribute(JSON.stringify(input));
  var result = {
    action: 'save', signer: uuid, 
    key: input.key, value: input.value,
    signature: signature
  };
  showQRPopup('Signature Result', result);
}


function showQRPopup(title, json) {
  swal({
    title: title,
    html:
      '<img src="http://chart.apis.google.com/chart?cht=qr&chs=200x200&chl=' + 
      encodeURIComponent(JSON.stringify(json)) + '"><br />' +
      '<div class="ui form"><div class="field"><textarea rows="8">' +
      JSON.stringify(json, null, 2) +
      '</textarea></div></div>',
    showCloseButton: true
  });
}

function showDesktopQR() {
  swal({
    title: 'Scanner',
    html: '<video id="desktop-scanner" style="width: 460px;height: 345px;"></video><br />' +
    '<canvas id="qr-canvas" style="display: none"></canvas>',
    showCloseButton: true
  }).then(
    function () {},
    function (dismiss) {
      stopVideo();
    }
  );
  if (navigator.getUserMedia) {
    navigator.getUserMedia({video: true}, successCallback, function(e) {});
  } else {
    hasError("Video is not supported in this browser.");
  }
}

function successCallback(stream) {
  var video = elem('desktop-scanner');
  var canvas = elem('qr-canvas');
  video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
  video.play();
  window.localMediaStream = stream;
  canvas.width = video.offsetWidth;
  canvas.height = video.offsetHeight;
  stopScan = setInterval(function(){ scan(); }, 200);
}

function scan() {
  if (window.localMediaStream) {
    var canvas = elem('qr-canvas');
    var video = elem('desktop-scanner');
    canvas.getContext('2d').drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
    try {
      var result = qrcode().decode(canvas);
      getQRCodeResult(result);
      stopVideo();
    } catch(e) {
      // QR parsing error
    }
  }
}

function stopVideo() {
  clearInterval(stopScan);
  window.localMediaStream.getVideoTracks()[0].stop();
}


/* ATTRIBUTE SETTING FUNCTIONS */
function setAttributes() {
  var elements = getElementsFromForm();
  profile.uuid = uuid;
  profile.attributes = elements.attributes;
  profile.signatures = elements.signatures;
  log("Saving attributes to IPFS...");
  ipfs.files.add(new Buffer(JSON.stringify(profile)), function (err, result) {
    if(!hasError(err)) {
      log("Attributes saved successfully.");
      var hash = result[0].hash;
      setIPFSHash(hash);
      swal({
        title: "Attributes Saved",
        type: 'success',
        text: 'Attributes saved successfully.'
      });
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
            addAttributeFormRow(att, data.attributes[att], data.signatures[att]);
            addAttributeIDElem(att, data.attributes[att], data.signatures[att]);
          }
        }
        // Check for incoming code
        var code = getUrlParameter('code');
        if (code) {
          getQRCodeResult(code);
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
function addAttributeFormRow(name, value, signatures){
  var container = elem('attributes');
  var attribute = document.createElement('div');
  attribute.className = 'card attribute';
  attribute.innerHTML =
    '<div class="content">' +
      '<i class="right floated delete icon red" data-action="delete"></i>' +
      '<div class="inline field"><input type="text" value="' + name + '"></div>' +
      '<div class="description field"><input type="text" value="' + value + '"></div>' +
      '<div class="signatures verified"></div>' +
    '</div>' +
    '<div class="extra content">' +
      '<span class="left floated lh-two"><span class="num-attestations">0</span> Attestations</span>' +
      '<span class="right floated"><button class="ui button primary mini" data-action="sign">Request Attestation</button></span>' +
    '</div>';

  // Add signatures
  for (var sig of signatures)
    addSignatureToFormRow(sig, attribute);

  // Append to attribute container
  container.appendChild(attribute);
}

function addSignatureToFormRow(sig, attribute) {
  attribute.getElementsByClassName('signatures')[0].innerHTML += 
    '<div class="signature overflow-ellipsis" data-signer="' + sig.signer + '" data-signature="' + sig.signature + '">' +
    '<i class="ui icon checkmark"></i> Signed by <span class="signer ">' + sig.signer + '</span></div>';
  var counter = attribute.getElementsByClassName('num-attestations')[0];
  counter.innerHTML = parseInt(counter.innerHTML) + 1;
}

function getElementsFromForm() {
  var attributes = {};
  var signatures = {};
  var elements = document.getElementsByClassName('attribute');
  for (var elem of elements){
    var inputs = elem.getElementsByTagName('input');
    attributes[inputs[0].value] = inputs[1].value;
    var sig_elements = elem.getElementsByClassName('signature');
    signatures[inputs[0].value] = [];
    for (var sig of sig_elements){
      signatures[inputs[0].value].push({
        signer: sig.dataset.signer,
        signature: sig.dataset.signature
      });
    }
  }
  return {
    attributes: attributes, 
    signatures: signatures
  };
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
function addContact(addr) {
  elem("contacts").innerHTML +=
    '<div class="card contact" data-uuid="' + addr + '">' +
      '<div class="content">' +
        '<i class="right floated delete icon red" data-action="delete"></i>' +
        '<div class="title overflow-ellipsis">' + addr + '</div>' +
      '</div>' +
    '</div>';
}

function getContactElements() {
  var contacts = document.getElementsByClassName('contact');
  var contacts_arr = [].slice.call(contacts);
  return contacts_arr.map(function(elem) { return elem.dataset.uuid; });
}


/* HELPER FUNCTIONS */
function log(msg) {
  var logger = elem("logger");
  logger.innerHTML += '<br />' + (msg.toString().match(/error/i) ? '<span class="err">' + msg + '</span>' : msg);
  logger.scrollTop = logger.scrollHeight;
}

function hasError(err) {
  if(err){
    log(err);
    console.log(err);
    swal({
      title: "Operation Failed",
      type: 'error',
      html: 'There was a problem performing that action: <br />' + err
    });
  }
  return err;
}

function elem(id){
  return document.getElementById(id);
}

function resetUrl() {
  window.history.pushState({} , '', window.location.origin);
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

  // Compile and deploy registry if not defined
  if (REGISTRY_ADDRESS == "")
    compileContract('Registry', deployContract);
  else {
    // Compile Registry and find profile
    if(!localStorage.getItem('registry_abi'))
      compileContract('Registry', setRegistry);
    else
      setRegistry();
  }

  // Show data on page
  elem('address').innerHTML = address;
  elem('mnemonic').innerHTML = mnemonic;
}

/* MAIN LOAD EVENT */
window.addEventListener('load', function() {
  // Start logger
  elem('logger').innerHTML = "Ethereum Identity 1.0";

  // Check for mobile device http://stackoverflow.com/a/14283643
  if(('ontouchstart' in window || 'onmsgesturechange' in window) && window.screenX === 0)
    elem('scanner').href = "zxing://scan/?ret=" + 
      encodeURIComponent(location.protocol + '//' + location.host 
      + location.pathname + "?code={CODE}"
    );
  else
    elem('scanner').addEventListener('click', function(event) {
      showDesktopQR();
    });

  // Set sweetalert defaults
  swal.setDefaults({
    reverseButtons: true
  });

  // Get user index
  user_index = localStorage.getItem('user_index');

  // Login to wallet
  if(user_index){
    walletLogin(user_index, true);
  } else {
    swal({
      title: "Login to User",
      input: 'text',
      confirmButtonText: 'Login'
    }).then(function(result) {
      user_index = result;
      walletLogin(user_index, true);
    });
  }

  // Add button event listeners
  elem('setAttributes').addEventListener('click', function(event) {
    setAttributes();
  });
  elem('contacts').addEventListener('click', function(event) {
    var contact = event.target.parentElement.parentElement;
    if(event.target.dataset.action == 'delete')
      swal({
        title: "Confirm Delete",
        text: "Are you sure you want to delete this contact?",
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        showCancelButton: true
      }).then(function() {
          contact.parentElement.removeChild(contact);
      });
  });
  elem('setContacts').addEventListener('click', function(event) {
    setRecoveryContacts();
  });
  elem('menu').addEventListener('click', function(event) {
    var prev = elem('menu').getElementsByClassName('active')[0];
    if(event.target.tagName == 'A' && prev !== event.target){
      prev.className = 'item';
      event.target.className = 'active item';
      show_hide(event.target.dataset.tab, prev.dataset.tab);
    }
  });
  elem('addAttributeFormRow').addEventListener('click', function(event) {
    addAttributeFormRow('', '', []);
  });
  elem('attributes').addEventListener('click', function(event) {
    var attr = event.target.parentElement.parentElement;
    if(event.target.dataset.action == 'sign')
      showRequestAttestationPopup(attr.parentElement);
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
  elem('ipfs-attributes').addEventListener('click', function(event) {
    if(event.target.id == 'ipfs-attr-verify'){
      var result = verifyAttribute(event.target.parentNode.dataset.attribute, event.target.dataset.signature);
      setVerified(event.target.nextElementSibling, result);
    }
  });
});
