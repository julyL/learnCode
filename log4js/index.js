var log4js = require("log4js");
log4js.configure({
    appenders: {
        //logtoConsole, logtoFile仅用于表示appenders的名称
        logtoConsole: {
            type: "console" // 输出到控制台
        },
        logtoFile: {
            type: "file", // 输出到文件
            filename: "./log/dev.log" // 输出文件路径
        }
    },
    categories: {
        default: {
            // default为category的默认输出显示
            appenders: ["logtoFile", "logtoConsole"], // 采用appenders中对应的输出方式进行日志输出
            level: "debug" // 控制日志输出级别,必须 [大于等于debug] 级别
        }
    }
});

const logger = log4js.getLogger();
const log1 = log4js.getLogger("[log1]")
logger.all("logger all");
logger.trace("logger trace");
logger.debug("logger debug");
logger.info("logger info");
log1.info("log1 info");
logger.warn("logger warn");
logger.error("logger error");
logger.fatal("logger fatal");
logger.mark("logger mark");
logger.off("logger off");
/*
    appenders: 表示日志的输出方式  常用的设置[console,stdout,file]

    categories: 标示日志输出的分类, 可用getLogger进行设置. 日志的分类依据 level和 categories
     上述代码部分输出如下: 
        [2018-04-02T17:07:58.591] [INFO] default - logger debug.   // INFO表示日志级别为info, default是categories默认显示,可通过getLogger设置,如下
        [2018-04-02T17:07:58.591] [INFO] [log1] - log1 debug.      // [log1]为categories
        [2018-04-02T17:21:28.316] [WARN] default - logger warn     

    level: 标示日志的输出级别 all < trace < debug < info < warn < error <fatal < mark < off 八个级别,默认为off,只有优先级大于等于设置的level才会记录日志, 所以上述all和trace级别不会输出到日志
*/