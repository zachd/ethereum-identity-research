pragma solidity ^0.4.2;

contract Identity {

    address owner;
    string ipfs_hash;
    address recovery;

    modifier onlyOwner(){ 
        if (msg.sender == owner) 
            _; 
    }

    function Identity() {
        owner = msg.sender;
    }

    function setRecovery(address _recovery) onlyOwner {
        recovery = _recovery;
    }

    function setIPFSHash(string _ipfs_hash) onlyOwner {
        ipfs_hash = _ipfs_hash;
    }

    function transferOwner(address _owner) onlyOwner {
        owner = _owner;
    }

    function getDetails() returns (address _owner, string _ipfs_hash, address _recovery) {
        _owner = owner;
        _ipfs_hash = ipfs_hash;
        _recovery = recovery;
    }

}