const {
    Writable
} = require("stream");
class myWritable extends Writable {
  constructor(options) {
    super(options);
  }
  _write(data, encode, cb) {
    this.write("...");
  }
}

