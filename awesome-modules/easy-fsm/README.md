easy-fsm是一个简单的有限状态机实现,[github地址](https://github.com/oldj/easy-fsm)

实现有限状态机(Finite-state machine)的前提是事物的状态是有限的，并且同时只能处于一种状态。通过将事物所有的状态和该状态所能过渡到的新状态都罗列出来，这样状态从A变到B时只需要查看状态机中是否有A -> B的映射即可，可以有效减少if else语句来对状态的判断