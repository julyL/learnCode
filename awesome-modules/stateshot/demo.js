// import { History } from './lib/index'
const { History } = require('./lib/history');

// const state = { a: 1, b: 2 }
// const history = new History()
// history.pushSync(state) // the terser `history.push` API is async
// state.a = 2 // mutation!
// history.pushSync(state)
// history.get() // { a: 2, b: 2 }
// history.undo().get() // { a: 1, b: 2 }
// console.log(history.redo().get())

const history = new History()
const state = { a: 1, b: 2 }
history.pushSync({ ...state })
history.pushSync({ ...state, ...{ a: 2 } })
history.pushSync({ ...state, ...{ a: 3 } });
history.undo();
history.undo();
let r1 = history.get();    // { a: 1, b: 2, children: undefined }
history.pushSync({ ...state, ...{ c: 1 } });
let r2 = history.get();
let r3 = history.length;   // 3
history.undo();
let r4 = history.get();    // { a: 1, b: 2, children: undefined }


/*
存在的几点问题
1. 默认的defaultRule会使得get方法返回值中带有childrend字段
2. history.length值应该是this.$records.filter(record => record).length,r3应该为2
*/