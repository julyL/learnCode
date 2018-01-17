var counter = { a: 1 };
function incCounter() {
  counter.a++;
}
module.exports = {
  counter: counter,
  incCounter: incCounter
};
