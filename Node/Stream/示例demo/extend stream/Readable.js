const {
  Readable
} = require("stream");
class createNumber extends Readable {
  constructor(createData, options) {
    super(options);
    this.createData = createData;
  }
  _read() {
    var data = this.createData();
    this.push(data);
  }
}
var i = 0;
var stream = new createNumber(() => {
  return ++i < 10000 ? String(i) : null
});

stream.on("data", function (data) {
  console.log("data:", data.toString());
});