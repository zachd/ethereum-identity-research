pragma solidity ^0.4.2;

contract Registry {

    mapping(address => address) users;

    function add(address key, address uuid) {
        users[key] = uuid;
    }

    function get(address key) returns (address) {
        return users[key];
    }

    function update(address prev, address current) {
        if(users[prev] == msg.sender){
            delete users[prev];
            users[current] = msg.sender;
        }
    }
}
