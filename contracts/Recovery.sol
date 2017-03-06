pragma solidity ^0.4.2;

contract Recovery {

    address uuid;
    address[] contacts;

    function Recovery(address _uuid, address[] _contacts) {
        uuid = _uuid;
        contacts = _contacts;
    }

    function getDetails() returns (address[] _contacts) {
        _contacts = contacts;
    }

}