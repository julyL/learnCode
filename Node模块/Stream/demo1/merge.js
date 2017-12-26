var fs = require("fs"),
  rs1 = fs.createReadStream("./1.mp3"),
  rs2 = fs.createReadStream("./2.mp3"),
  ws = fs.createWriteStream("./merge.mp3"),
  stat1 = fs.statSync("./1.mp3"),     //statSync可以获取文件的信息,stat1.size表示文件大小
  stat2 = fs.statSync("./2.mp3"),
  end1,
  end2,
  pause1,
  pause2,
  data1 = "", // data1.length表示什么?
  data2 = "",
  chunk = "";
console.log('1.mp3 size: ',stat1.size);
rs1.on("data", function(chunk) {
  // 第一个参数竟然不是err
  data1 += chunk;
  if (ws.write(chunk) === false) {
    // ws.write(chunk)为false表示ReadStream还没有读取完毕，
    rs1.pause(); // 这时需要停止WriteStream继续写入, 否则内存会爆仓
    pause1 = true;
  }
});

rs2.on("data", function(chunk) {
  data2 += chunk;
  if (ws.write(chunk) === false) {
    pause2 = true;
    rs2.pause();
  }
});

ws.on("drain", function() {
  // WriteStream写入完毕之后, 执行ReadStream的resume方法开始继续写入数据
  if (pause1) {
    rs1.resume();
    pause1 = false;
  }
  if (pause2) {
    rs2.resume();
    pause1 = false;
  }
});

rs1.on("end", function(err) {
  console.log("rs1 end, data1:", data1.length);
  end1 = true;
  if (end2) {
    ws.end(); // ReadStream执行end事件的时候, WriteSteam 就可以执行end了? 会不会存在WriteSteam没有读取完毕的情况
  }
});

rs2.on("end", function(err) {
  console.log("rs2 end");
  end2 = true;
  if (end1) {
    ws.end();
  }
});
