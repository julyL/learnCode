var fs = require("fs"),
    rs = fs.createReadStream("../../music.mp3");

rs.on("data", function (chunk) {
    // rs._readableState.flowing = null时,绑定data会转换为flowing模式
    console.log(chunk);
});


rs.on("end", function (err) {
    console.log("rs end");
});