var fs = require("fs"),
  rs = fs.createReadStream("../../music.mp3"),
  ws=fs.createWriteStream("../../copy.mp3");

rs.pipe(ws);
rs.unpipe(ws);   // rs._readableState.flowing = false

rs.on("data", function(chunk) {
  // 不会转换为flowing模式
  console.log(chunk);
});

setTimeout(() => {
  console.log("3s later, excute rs.resume");
  rs.resume();
}, 3000)
;
rs.on("end", function(err) {
  console.log("rs end");
});
