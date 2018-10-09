var Light = function () {
    this.offLightState = new OffLightState(this);
    this.weakLightState = new WeakLightState(this);
    this.strongLightState = new StrongLightState(this);
    this.currState = null; // 电灯的状态
    this.button = null; // 电灯开关按钮
};

Light.prototype.init = function () {
    var button = {
            info: "我是一个按钮"
        },
        self = this;
    this.currState = this.offLightState; // 设置默认状态
    button.onclick = function () {
        self.currState.buttonWasPressed();
    }
    this.button = button;
};

Light.prototype.setState = function (newState) {
    this.currState = newState;
};

function OffLightState(light) {
    this.light = light;
}

function WeakLightState(light) {
    this.light = light;
}

function StrongLightState(light) {
    this.light = light;
}

OffLightState.prototype.buttonWasPressed = function () {
    console.log('弱光');
    this.light.setState(this.light.weakLightState);
}


WeakLightState.prototype.buttonWasPressed = function () {
    console.log('强光');
    this.light.setState(this.light.strongLightState);
}


StrongLightState.prototype.buttonWasPressed = function () {
    console.log('关灯');
    this.light.setState(this.light.offLightState);
}



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