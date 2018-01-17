var counter = require("./a").counter;
var incCounter = require("./a").incCounter;

console.log(counter); // 1
incCounter();
console.log(counter); // 1
console.log(require("./a").counter); // 1

