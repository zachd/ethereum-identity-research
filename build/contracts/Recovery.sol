pragma solidity ^0.4.2;

contract Recovery {

    address id;
    address[] contacts;

    function Recovery(address _id, address[] _contacts) {
        id = _id;
        contacts = _contacts;
    }
    
}