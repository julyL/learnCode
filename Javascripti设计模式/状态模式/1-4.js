var Light = function () {
    this.currState = null; // 电灯的状态
    this.button = null; // 电灯开关按钮
    this.fsm = {};
};

Light.prototype.init = function () {
    var button = {
            info: "我是一个按钮"
        },
        self = this;
    this.currState = 'off'; // 设置默认状态
    button.onclick = function () {
        if (self.fsm[self.currState] && typeof self.fsm[self.currState].buttonWasPressed === 'function') {
            self.fsm[self.currState].buttonWasPressed();
        }
    }
    this.button = button;
};


var light = new Light();
light.fsm = {
    off: {
        buttonWasPressed() {
            console.log('弱光');
            light.currState = 'weakLight';
        }
    },
    weakLight: {
        buttonWasPressed() {
            console.log('强光');
            light.currState = 'strongLight';
        }
    },
    strongLight: {
        buttonWasPressed() {
            console.log('关灯');
            light.currState = 'off';
        }
    }
}


light.init();

light.button.onclick();
light.button.onclick();
light.button.onclick();
light.button.onclick();

/*

弱光
强光
关灯
弱光

*/