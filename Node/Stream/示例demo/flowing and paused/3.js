var fs = require("fs"),
    rs = fs.createReadStream("../../music.mp3");

rs.resume();  // 转换为flowing模式 

rs.on("end", function (err) {
    console.log("rs end");
});