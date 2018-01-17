// demo-cookie.js  
服务端通过设置返回头Header的"Set-Cookie"字段在浏览器设置cookie,来存储用户信息
用户信息存储在浏览器不安全,并且当请求路径匹配cookie的path(默认"/")时,发送请求给服务器时会携带cookie,cookie存储过多信息会造成带宽浪费

// demo-session.js
只在浏览器存储用户id(session_id), 敏感的用户信息均存储在服务端,服务端接受请求时会根据cookie值检测session的有效性
