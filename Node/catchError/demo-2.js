const fs = require('fs');

function readJSON(filename, callback) {
    fs.readFile(filename, 'utf8', (err, data) => {
        let parsed;
        if (err) {
            // 如果有错误产生则退出当前调用
            return callback(err);
        }
        // 没有错误，调用回调
        callback(null, JSON.parse(data));
    });
};

try {
    readJSON("./data.json", (err, data) => {
        console.log(err, data);
    });
} catch (err) {
    console.log('not catch');
}

console.log("log: 0");
setTimeout(() => {
  console.log("log: 1");
}, 1000);

process.on("uncaughtException", err => {
    console.log("[uncaughtException]:\n",err);
    process.exit(1);
});