// 词法解析+语法解析用例
function hello(input) {
  // let a = input;
  let b = 2;
  let c = b + 1;
  let d = "hello";
  println(d + ":" + c);
  return c;
}

let a = hello(1);
println("a: " + a);

for (let i = 0; i < 10; i++) {
  println("i:" + i);
}

// TODO: if 语句有问题，待定位
/**
 if (a > 10) {
  println("a > 10, a:" + a);
} else {
  println("a <= 10, a:" + a);
}
*/