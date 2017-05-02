const Web3 = require("web3");
const uuid_gen = require("uuid");
const swal = require('sweetalert2');
var qrcode = require('jsqrcode');
require("../stylesheets/app.css");
require("sweetalert2/dist/sweetalert2.min.css");
require("semantic-ui-css/semantic.min.css");

// Contract import
const ContractImport = require('../contracts/Contracts.sol');

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
const NUM_ACCOUNTS = 100;
const PROVIDER = 'http://' + window.location.hostname + ':8545';
const DEFAULT_MNEMONIC = "mixed aisle dry space raven engine rule include shuffle mouse parade stereo";

// Contract variables
var uuid;
var recovery;
var contracts = {}

// Wallet variables
var user_index;
var user_name;
var user_resolve = null;
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
function getIdentity() {
  fetchIdentity(uuid, showIdentity, writeAttributes);
}

function fetchIdentity(contract_address, callback, params) {
  var compiled = ContractImport['Contracts.sol:Identity'];
  var contract = web3.eth.contract(compiled.abi).at(contract_address);
  contract.getDetails.call({from: address}, function(err, result) {
    if(!hasError(err))
      callback(result, params);
  });
}

function showIdentity(result, callback) {
  if(result[0] > 0){
    // Update profile box
    elem('uuid').innerHTML = uuid + ' (User ' + user_index + ')';
    elem('owner').innerHTML = result[0];
    elem('ipfshash').innerHTML = result[1] || '(none)';
    elem('recovery').innerHTML = result[2];
    elem('attributes').innerHTML = '';
    // Update attributes section
    if(result[1])
      getAttributes(result[1], callback);
    // Update recovery contacts
    if(result[2]){
      setContract('Recovery', result[2]);
      getRecoveryContacts();
    }
    if(address == result[0])
      elem('details').style.display = 'block';
    else
      showSignUpPopup();
  }
}

function setIPFSHash(hash) {
  log("Updating IPFS hash in user profile...");
  contracts.identity.setIPFSHash.sendTransaction(hash, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("IPFS hash updated successfully.");
      elem("ipfshash").innerHTML = hash || '(none)';
      getAttributes(hash, writeAttributes);
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

function getNumRecoveries(proposed_key) {
  contracts.recovery.getRecoveries.call(address, {from: address}, function(err, result) {
    if(!hasError(err) && result){
      elem("num-recoveries").textContent = result[0];
      elem("total-recoveries").textContent = result[1];
      fetchIdentity(uuid, checkRecoveryKey);
    }
  });
}

function checkRecoveryKey(result) {
  if(address === result[0]){
    showIdentity(result, writeAttributes);
    resetUrl();
    resolveModal();
  } else
    swal.hideLoading();
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
      }).catch(swal.noop);
    }
    getRecoveryContacts();
  });
}

function submitRecovery(recovery_address, key) {
  contracts.identity.addRecovery.sendTransaction(recovery_address, key, {from: address}, function(err, result) {
    if(!hasError(err)) {
      log("Recovery submitted successfully.");
      swal({
        title: "Recovery Submitted",
        type: 'success',
        text: 'Recovery submitted successfully.'
      }).catch(swal.noop);
    }
  });
}

/* USER SETUP FUNCTIONS */
function checkForUser() {
  if(localStorage.getItem('identity_address')){
    setContract('Identity', uuid);
    getIdentity();
  } else
    deployContract("Identity", registerUUID);
}

function registerUUID(contract_address) {
  uuid = contract_address;
  addAttributeFormRow('name', user_name, []);
  setAttributes(true);
  getIdentity();
}

/* POPUP FUNCTIONS */
function showRequestAttestationPopup(elem) {
  var inputs = elem.getElementsByTagName('input');
  var json = {
    type: "signature-request",
    uuid: uuid,
    key: inputs[0].value,
    value: inputs[1].value
  };
  showQRPopup('Request Signature', json, true);
}

function getQRCodeResult(result, callback) {
  var parsed, type;
  var input = decodeURIComponent(result).replace(/\+/g, ' ');

  // Parse QR code result
  try {
    parsed = JSON.parse(input);
    type = parsed.type;
  } catch(e) {}
  callback(parsed, type);
}

function performQRAction(parsed, type) {
  // Stop video stream
  if(window.localMediaStream)
    stopVideo();

  // Perform parsed action
  if(type === "signature-request"){
    swal({
      title: "Signature Request",
      html: 'User: <strong>' + parsed.uuid + '</strong><br /><br />' +
        '<div class="ui form">' +
        '<div class="inline field"><label>Attribute</label><input type="text" value="' + parsed.key + '" disabled /></div>' +
        '<div class="inline field"><label>Value</label><input type="text" value="' + parsed.value + '" disabled /></div>' +
        '</div>',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: '<i class="ui icon checkmark"></i> Sign'
    }).then(function() {
      showSigningResultPopup(parsed);
    }, function(dismiss) {
      resetUrl();
    });
  } else if(type === "attribute-request"){
     swal({
      title: "Disclosure Request",
      html: '<p>The following user is requesting attributes:</p>' +
        '<div class="ui card contact centered">' +
          '<div class="content">' +
            '<img class="left floated mini ui image" src="images/user.png" data-action="contact-card">' +
            '<div id="disclosure-user" class="header"></div>' +
            '<div class="meta overflow-ellipsis">' + parsed.uuid + '</div>' +
          '</div>' +
        '</div><br />' +
        '<p>Attributes: ' + parsed.attributes.map(function(attr) {
          return '<span class="ui label"><i class="tag icon"></i> ' + attr + '</span>';
        }).join('') + '</p>',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: '<i class="ui icon checkmark"></i> Disclose',
      showLoaderOnConfirm: true
    }).then(function() {
      var response = {};
      var elements = getElementsFromForm();
      for (var att of parsed.attributes){
        response[att] = {
          value: elements.attributes[att],
          signatures: elements.signatures[att]
        }
      }
      showQRPopup('Disclosure Result', {
        type: 'disclosure-result',
        attributes: response,
        uuid: uuid,
        signature: signAttribute(parsed.challenge)
      });
      resetUrl();
    }, function(dismiss) {
      resetUrl();
    });
    swal.showLoading();
    fetchIdentity(parsed.uuid, function(result) {
        getAttributes(result[1], updateDisclosurePopup)
    });
  } else if(type === "recovery-request"){
    swal({
      title: "Recovery Request",
      html: 'User: <strong>' + parsed.uuid + '</strong><br /><br />' +
        '<div class="ui form" id="recovery-request">' +
          '<div class="field"><label>Proposed Key</label><input type="text" value="' + parsed.key + '" disabled /></div>' +
        '</div><br /><div id="signup_log"></div>',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: '<i class="ui icon checkmark"></i> Recover',
      showLoaderOnConfirm: true,
      preConfirm: function () {
        return new Promise(function (resolve, reject) {
          user_resolve = resolve;
          submitRecovery(elem('recovery-request').dataset.recovery, parsed.key);
        })
      }
    }).then(function() {
      resetUrl();
    }, function(dismiss) {
      resetUrl();
    });
    swal.showLoading();
    fetchIdentity(parsed.uuid, updateRecoveryRequestPopup);
  } else if(type === "disclosure-result"){
     swal({
      title: "Disclosure Result",
      html: '<div class="ui card contact centered">' +
          '<div class="content">' +
            '<img class="left floated mini ui image" src="images/user.png" data-action="contact-card">' +
            '<div id="disclosure-user" class="header"></div>' +
            '<div class="meta overflow-ellipsis">' + parsed.uuid + '</div>' +
          '</div>' +
        '</div>'
    }).then(function() {
      resetUrl();
    }, function(dismiss) {
      resetUrl();
    });
    swal.showLoading();
    fetchIdentity(parsed.uuid, function(result) {
        getAttributes(result[1], updateDisclosurePopup)
    });
  } else if (type === "signature-result") {
    var attributes = elem('attributes').getElementsByClassName('attribute');
    var added = false;
    for (var att of attributes){
      var inputs = att.getElementsByTagName('input');
      if(inputs[0].value === parsed.key && inputs[1].value === parsed.value) {
        addSignatureToFormRow(parsed.key, parsed.value, {signer: parsed.signer, signature: parsed.signature}, att);
        added = true;
      }
    }
    if(added)
      setAttributes();
    else
      hasError('Error: Attribute does not exist on profile');
    resetUrl();
  } else if (type === "contact-card") {
    if(getContactElements().indexOf(parsed.uuid) > -1){
      hasError('Error: Contact already exists');
    } else {
      addContact(parsed.uuid);
      setRecoveryContacts();
    }
    resetUrl();
  } else {
    hasError("Error: Invalid QR code: <br />" + input);
  }
}

function updateDisclosurePopup(data) {
  swal.hideLoading();
  elem('disclosure-user').textContent = data.attributes.name;
}

function updateRecoveryRequestPopup(result) {
  swal.hideLoading();
  elem('recovery-request').dataset.recovery = result[2];
}

function receiveRecoveryScan(parsed, type) {
  if(type === "contact-card" && parsed.uuid){
    swal.getInput().value = parsed.uuid;
    swal.clickConfirm();
  } else {
    swal.showValidationError("Error: Invalid QR code");
    setTimeout(function(){ swal.resetValidationError() }, 2000);
  }
}

function showRecoveryPopup() {
  swal.queue([{
    title: 'Select an Account',
    input: 'text',
    html: '<div id="recovery-info"><p>To recover your account, scan your contact card from a friends device or enter your UUID manually.' +
    '</p><a id="recovery-scanner" class="ui button">Open Scanner</a>' +
    '<br /><br />or' +
    '</div>',
    inputValidator: function(input) {
      return new Promise(function(resolve, reject) {
        if (input === "" || !ethUtils.isValidAddress(input))
          reject("Please enter a valid UUID.");
        if (window.localMediaStream)
          stopVideo();
        resolve();
      })
    },
    preConfirm: function (input) {
      return new Promise(function (resolve, reject) {
        user_resolve = resolve;
        uuid = swal.getInput().value;
        fetchIdentity(uuid, showIdentity, function(data) {
          writeAttributes(data);
          updateRecoverAccountPopup();
        });
      })
    },
    customClass: 'recovery-modal',
    inputPlaceholder: 'Enter your UUID...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    showLoaderOnConfirm: true,
    confirmButtonText: 'Next &rarr;',
    progressSteps: ['1', '2', '3'],
    onOpen: function () {
      if(isMobile())
        elem('recovery-scanner').href = "zxing://scan/?ret=" +
          encodeURIComponent(location.protocol + '//' + location.host
          + location.pathname + "?code={CODE}&recovery");
      else
        elem('recovery-scanner').addEventListener('click', function(event) {
          elem('recovery-info').innerHTML = desktopQRElement();
          startVideo(receiveRecoveryScan);
        });
    }
  }]).then(function (result) {
    setContract('Identity', uuid);
    elem('details').style.display = "block";
    swal({
      title: 'Recovery Complete',
      type: 'success',
      text: 'Your account was recovered successfully.'
    }).catch(swal.noop);
  }, function (dismiss) {
    if(window.localMediaStream)
      stopVideo();
    showSignUpPopup();
  });
}

function updateRecoverAccountPopup() {
  resolveModal();
  swal.insertQueueStep({
    title: 'Confirm Details',
    html: '<p>Make sure the details below look correct.</p>' +
      '<div class="ui card contact grid container">' +
        '<div class="content">' +
          '<img class="left floated mini ui image" src="images/user.png" data-action="contact-card">' +
          '<div class="header">' + elem('name').textContent + '</div>' +
          '<div class="meta overflow-ellipsis">' + uuid + '</div>' +
        '</div>' +
      '</div>',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    customClass: 'recovery-modal',
    confirmButtonText: 'Next &rarr;',
    progressSteps: ['1', '2', '3']
  });
  swal.insertQueueStep({
    title: 'Request Recovery',
    html: '<p>Ask you contacts to scan the code below.</p>' +
      getQRFromJson({
        type: 'recovery-request',
        uuid: uuid,
        key: address
      }) + '<br /><span id="num-recoveries"></span> / <span id="total-recoveries"></span> recoveries',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    showLoaderOnConfirm: true,
    confirmButtonText: '<i class="ui icon refresh"></i> Refresh',
    progressSteps: ['1', '2', '3'],
    preConfirm: function (input) {
      return new Promise(function (resolve, reject) {
        user_resolve = resolve;
        getNumRecoveries();
      })
    },
    onOpen: function () {
      swal.clickConfirm();
    }
  });
}

function showSignUpPopup() {
  swal({
    title: "Create an account",
    input: 'text',
    customClass: 'signup-modal',
    html: '<div id="signup_log"><br />' +
    '<button class="ui button" data-action="recover-account">Recover Account</button>' +
    '<br /><br />or' +
    '</div>',
    inputPlaceholder: 'Enter your name...',
    confirmButtonText: 'Sign Up',
    showLoaderOnConfirm: true,
    allowEscapeKey: false,
    allowOutsideClick: false,
    inputValidator: function(input) {
      return new Promise(function(resolve, reject) {
        if (input === "")
          reject("Please enter a valid name.");
        resolve();
      })
    },
    preConfirm: function (input) {
      return new Promise(function (resolve, reject) {
        if(!input) reject();
        user_name = input;
        user_resolve = resolve;
        checkForUser();
      })
    }
  });
}

function showSigningResultPopup(input) {
  delete input.type;
  input.signer = uuid;
  var signature = signAttribute(JSON.stringify(input));
  var result = {
    type: 'signature-result', signer: uuid,
    key: input.key, value: input.value,
    signature: signature
  };
  showQRPopup('Signature Result', result);
}

function showContactPopup(title, contact_uuid) {
  swal({
    title: title,
    html:
      '<img src="http://chart.apis.google.com/chart?cht=qr&chs=350x350&chl=' + encodeURIComponent(
        JSON.stringify({type: 'contact-card', uuid: contact_uuid})
      ) + '" style="width: 300px; height: 300px" />',
    showCloseButton: true
  }).catch(swal.noop);
}

function showAttributeRequestPopup() {
  swal({
    title: 'Request Attributes',
    html: '<p>Select some attributes below to create a request.</p>' +
      '<div id="attribute-requests" class="ui form"></div>' +
      '<br /><a id="add-attr-request" class="ui positive mini basic button" ' +
      'data-action="add-request">Add Attribute</a>',
    showCancelButton: true,
    confirmButtonText: 'Create',
    onOpen: function() {
      elem('add-attr-request').click();
    }
  }).then(function() {
    var inputs = elem('attribute-requests').getElementsByClassName('attribute');
    var attributes = [].slice.call(inputs).map(function(elem) {
      return elem.value;
    });
    showQRPopup('Request Attributes', {
      type: 'attribute-request',
      attributes: attributes,
      uuid: uuid,
      challenge: uuid_gen.v4()
    }, true);
  }).catch(swal.noop);
}

function showQRPopup(title, json, show_scanner) {
  swal({
    title: title,
    html: getQRFromJson(json) + '<br />' +
      '<div class="ui form"><div class="field"><textarea rows="8">' +
      JSON.stringify(json, null, 2) +
      '</textarea></div></div>',
    showCancelButton: show_scanner,
    confirmButtonText: show_scanner ? 'Open Scanner' : 'Ok'
  }).then(function() {
    if(show_scanner)
      elem('scanner').click();
    resetUrl();
  }).catch(swal.noop);
}

function showDesktopQRPopup(callback) {
  swal({
    title: 'Scanner',
    html: desktopQRElement(),
    showCloseButton: true
  }).then(
    function () {
      stopVideo();
    },
    function (dismiss) {
      stopVideo();
    }
  );
  startVideo(callback);
}

function startVideo(callback) {
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({video: true}).then(function(stream) {
      successCallback(stream, callback);
    }).catch(function(err) {});
  } else {
    hasError("Error: Webcam not supported");
  }
}

function successCallback(stream, callback) {
  var video = elem('desktop-scanner');
  var canvas = elem('qr-canvas');
  video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
  video.play();
  window.localMediaStream = stream;
  canvas.width = video.offsetWidth;
  canvas.height = video.offsetHeight;
  stopScan = setInterval(function(){ scan(callback); }, 200);
}

function scan(callback) {
  if (window.localMediaStream) {
    var canvas = elem('qr-canvas');
    var video = elem('desktop-scanner');
    canvas.getContext('2d').drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
    try {
      var result = qrcode().decode(canvas);
      getQRCodeResult(result, callback);
    } catch(e) {
      // QR parsing error
    }
  }
}

function stopVideo() {
  clearInterval(stopScan);
  window.localMediaStream.getVideoTracks()[0].stop();
  window.localMediaStream = null;
}


/* ATTRIBUTE SETTING FUNCTIONS */
function setAttributes(is_signup) {
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
      if(is_signup){
        resolveModal();
      }
      else
        swal({
          title: "Attributes Saved",
          type: 'success',
          text: 'Attributes saved successfully.'
        }).catch(swal.noop);
    }
  });
}

function getAttributes(hash, callback) {
  ipfs.files.cat(hash, function (err, stream) {
    if(!hasError(err)) {
      var file = '';
      stream.on('data', function(buffer){
        file += buffer.toString();
      });
      stream.on('end', function(){
        // Update attributes form
        var data = JSON.parse(file.toString());
        // Check for incoming code
        if(!swal.isVisible()){
          var code = getUrlParameter('code');
          var recovery = getUrlParameter('recovery');
          if (code && !recovery)
            getQRCodeResult(code, performQRAction);
        }
        // Check for callback
        if (callback) callback(data);
      });
    }
  });
}

function writeAttributes(data){
  elem('attributes').innerHTML = '';
  for (var att in data.attributes){
    if (data.attributes.hasOwnProperty(att)){
      if(att === "name") {
        user_name = data.attributes[att];
        elem('name').innerHTML = data.attributes[att];
      }
      addAttributeFormRow(att, data.attributes[att], data.signatures[att]);
    }
  }
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

function setVerified(element, result) {
  var textresult = result ? 'Verified' : 'Unverified';
  element.className = textresult.toLowerCase();
  element.innerHTML = textresult;
}


/* ATTRIBUTE ELEMENT FUNCTIONS */
function addAttributeFormRow(key, value, signatures, empty){
  var container = elem('attributes');
  var attribute = document.createElement('div');
  attribute.className = 'card attribute';
  attribute.innerHTML =
    '<div class="content">' +
      '<i class="right floated delete icon red link" data-action="delete"></i>' +
      '<div class="inline field"><input type="text" value="' + key + '"'
        + (key === "name" ? 'disabled' : '') +'></div>' +
      '<div class="description field"><input type="text" value="' + value + '"></div>' +
      '<div class="signatures verified"></div>' +
    '</div>' +
    '<div class="extra content">' +
      '<span class="left floated lh-two"><span class="num-attestations">0</span> Attestations</span>' +
      '<span class="right floated"><button class="ui button primary mini" data-action="sign" ' +
      (empty ? 'disabled' : '') + '>Request Signature</button></span>' +
    '</div>';

  // Add signatures
  for (var sig of signatures)
    addSignatureToFormRow(key, value, sig, attribute);

  // Append to attribute container
  container.appendChild(attribute);
}

function addSignatureToFormRow(key, value, sig, attribute) {
  // Show element
  var element = document.createElement('div');
  element.className = 'signature overflow-ellipsis';
  element.dataset.signer = sig.signer;
  element.dataset.signature = sig.signature;
  element.dataset.key = key;
  element.dataset.value = value;
  element.title = sig.signer;
  element.innerHTML = '<i class="ui icon checkmark"></i> Signed by ' + sig.signer;
  attribute.getElementsByClassName('signatures')[0].appendChild(element);
  // Add to counter
  var counter = attribute.getElementsByClassName('num-attestations')[0];
  counter.innerHTML = parseInt(counter.innerHTML) + 1;
  // Get name of signer
  fetchIdentity(sig.signer, function(result) {
    getAttributes(result[1], function(data) {
      element.innerHTML = '<i class="ui icon checkmark"></i> Signed by ' + data.attributes.name;
    });
  });
}

function getElementsFromForm() {
  var attributes = {};
  var signatures = {};
  var elements = elem('attributes').getElementsByClassName('attribute');
  for (var att of elements){
    var inputs = att.getElementsByTagName('input');
    attributes[inputs[0].value] = inputs[1].value;
    var sig_elements = att.getElementsByClassName('signature');
    signatures[inputs[0].value] = [];
    for (var sig of sig_elements)
      if(inputs[0].value == sig.dataset.key &&
        inputs[1].value == sig.dataset.value)
          signatures[inputs[0].value].push({
            signer: sig.dataset.signer,
            signature: sig.dataset.signature
          });
  }
  return {
    attributes: attributes,
    signatures: signatures
  };
}

/* CONTRACT FUNCTIONS */
function setContract(contract_name, contract_address) {
  var compiled_contract = ContractImport['Contracts.sol:' + contract_name];
  var contract_obj = web3.eth.contract(compiled_contract.abi);
  contracts[contract_name.toLowerCase()] = contract_obj.at(contract_address);
  localStorage.setItem(contract_name.toLowerCase() + '_address', contract_address);
}

function deployContract(contract_name, callback) {
  log("Deploying " + contract_name + " contract...");
  var compiled_contract = ContractImport['Contracts.sol:' + contract_name];
  var contract_obj = web3.eth.contract(compiled_contract.abi);

  // Get gas estimation
  web3.eth.estimateGas({data: compiled_contract.bytecode}, function(err, gasEstimate) {
    log(contract_name + " contract gas estimate: " + gasEstimate);
    // Deploy contract
    if(!hasError(err))
      contracts[contract_name.toLowerCase()] = contract_obj.new(
        {from: address, data: compiled_contract.bytecode, gas: gasEstimate},
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
  // Create contact element
  var contact = document.createElement('div');
  contact.className = 'card contact';
  contact.dataset.uuid = addr;
  contact.innerHTML = '<div class="content">' +
    '<i class="right floated delete icon red link" data-action="delete"></i>' +
    '<img class="left floated mini ui image" src="images/user.png" data-action="contact-card">' +
    '<div class="header">' + 'Contact' + '</div>' +
    '<div class="meta overflow-ellipsis">' + addr + '</div>' +
  '</div>';
  elem('contacts').appendChild(contact);

  // Get name of contact
  var name = contact.getElementsByClassName('header')[0];
  fetchIdentity(addr, function(result) {
    getAttributes(result[1], function(data) {
      name.textContent = data.attributes.name;
    });
  });
}

function getContactElements() {
  var contacts = elem('contacts').getElementsByClassName('contact');
  var contacts_arr = [].slice.call(contacts);
  return contacts_arr.map(function(elem) { return elem.dataset.uuid; });
}


/* HELPER FUNCTIONS */
function log(msg) {
  var logger = elem("logger");
  logger.innerHTML += '<br />' + (msg.toString().match(/error/i) ? '<span class="err">' + msg + '</span>' : msg);
  logger.scrollTop = logger.scrollHeight;
  if(elem("signup_log"))
    elem("signup_log").innerHTML = msg;
}

function hasError(err) {
  if(err){
    log(err);
    console.log(err);
    swal({
      title: "Operation Failed",
      type: 'error',
      html: 'There was a problem performing that action: <br /><br />' +
        '<span class="log-text">' + err + '</span>'
    }).catch(swal.noop);
  }
  return err;
}

function elem(id){
  return document.getElementById(id);
}

function resolveModal() {
  user_resolve();
  user_resolve = null;
}

function resetUrl() {
  window.history.pushState({} , '', window.location.origin);
}

function getQRFromJson(json) {
  return '<img src="http://chart.apis.google.com/chart?cht=qr&chs=250x250&chl=' +
    encodeURIComponent(JSON.stringify(json)) + '">';
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

function isMobile() {
  return ('ontouchstart' in window || 'onmsgesturechange' in window) && window.screenX === 0;
}

function desktopQRElement() {
  return '<video id="desktop-scanner" style="width: 460px;height: 345px;"></video><br />' +
    '<canvas id="qr-canvas" style="display: none"></canvas>';
}

function getRandomId() {
  return Math.floor(Math.random() * NUM_ACCOUNTS) + 1;
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
  elem('logger').innerHTML = "Ethereum Identity 1.0";

  // Check for mobile device http://stackoverflow.com/a/14283643
  if(isMobile())
    elem('scanner').href = "zxing://scan/?ret=" +
      encodeURIComponent(location.protocol + '//' + location.host
      + location.pathname + "?code={CODE}"
    );
  else
    elem('scanner').addEventListener('click', function(event) {
      showDesktopQRPopup(performQRAction);
    });

  // Set sweetalert defaults
  swal.setDefaults({
    reverseButtons: true
  });

  // Generate Wallet
  uuid = localStorage.getItem('identity_address');
  user_index = localStorage.getItem('user_index') || getRandomId().toString();
  mnemonic = localStorage.getItem('mnemonic') || DEFAULT_MNEMONIC || generateMnemonic();
  wallet = generateWallet(mnemonic, user_index);
  address = "0x" + wallet.getAddress().toString("hex");


  // Log results
  log("User Address: " + address);
  log("Mnemonic: " + mnemonic);
  log("Logging in as User " + user_index);

  // Supports Metamask and Mist, and other wallets that provide 'web3'
  // http://truffleframework.com/tutorials/bundling-with-webpack
  if (typeof window.web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    var provider = new HDWalletProvider(mnemonic, PROVIDER, user_index);
    window.web3 = new Web3(provider);
  }
  log("Web3 Provider: " + web3.currentProvider.constructor.name);

  // Get address balance
  web3.eth.getBalance(address, function(err, result){
    if(!hasError(err)) {
      elem('balance').innerHTML = web3.fromWei(result, 'ether') + ' ether';
    }
  });

  // Login to wallet
  if(uuid && localStorage.getItem('user_index')){
    checkForUser();
  } else {
    localStorage.setItem('user_index', user_index);
    if (getUrlParameter('recovery')){
      showRecoveryPopup();
      getQRCodeResult(getUrlParameter('code'), receiveRecoveryScan);
    } else
      showSignUpPopup();
  }

  // Add button event listeners
  elem('setAttributes').addEventListener('click', function(event) {
    setAttributes();
  });
  elem('send-request').addEventListener('click', function(event) {
    showAttributeRequestPopup();
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
          setRecoveryContacts();
      }).catch(swal.noop);
    else if(event.target.dataset.action == 'contact-card')
      showContactPopup(event.target.nextSibling.innerHTML, contact.dataset.uuid);
  });
  elem('menu').addEventListener('click', function(event) {
    var prev = elem('menu').getElementsByClassName('active')[0];
    var logger = elem('logger');
    if(event.target.tagName == 'A' && prev !== event.target){
      prev.className = 'item';
      logger.scrollTop = logger.scrollHeight;
      event.target.className = 'active item';
      show_hide(event.target.dataset.tab, prev.dataset.tab);
    }
  });
  elem('addAttributeFormRow').addEventListener('click', function(event) {
    addAttributeFormRow('', '', [], true);
  });
  elem('qrcode').addEventListener('click', function(event) {
    showContactPopup(user_name, uuid);
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
      }).catch(swal.noop);
  });
  elem('attributes').addEventListener('input', function(event) {
    var container = event.target.parentElement.parentElement;
    var signatures = container.getElementsByClassName('signature');
    var inputs = container.getElementsByTagName('input');
    for (var sig of signatures){
      if(!container.dataset.allowchange &&
        (inputs[0].value != sig.dataset.key || inputs[1].value != sig.dataset.value)){
        swal({
          title: 'Confirm Change',
          type: 'info',
          text: signatures.length + ' signature' + (signatures.length > 1 ? 's' : '') +
          ' will be removed if the attribute is changed. Are you sure you want to continue?',
          showCancelButton: true,
          confirmButtonText: 'Confirm'
        }).then(function() {
          container.dataset.allowchange = true;
          container.getElementsByClassName('signatures')[0].innerHTML = '';
          container.parentElement.getElementsByClassName('num-attestations')[0].textContent = 0;
          container.parentElement.getElementsByTagName('button')[0].disabled = true;
        }, function(dismiss) {
          event.preventDefault();
          event.stopPropagation();
        });
      }
    }
  });
  document.addEventListener('click', function(event) {
    if(event.target.dataset.action === 'recover-account')
      showRecoveryPopup();
    else if (event.target.dataset.action === 'add-request'){
      var attribute = document.createElement('div');
      attribute.className = 'inline field';
      attribute.innerHTML ='<input type="text" class="attribute" placeholder="Attribute" />' +
        '<i class="right floated delete icon red link" data-action="delete-attr-request"></i>';
      elem('attribute-requests').appendChild(attribute);
    }
    else if (event.target.dataset.action === 'delete-attr-request'){
      var element = event.target.parentElement;
      element.parentElement.removeChild(element);
    }
  });
});
