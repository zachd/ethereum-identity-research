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
        recovery = new Recovery(this);
    }

    function setRecovery(address _recovery) onlyOwner {
        recovery = _recovery;
    }

    function setIPFSHash(string _ipfs_hash) onlyOwner {
        ipfs_hash = _ipfs_hash;
    }

    function setContacts(address[] _contacts) onlyOwner {
        Recovery recovery_c = Recovery(recovery);
        recovery_c.setContacts(_contacts);
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