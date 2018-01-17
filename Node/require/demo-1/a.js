debugger;
console.log('load a.js');
exports.loaded = false;
const b = require("./b");
debugger;
module.exports = {
  bWasLoaded: b.loaded,
  loaded: true
};
