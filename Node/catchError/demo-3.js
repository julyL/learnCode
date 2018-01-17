const fs = require("fs");

function readJSON(filename, callback) {
  fs.readFile(filename, 'utf8', (err, data) => {
    let parsed;
    if (err)
      return callback(err);
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      return callback(err);
    }
    // 没有错误，调用回调
    callback(null, parsed);
  });
};

try {
  readJSON("./data.json", (err, data) => {
    console.log(err, data);
  });
} catch (err) {
  console.log("the JSON parsing exception");
}

console.log("log: 0");
setTimeout(() => {
  console.log("log: 1");
}, 1000);
