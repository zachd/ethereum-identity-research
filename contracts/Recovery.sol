pragma solidity ^0.4.2;

contract Recovery {

    address uuid;
    address[] contacts;

    modifier onlyUuid(){
        if (msg.sender == uuid)
            _;
    }

    function Recovery(address _uuid) {
        uuid = _uuid;
    }

    function setContacts(address[] _contacts) onlyUuid {
        contacts = _contacts;
    }

    function getContacts() returns (address[] _contacts) {
        _contacts = contacts;
    }
}