pragma solidity ^0.4.2;

contract Identity {

    struct Ident {
    	uint id;
        string name;
    }

    uint identCount = 0;

    mapping(address => Ident) idents;

    function Identity() {
        newIdent("Test User");
    }

    function getIdentCount() returns(uint) {
        return identCount;
    }

    function newIdent(string name) returns(bool) {
    	if(idents[msg.sender].id > 0) throw;
        identCount += 1;
        idents[msg.sender] = Ident(identCount, name);
    }

    function getIdent(address owner) returns(uint id, string name) {
        id = idents[owner].id;
        name = idents[owner].name;
    }
}