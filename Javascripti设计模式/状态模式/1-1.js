var Light = function () {
    this.state = 'off'; // 给电灯设置初始状态 off
    this.button = null; // 电灯开关按钮
};

Light.prototype.init = function () {
    var button = {
            info: "我是一个按钮"
        },
        self = this;
    button.onclick = function () {
        self.buttonWasPressed();
    }
    this.button = button;
};

Light.prototype.buttonWasPressed = function () {
    if (this.state === 'off') {
        console.log('弱光');
        this.state = 'weakLight';
    } else if (this.state === 'weakLight') {
        console.log('强光');
        this.state = 'strongLight';
    } else if (this.state === 'strongLight') {
        console.log('关灯');
        this.state = 'off';
    }
};
var light = new Light();
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