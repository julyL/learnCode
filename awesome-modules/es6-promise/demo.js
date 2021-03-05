const Promise = require('./es6-promise');

new Promise(resolve => {
    console.log(1);
    resolve(5);
}).then(num => {
    console.log(num)
});
console.log(3)


// new Promise(resolve => {
//     console.log(1);
//     resolve(5);
//     new Promise(resolve=>{
//         resolve(4);
//         console.log(2);
//     }).then((num)=> console.log(num))
// }).then(num => {
//     console.log(num)
// });
// console.log(3)
// 1 2 3 4 5


// new Promise((resolve,reject) => {
//     console.log(1);
//     reject(5);
//     new Promise((resolve,reject)=>{
//         reject(4);
//         console.log(2);
//     }).catch((num)=> console.log(num))
// }).catch(num => {
//     console.log(num)
// });
// console.log(3)