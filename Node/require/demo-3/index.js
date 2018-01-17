var counter = require("./a").counter;
var incCounter = require("./a").incCounter;

console.log(counter); // {a:1}
incCounter();
console.log(counter); // {a:2}
console.log(require("./a").counter); // {a:2}

