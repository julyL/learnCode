const pLimit = require("p-limit");

async function delay(timeout) {
  console.log("delay pending ", timeout);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
      console.log("delay resolve ", timeout);
    }, timeout);
  });
}

const limit = pLimit(1);

const input = [
  limit(() => delay(1000)),
  limit(() => delay(2000)),
  limit(() => delay(1000))
];

Promise.all(input).then(res => {
  console.log("resolve all");
});
