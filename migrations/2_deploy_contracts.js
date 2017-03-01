module.exports = function(deployer) {
  deployer.deploy(Identity);
  deployer.autolink();
};
