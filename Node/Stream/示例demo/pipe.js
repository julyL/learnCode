// pipe方法内部原理大致如下

var fs = require("fs"),
  rs = fs.createReadStream("../music.mp3"),
  ws = fs.createWriteStream("./1.mp3"),
  data,
  chunk = "";

rs.on("data", function (chunk) {
  data += chunk;
  if (ws.write(chunk) === false) {
    console.log('rs pause');
    rs.pause();
  }
});

ws.on("drain", function () {
  console.log("rs resume");
  rs.resume();
})

rs.on("end", function (err) {
  ws.end();
});