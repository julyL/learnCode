debugger;
console.log("load b.js");
exports.loaded = false;
const a = require("./a");
debugger;
module.exports = {
  aWasLoaded: a.loaded,
  loaded: true
};
