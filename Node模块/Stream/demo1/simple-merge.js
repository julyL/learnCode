var fs = require("fs"),
  rs1 = fs.createReadStream("./1.mp3"),
  rs2 = fs.createReadStream("./2.mp3"),
  ws = fs.createWriteStream("./simple-merge.mp3");

// 下面这么写,合并的数据会丢失
rs1.pipe(ws);
rs2.pipe(ws);
