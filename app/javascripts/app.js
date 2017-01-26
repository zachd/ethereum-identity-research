var accounts;
var account;
var contract;

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

function getIdent() {
  contract.getIdent.call(account, {from: account}).then(function(resp) {
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


window.onload = function() {
  contract = Identity.deployed();
  web3.eth.getAccounts(function(err, accounts) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accounts.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    var accountID = getUrlParameter('acc') || localStorage.getItem('account') || getRandomId();
    account = accounts[accountID];
    localStorage.setItem('account', accountID);
    document.getElementById('accountID').innerHTML = accountID;
    document.getElementById('address').innerHTML = account;

    getIdent();
  });
}
