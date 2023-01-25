// 处理命令行参数，从文件里读取源代码
import * as process from 'process';

import { AstDumper, Prog } from './ast';
import { Parser } from './parser';
import { CharStream, Scanner, TokenKind } from './scanner';
import { ScopeDumper } from './scope';
import { SemanticAnalyer } from './semantic';
import { BCGenerator, BCModule, BCModuleDumper, BCModuleReader, BCModuleWriter, VM } from './vm';

/////////////////////////////////////////////////////////////////////////
// 主程序

function compileAndRun(fileName: string, program: string) {
  // 源代码
  console.log('源代码:');
  console.log(program);

  // 词法分析
  console.log('\n词法分析结果:');
  let scanner = new Scanner(new CharStream(program));
  while (scanner.peek().kind != TokenKind.EOF) {
    console.log(scanner.next().toString());
  }
  scanner = new Scanner(new CharStream(program)); //重置tokenizer,回到开头。

  // 语法分析
  let parser = new Parser(scanner);
  let prog: Prog = parser.parseProg();
  console.log('\n语法分析后的AST:');
  let astDumper = new AstDumper();
  astDumper.visit(prog, '');

  // 语义分析
  let semanticAnalyer = new SemanticAnalyer();
  semanticAnalyer.execute(prog);
  console.log('\n符号表：');
  new ScopeDumper().visit(prog, '');
  console.log('\n语义分析后的AST，注意变量和函数已被消解:');
  astDumper.visit(prog, '');

  if (parser.errors.length > 0 || semanticAnalyer.errors.length > 0) {
    console.log('\n共发现' + parser.errors.length + '个语法错误，' + semanticAnalyer.errors.length + '个语义错误。');
    return;
  }

  // 用 vm 运行程序
  console.log('\n编译成字节码:');
  let generator = new BCGenerator();
  let bcModule = generator.visit(prog) as BCModule;
  let bcModuleDumper = new BCModuleDumper();
  bcModuleDumper.dump(bcModule);
  // console.log(bcModule);

  console.log('\n使用栈机运行程序:');
  let date1 = new Date();
  let retVal = new VM().execute(bcModule);
  let date2 = new Date();
  console.log('程序返回值：' + retVal);
  // console.log(retVal);
  console.log('耗时：' + (date2.getTime() - date1.getTime()) / 1000 + '秒');

  console.log('\n生成字节码文件：');
  let writer = new BCModuleWriter();
  let code = writer.write(bcModule);
  let str: string = '';
  for (let c of code) {
    str += c.toString(16) + ' ';
  }
  console.log(str);

  // 保存成二进制字节码
  let bcFileName = fileName.substr(0, fileName.indexOf('.')) + '.bc';
  writeByteCode(bcFileName, code);
  let newCode = readByteCode(bcFileName);
  console.log(newCode);

  // 读取字节码文件并执行
  console.log('\n从字节码中生成新BCModule:');
  let reader = new BCModuleReader();
  let newModule = reader.read(code);
  bcModuleDumper.dump(newModule);

  console.log('\n用栈机执行新的BCModule:');
  date1 = new Date();
  retVal = new VM().execute(newModule);
  date2 = new Date();
  console.log('程序返回值：');
  console.log(retVal);
  console.log('耗时：' + (date2.getTime() - date1.getTime()) / 1000 + '秒');
}

function writeByteCode(fileName: string, bc: number[]) {
  let fs = require('fs');

  let buffer = Buffer.alloc(bc.length);
  for (let i: number = 0; i < bc.length; i++) {
    buffer[i] = bc[i];
  }

  console.log(buffer);

  try {
    fs.writeFileSync(fileName, buffer);
  } catch (err) {
    console.log(err);
  }
}

function readByteCode(fileName: string): number[] {
  let fs = require('fs');
  let bc: number[] = [];

  let buffer: any;

  try {
    buffer = fs.readFileSync(fileName, buffer);
    for (let i: number = 0; i < buffer.length; i++) {
      bc[i] = buffer[i];
    }
  } catch (err) {
    console.log(err);
  }

  return bc;
}

function writeTextFile(fileName: string, data: string): void {
  let fs = require('fs');
  try {
    fs.writeFileSync(fileName, data);
  } catch (err) {
    console.log(err);
  }
}

function readTextFile(fileName: string): string {
  let fs = require('fs');
  let str: string = '';
  fs.readFile(fileName, 'utf8', function (err: any, data: string) {
    if (err) throw err;
    // str = data;
    console.log(data);
  });
  return str;
}

// 要求命令行的第三个参数，一定是一个文件名。
if (process.argv.length < 3) {
  console.log('Usage: node ' + process.argv[1] + ' FILENAME');
  process.exit(1);
}

// 编译和运行源代码
let fileName = process.argv[2] as string;
let fs = require('fs');
fs.readFile(fileName, 'utf8', function (err: any, data: string) {
  if (err) throw err;
  compileAndRun(fileName, data);
});
