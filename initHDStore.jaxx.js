
EthereumWallet.prototype.initHDStore = function(checkForEthereumIssue) {
    console.log("[ EthereumWallet Legacy :: Init HD Store ]");
    
    var secretSeed = getStoredData('mnemonic',true); //Get mnemonic from localstorage

    var password = 'password'; //set a fixed password to encrypt the HD keystore
    
    w_Obj._lightwallet.keystore.deriveKeyFromPassword(password, function(err, pwDerivedKey) {
        if (err) {
            console.log("error :: " + err);
        } else {
//            var hdPath = "m/44'/60'/0'"; //as defined in SLIP44    
            
            

            w_Obj._keystore = new w_Obj._lightwallet.keystore(secretSeed, pwDerivedKey); //initiat e a new HD keystore

            //Generate a new address following standard HD derivation path

            var hdPath = "m/44'/60'/0'"; //as defined in SLIP44    

            w_Obj._keystore.addHdDerivationPath(hdPath, pwDerivedKey, {curve: 'secp256k1', purpose: 'sign'});

            //--------------------Test validity of ETH creation mechanism. @TODO Remove after we nail this issue down
            var ethGenTestPass = "false"; //default to false
            if(PlatformUtils.mobileAndroidCheck() && checkForEthereumIssue === true) { 

                var testMnemonicString = "film jaguar grow betray sense offer motor wisdom prefer blur beach cave";
                var testAddress = "0x05ab0947bf134ca2979fd4e679ec601b5d3c8efd";
                _keystore_test = new w_Obj._lightwallet.keystore(testMnemonicString, pwDerivedKey); //initiat e a new HD keystore
                _keystore_test.addHdDerivationPath(hdPath, pwDerivedKey, {curve: 'secp256k1', purpose: 'sign'});
                _keystore_test.generateNewAddress(pwDerivedKey, 1, hdPath);  //Generate a new address
                var generatedAddr = '0x'+ _keystore_test.getAddresses(hdPath)[0];
                if(generatedAddr==testAddress){
                   ethGenTestPass = "true";
                }
            }
            else {
                ethGenTestPass = "true"; //Assume that on non-android device generation is ok
            }
            
            //-------END test
            storeData('ethereum_generationPassed_' + w_Obj._storageKey, ethGenTestPass,false);

//          ethGenTestPass = false;
            
//           if(ethGenTestPass){
                w_Obj._keystore.generateNewAddress(pwDerivedKey, 1, hdPath);  //Generate a new address

                //Get private key
                var incompleteAddress = w_Obj._keystore.getAddresses(hdPath)[0];
                w_Obj._keystore.setDefaultHdDerivationPath(hdPath); //Set default HD path
                var hexSeedETH = w_Obj._keystore.exportPrivateKey(incompleteAddress, pwDerivedKey);

    //            var computedAddress = w_Obj._lightwallet.keystore._computeAddressFromPrivKey(hexSeedETH);
                
    //            console.log("computed address :: " + computedAddress);
    //            console.log("hexSeedETH :: " + hexSeedETH + " :: " + hexSeedETH.length);

                if (hexSeedETH.length < 64) {
    //                console.log("padding needed");
                    hexSeedETH = pad(hexSeedETH, 64);
                }

    //            console.log("hexSeedETH :: " + hexSeedETH + " :: " + hexSeedETH.length);

            w_Obj._private = new thirdparty.Buffer.Buffer(hexSeedETH, 'hex');
                w_Obj._address = '0x' + incompleteAddress; //Add 0x to indicate hex

                storeData('ethereum_cachedPrivateFromStorage_' + w_Obj._storageKey, hexSeedETH,true);
                storeData('ethereum_cachedAddressFromStorage_' + w_Obj._storageKey, w_Obj._address,true);


                //    console.log("@removeLog :: ethereum :: _private ::" + w_Obj._private);
                //    console.log("@removeLog :: ethereum :: _address ::" + w_Obj._address);

                //    }

                //    console.log("compare B :: " + (w_Obj === this));
                w_Obj.initializeAfterLoad();
//            }
//            else {
//                g_JaxxApp.getUI().hideEthereumMode();
//                g_JaxxApp.getUI().showEthereumTestFailedModal();
//            }
        }
    });
}