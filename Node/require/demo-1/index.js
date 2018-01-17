debugger;
const a = require("./a");
debugger;
const b = require("./b");
console.log(a);
console.log(b);


// load a.js
// load b.js
// {bWasLoaded: true, loaded: true}
// {aWasLoaded: false, loaded: true}

/*
(在vscode下按F5调试index.js)
先加载a.js, 当a.js代码执行到require('./b')时,再去加载b.js
当前b.js代码执行到require('/a')时,并没有再去执行a.js,而是直接返回了{loaded: false}(只返回了执行require('./b')之前的不完整的a.js)
*/