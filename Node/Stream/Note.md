
ReadStream可读流 简写 rs,
WriteStream可读流 简写 ws,

#### Stream的暂停模式和流动模式

_readableState.flow 有三个状态,分别是：
_readableState.flow = null,暂时没有消费者过来
_readableState.flow = false,主动触发了 .pause()
_readableState.flow = true,流动模式

rs默认是暂停模式,并且readable._readableState.flowing = null,通过以下方法进行切换
暂停模式(paused) => 流动模式(flowing):
    在没有明确暂停rs上添加'data'事件  (如果rs._readableState.flowing=false,则不会转换为flowing)
    调用rs.resume()方法
    调用rs.pipe(ws)方法

流动模式 => 暂停模式:
    在流没有 pipe() 时,调用 pause() 方法可以将流暂停
    pipe() 时,需要移除所有 data 事件的监听,再调用 unpipe() 方法

#### pipe方法做了五件事情

emit(pipe),通知写入
.write(),新数据过来,写入
.pause(),消费者消费速度慢,暂停写入
.resume(),消费者完成消费,继续写入
return writable,支持链式调用


[Stream文档地址](http://nodejs.cn/api/stream.html)
[http://javascript.ruanyifeng.com/nodejs/stream.html](http://javascript.ruanyifeng.com/nodejs/stream.html)





















