module.exports = function(deployer) {
  deployer.deploy(Registry);
  deployer.autolink();
};
