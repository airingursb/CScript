// 词法解析+语法解析用例
function hello() {
  let a = 1;
  let b = 2;
  let c = a + b;
  let d = "hello";
  println(d + ":" + c);
  return c;
}

let a = hello();
println("a: " + a);

for (let i = 0; i < 10; i++) {
  println("i:" + i);
}