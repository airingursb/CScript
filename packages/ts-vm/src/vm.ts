/**
 * 字节码生成程序和虚拟机
 */

import { assert } from 'console';

import {
  AstVisitor,
  Binary,
  Block,
  ForStatement,
  FunctionCall,
  FunctionDecl,
  IfStatement,
  IntegerLiteral,
  Prog,
  ReturnStatement,
  StringLiteral,
  Unary,
  Variable,
  VariableDecl,
} from './ast';
import { Op } from './scanner';
import { built_ins, FunctionSymbol, Symbol, SymbolDumper, VarSymbol } from './symbol';
import { FunctionType, SimpleType, SysTypes, Type, UnionType } from './types';

/**
 * 指令及其编码
 */
enum OpCode {
  // 参考JVM的操作码
  iconst_0 = 0x03,
  iconst_1 = 0x04,
  iconst_2 = 0x05,
  iconst_3 = 0x06,
  iconst_4 = 0x07,
  iconst_5 = 0x08,
  bipush = 0x10, // 8位整数入栈
  sipush = 0x11, // 16位整数入栈
  ldc = 0x12, // 从常量池加载，load const
  iload = 0x15, // 本地变量入栈
  iload_0 = 0x1a,
  iload_1 = 0x1b,
  iload_2 = 0x1c,
  iload_3 = 0x1d,
  istore = 0x36,
  istore_0 = 0x3b,
  istore_1 = 0x3c,
  istore_2 = 0x3d,
  istore_3 = 0x3e,
  iadd = 0x60,
  isub = 0x64,
  imul = 0x68,
  idiv = 0x6c,
  iinc = 0x84,
  lcmp = 0x94,
  ifeq = 0x99,
  ifne = 0x9a,
  iflt = 0x9b,
  ifge = 0x9c,
  ifgt = 0x9d,
  ifle = 0x9e,
  if_icmpeq = 0x9f,
  if_icmpne = 0xa0,
  if_icmplt = 0xa1,
  if_icmpge = 0xa2,
  if_icmpgt = 0xa3,
  if_icmple = 0xa4,
  goto = 0xa7,
  ireturn = 0xac,
  return = 0xb1,
  invokestatic = 0xb8, // 调用函数

  // 自行扩展的操作码
  sadd = 0x61, // 字符串连接
  sldc = 0x13, // 把字符串常量入栈。字符串放在常量区，用两个操作数记录下标。
}

/**
 * 字节码模块
 * 里面包括一个模块里的各种函数定义、常量池等内容。
 */
export class BCModule {
  // 常量
  consts: any[] = [];

  // 入口函数
  _main: FunctionSymbol | null = null;

  constructor() {
    // 系统函数
    for (let fun of built_ins.values()) {
      this.consts.push(fun);
    }
  }
}

/**
 * 打印调试信息
 */
export class BCModuleDumper {
  dump(bcModule: BCModule) {
    let symbolDumper = new SymbolDumper();
    for (let x of bcModule.consts) {
      if (typeof x == 'number') {
        console.log('Number: ' + x);
      } else if (typeof x == 'string') {
        console.log('String: ' + x);
      } else if (typeof (x as Symbol).kind == 'number') {
        symbolDumper.visit(x, '');
      } else {
        console.log('unknown const:');
        console.log(x);
      }
    }
  }
}

/**
 * 字节码生成程序
 */
export class BCGenerator extends AstVisitor {
  // 编译后生成的模型
  m: BCModule;

  // 当前的函数，用于查询本地变量的下标
  functionSym: FunctionSymbol | null = null;

  // 当前节点是否属于表达式的一部分。主要用于判断一元运算符应该如何生成指令。
  // TODO 以后这部分可以挪到数据流分析里。
  inExpression: boolean = false;

  constructor() {
    super();
    this.m = new BCModule();
  }

  /**
   * 主函数
   * @param prog
   */
  visitProg(prog: Prog): any {
    this.functionSym = prog.sym;
    if (this.functionSym != null) {
      this.m.consts.push(this.functionSym);
      this.m._main = this.functionSym;
      this.functionSym.byteCode = this.visitBlock(prog) as number[];
    }

    return this.m;
  }

  /**
   * 函数声明
   * @param functionDecl
   */
  visitFunctionDecl(functionDecl: FunctionDecl): any {
    // 1.设置当前的函数符号
    let lastFunctionSym = this.functionSym;
    this.functionSym = functionDecl.sym;

    // 添加到Module
    this.m.consts.push(this.functionSym);

    // 2.为函数体生成代码
    let code1 = this.visit(functionDecl.callSignature);
    let code2 = this.visit(functionDecl.body);

    this.addOffsetToJumpOp(code2, code1.length);

    if (this.functionSym != null) {
      this.functionSym.byteCode = code1.concat(code2);
    }

    // 3.恢复当前函数
    this.functionSym = lastFunctionSym;
  }

  /**
   * 遍历一个块，把每个语句产生的代码拼起来。
   * @param block
   */
  visitBlock(block: Block): any {
    //  console.log("visitBlock in BCGenerator" );
    let ret: number[] = [];
    for (let x of block.stmts) {
      this.inExpression = false; // 每个语句开始的时候，重置
      let code = this.visit(x);
      if (typeof code == 'object') {
        // 在visitFunctionDecl的时候，会返回undefined
        this.addOffsetToJumpOp(code, ret.length);
        ret = ret.concat(code);
      }
    }
    return ret;
  }

  /**
   * 如果变量声明时有初始化部分，那么要产生变量赋值操作
   * @param variableDecl
   */
  visitVariableDecl(variableDecl: VariableDecl): any {
    let code: number[] = [];
    if (variableDecl.init != null) {
      // 获取初始化部分的Code
      let ret = this.visit(variableDecl.init) as number[];
      code = code.concat(ret);
      // 生成变量赋值的指令
      code = code.concat(this.setVariableValue(variableDecl.sym));
    }
    return code;
  }

  /**
   * 处理Return语句时，要把返回值封装成一个特殊的对象，用于中断后续程序的执行。
   * @param returnStatement
   */
  visitReturnStatement(returnStatement: ReturnStatement): any {
    //  console.log("visitReturnStatement in BCGenerator" );
    let code: number[] = [];
    // 1.为return后面的表达式生成代码
    if (returnStatement.exp != null) {
      let code1 = this.visit(returnStatement.exp) as number[];
      //  console.log(code1);
      code = code.concat(code1);
      // 生成ireturn代码
      code.push(OpCode.ireturn);
      return code;
    } else {
      // 2.生成return代码，返回值是void
      code.push(OpCode.return);
      return code;
    }
  }

  visitFunctionCall(functionCall: FunctionCall): any {
    //  console.log("in AstVisitor.visitFunctionCall "+ functionCall.name);
    let code: number[] = [];
    // 1.依次生成与参数计算有关的指令，也就是把参数压到计算栈里
    for (let param of functionCall.arguments) {
      let code1 = this.visit(param);
      code = code.concat(code1 as number[]);
    }

    // 2.生成invoke指令
    //  console.log(functionCall.sym);
    let index = this.m.consts.indexOf(functionCall.sym);
    assert(index != -1, '生成字节码时，在模块中查找函数失败！');
    //  console.log(this.module);
    code.push(OpCode.invokestatic);
    code.push(index >> 8);
    code.push(index);

    return code;
  }

  /**
   * 为if语句生成字节码
   * 难度：分枝语句的跳转地址需要修改。
   * @param stmt
   */
  visitIfStatement(ifstmt: IfStatement): any {
    let code: number[] = [];

    let code_condition: number[] = this.visit(ifstmt.condition);
    this.inExpression = false; // 重置

    let code_ifBlock: number[] = this.visit(ifstmt.stmt);
    this.inExpression = false; // 重置

    let code_elseBlock: number[] = ifstmt.elseStmt == null ? [] : this.visit(ifstmt.elseStmt);
    this.inExpression = false; // 重置

    let offset_ifBlock: number = code_condition.length + 3; // if语句块的地址
    let offset_elseBlock: number = code_condition.length + code_ifBlock.length + 6; // else语句块的地址
    let offset_nextStmt: number = offset_elseBlock + code_elseBlock.length; // if语句后面跟着下一个语句的地址

    this.addOffsetToJumpOp(code_ifBlock, offset_ifBlock);
    this.addOffsetToJumpOp(code_elseBlock, offset_elseBlock);

    // 条件
    code = code.concat(code_condition);

    // 跳转:去执行else语句块
    code.push(OpCode.ifeq);
    code.push(offset_elseBlock >> 8);
    code.push(offset_elseBlock);

    // 条件为true时执行的语句
    code = code.concat(code_ifBlock);

    // 跳转：到整个if语句之后的语句
    code.push(OpCode.goto);
    code.push(offset_nextStmt >> 8);
    code.push(offset_nextStmt);

    // 条件为false时执行的语句
    code = code.concat(code_elseBlock);

    return code;
  }

  /**
   * 为For循环生成字节码
   * @param forStmt
   */
  visitForStatement(forStmt: ForStatement): any {
    let code: number[] = [];
    let code_init: number[] = forStmt.init == null ? [] : this.visit(forStmt.init);
    this.inExpression = false; // 重置

    let code_condition: number[] = forStmt.condition == null ? [] : this.visit(forStmt.condition);
    this.inExpression = false; // 重置

    let code_increment: number[] = forStmt.increment == null ? [] : this.visit(forStmt.increment);
    this.inExpression = false; // 重置

    let code_stmt: number[] = forStmt.stmt == null ? [] : this.visit(forStmt.stmt);
    this.inExpression = false; // 重置

    // 循环条件的起始位置
    let offset_condition = code_init.length;
    // 循环体的起始位置
    let offset_stmt = offset_condition + code_condition.length + (code_condition.length > 0 ? 3 : 0);
    // 递增部分的起始位置
    let offset_increment = offset_stmt + code_stmt.length;
    // 循环结束的位置
    let offset_nextStmt = offset_increment + code_increment.length + 3;

    this.addOffsetToJumpOp(code_condition, offset_condition);
    this.addOffsetToJumpOp(code_increment, offset_increment);
    this.addOffsetToJumpOp(code_stmt, offset_stmt);

    // 初始化部分
    code = code.concat(code_init);

    // 循环条件
    if (code_condition.length > 0) {
      // 如果循环条件为空，那么这里就减少一个分枝判断，直接往下走。
      code = code.concat(code_condition);
      // 根据条件的值跳转
      code.push(OpCode.ifeq);
      code.push(offset_nextStmt >> 8);
      code.push(offset_nextStmt);
    }

    // 循环体
    code = code.concat(code_stmt);

    // 递增的部分
    code = code.concat(code_increment);

    // 跳转回循环条件
    code.push(OpCode.goto);
    code.push(offset_condition >> 8);
    code.push(offset_condition);

    return code;
  }

  /**
   * 在跳转地址上添加偏移量
   * @param code
   * @param offset
   */
  private addOffsetToJumpOp(code: number[], offset: number = 0): number[] {
    if (offset == 0) return code; // 短路

    let codeIndex = 0;
    while (codeIndex < code.length) {
      switch (code[codeIndex]) {
        // 纯指令，后面不带操作数
        case OpCode.iadd:
        case OpCode.sadd:
        case OpCode.isub:
        case OpCode.imul:
        case OpCode.idiv:
        case OpCode.iconst_0:
        case OpCode.iconst_1:
        case OpCode.iconst_2:
        case OpCode.iconst_3:
        case OpCode.iconst_4:
        case OpCode.iconst_5:
        case OpCode.istore_0:
        case OpCode.istore_1:
        case OpCode.istore_2:
        case OpCode.istore_3:
        case OpCode.iload_0:
        case OpCode.iload_1:
        case OpCode.iload_2:
        case OpCode.iload_3:
        case OpCode.ireturn:
        case OpCode.return:
        case OpCode.lcmp:
          codeIndex++;
          continue;

        // 指令后面带1个字节的操作数
        case OpCode.iload:
        case OpCode.istore:
        case OpCode.bipush:
        case OpCode.ldc:
        case OpCode.sldc:
          codeIndex += 2;
          continue;

        // 指令后面带2个字节的操作数
        case OpCode.iinc:
        case OpCode.invokestatic:
        case OpCode.sipush:
          codeIndex += 3;
          continue;

        // 跳转语句，需要给跳转指令加上offset
        case OpCode.if_icmpeq:
        case OpCode.if_icmpne:
        case OpCode.if_icmpge:
        case OpCode.if_icmpgt:
        case OpCode.if_icmple:
        case OpCode.if_icmplt:
        case OpCode.ifeq:
        case OpCode.ifne:
        case OpCode.ifge:
        case OpCode.ifgt:
        case OpCode.ifle:
        case OpCode.iflt:
        case OpCode.goto:
          let byte1 = code[codeIndex + 1];
          let byte2 = code[codeIndex + 2];
          let address = (byte1 << 8) | (byte2 + offset);
          code[codeIndex + 1] = address >> 8;
          code[codeIndex + 2] = address;
          codeIndex += 3;
          continue;

        default:
          console.log('unrecognized Op Code in addOffsetToJumpOp: ' + OpCode[code[codeIndex]]);
          return code;
      }
    }
    return code;
  }

  /**
   * 生成获取本地变量值的指令
   * todo :目前只支持本地变量
   * @param varName
   */
  private getVariableValue(sym: VarSymbol | null): any {
    let code: number[] = []; // 生成的字节码
    if (sym != null) {
      // 本地变量的下标
      let index = this.functionSym?.vars.indexOf(sym);
      assert(index != -1, '生成字节码时（获取变量的值），在函数符号中获取本地变量下标失败！');
      // 根据不同的下标生成指令，尽量生成压缩指令
      switch (index) {
        case 0:
          code.push(OpCode.iload_0);
          break;
        case 1:
          code.push(OpCode.iload_1);
          break;
        case 2:
          code.push(OpCode.iload_2);
          break;
        case 3:
          code.push(OpCode.iload_3);
          break;
        default:
          code.push(OpCode.iload);
          code.push(index as number);
      }
    }
    return code;
  }

  private setVariableValue(sym: VarSymbol | null): any {
    let code: number[] = []; // 生成的字节码
    if (sym != null) {
      // 本地变量的下标
      let index = this.functionSym?.vars.indexOf(sym);
      assert(index != -1, '生成字节码时(设置变量值)，在函数符号中查找变量失败！');
      // 根据不同的下标生成指令，尽量生成压缩指令
      switch (index) {
        case 0:
          code.push(OpCode.istore_0);
          break;
        case 1:
          code.push(OpCode.istore_1);
          break;
        case 2:
          code.push(OpCode.istore_2);
          break;
        case 3:
          code.push(OpCode.istore_3);
          break;
        default:
          code.push(OpCode.istore);
          code.push(index as number);
      }
    }
    return code;
  }

  visitBinary(bi: Binary): any {
    this.inExpression = true;

    let code: number[];
    let code1 = this.visit(bi.exp1);
    let code2 = this.visit(bi.exp2);

    let address1: number = 0;
    let address2: number = 0;
    let tempCode: number = 0;

    // // 1.处理赋值
    if (bi.op == Op.Assign) {
      let varSymbol = code1 as VarSymbol;
      console.log('varSymbol:');
      console.log(varSymbol);
      // 加入右子树的代码
      code = code2;
      // 加入istore代码
      code = code.concat(this.setVariableValue(varSymbol));
    }
    // // 2.处理其他二元运算
    else {
      // 加入左子树的代码
      code = code1;
      // 加入右子树的代码
      code = code.concat(code2);
      // 加入运算符的代码
      switch (bi.op) {
        case Op.Plus: // '+'
          if (bi.theType == SysTypes.String) {
            code.push(OpCode.sadd);
          } else {
            code.push(OpCode.iadd);
          }
          break;
        case Op.Minus: // '-'
          code.push(OpCode.isub);
          break;
        case Op.Multiply: // '*'
          code.push(OpCode.imul);
          break;
        case Op.Divide: // '/'
          code.push(OpCode.idiv);
          break;
        case Op.G: // '>'
        case Op.GE: // '>='
        case Op.L: // '<'
        case Op.LE: // '<='
        case Op.EQ: // '=='
        case Op.NE: // '!='
          if (bi.op == Op.G) {
            tempCode = OpCode.if_icmple;
          } else if (bi.op == Op.GE) {
            tempCode = OpCode.if_icmplt;
          } else if (bi.op == Op.L) {
            tempCode = OpCode.if_icmpge;
          } else if (bi.op == Op.LE) {
            tempCode = OpCode.if_icmpgt;
          } else if (bi.op == Op.EQ) {
            tempCode = OpCode.if_icmpne;
          } else if (bi.op == Op.NE) {
            tempCode = OpCode.if_icmpeq;
          }

          address1 = code.length + 7;
          address2 = address1 + 1;
          code.push(tempCode);
          code.push(address1 >> 8);
          code.push(address1);
          code.push(OpCode.iconst_1);
          code.push(OpCode.goto);
          code.push(address2 >> 8);
          code.push(address2);
          code.push(OpCode.iconst_0);
          break;
        default:
          console.log('Unsupported binary operation: ' + bi.op);
          return [];
      }
    }

    return code;
  }

  visitUnary(u: Unary): any {
    let code: number[] = [];
    let v = this.visit(u.exp);
    let varSymbol: VarSymbol;
    let varIndex: number;

    if (u.op == Op.Inc) {
      varSymbol = v as VarSymbol;
      varIndex = this.functionSym?.vars.indexOf(varSymbol) as number;
      if (u.isPrefix) {
        code.push(OpCode.iinc);
        code.push(varIndex);
        code.push(1);
        if (this.inExpression) {
          code = code.concat(this.getVariableValue(varSymbol));
        }
      } else {
        if (this.inExpression) {
          code = code.concat(this.getVariableValue(varSymbol));
        }
        code.push(OpCode.iinc);
        code.push(varIndex);
        code.push(1);
      }
    } else if (u.op == Op.Dec) {
      varSymbol = v as VarSymbol;
      varIndex = this.functionSym?.vars.indexOf(varSymbol) as number;
      if (u.isPrefix) {
        code.push(OpCode.iinc);
        code.push(varIndex);
        code.push(-1);
        if (this.inExpression) {
          code = code.concat(this.getVariableValue(varSymbol));
        }
      } else {
        if (this.inExpression) {
          code = code.concat(this.getVariableValue(varSymbol));
        }
        code.push(OpCode.iinc);
        code.push(varIndex);
        code.push(-1);
      }
    } else {
      console.log('Unsupported unary oprator :' + u.op);
    }
    return code;
  }

  /**
   * 左值的情况，返回符号。否则，生成iload指令。
   * @param v
   */
  visitVariable(v: Variable): any {
    if (v.isLeftValue) {
      return v.sym;
    } else {
      return this.getVariableValue(v.sym);
    }
  }

  /**
   * 生成常量入栈的指令
   * @param integerLiteral
   */
  visitIntegerLiteral(integerLiteral: IntegerLiteral): any {
    //  console.log("visitIntegerLiteral in BC");
    let ret: number[] = [];
    let value = integerLiteral.value;
    // 0-5之间的数字，直接用快捷指令
    if (value >= 0 && value <= 5) {
      switch (value) {
        case 0:
          ret.push(OpCode.iconst_0);
          break;
        case 1:
          ret.push(OpCode.iconst_1);
          break;
        case 2:
          ret.push(OpCode.iconst_2);
          break;
        case 3:
          ret.push(OpCode.iconst_3);
          break;
        case 4:
          ret.push(OpCode.iconst_4);
          break;
        case 5:
          ret.push(OpCode.iconst_5);
          break;
      }
    }

    // 如果是8位整数，用bipush指令，直接放在后面的一个字节的操作数里就行了
    else if (value >= -128 && value < 128) {
      ret.push(OpCode.bipush);
      ret.push(value);
    }

    // 如果是16位整数，用sipush指令
    else if (value >= -32768 && value < 32768) {
      ret.push(OpCode.sipush);
      // 要拆成两个字节
      ret.push(value >> 8);
      ret.push(value & 0x00ff);
    }

    // 大于16位的，采用ldc指令，从常量池中去取
    else {
      ret.push(OpCode.ldc);
      // 把value值放入常量池。
      this.m.consts.push(value);
      ret.push(this.m.consts.length - 1);
    }
    //  console.log(ret);
    return ret;
  }

  visitStringLiteral(stringLiteral: StringLiteral): any {
    let ret: number[] = [];
    let value = stringLiteral.value;
    this.m.consts.push(value);
    ret.push(OpCode.sldc);
    ret.push(this.m.consts.length - 1);
    return ret;
  }
}

/**
 * 虚拟机
 */
export class VM {
  callStack: StackFrame[] = [];

  constructor() {}

  /**
   * 运行一个模块。
   * @param bcModule
   */
  execute(bcModule: BCModule): number {
    // 找到入口函数
    let functionSym: FunctionSymbol;
    if (bcModule._main == null) {
      console.log('Can not find main function.');
      return -1;
    } else {
      functionSym = bcModule._main;
    }

    // 创建栈桢
    let frame = new StackFrame(functionSym);
    this.callStack.push(frame);

    // 当前运行的代码
    let code: number[] = [];
    if (functionSym.byteCode != null) {
      code = functionSym.byteCode;
    } else {
      console.log('Can not find code for ' + frame.funtionSym.name);
      return -1;
    }

    // 当前代码的位置
    let codeIndex = 0;

    // 一直执行代码，直到遇到return语句
    let opCode = code[codeIndex];

    // 临时变量
    let byte1: number = 0;
    let byte2: number = 0;
    let vleft: any;
    let vright: any;
    let tempCodeIndex: number = 0;
    let constIndex: number = 0;
    let numValue: number = 0;
    let strValue: string = '';

    while (true) {
      switch (opCode) {
        case OpCode.iconst_0:
          frame.oprandStack.push(0);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iconst_1:
          frame.oprandStack.push(1);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iconst_2:
          frame.oprandStack.push(2);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iconst_3:
          frame.oprandStack.push(3);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iconst_4:
          frame.oprandStack.push(4);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iconst_5:
          frame.oprandStack.push(5);
          opCode = code[++codeIndex];
          continue;
        case OpCode.bipush: // 取出1个字节
          frame.oprandStack.push(code[++codeIndex]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.sipush: // 取出2个字节
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          frame.oprandStack.push((byte1 << 8) | byte2);
          opCode = code[++codeIndex];
          continue;
        case OpCode.ldc: // 从常量池加载
          constIndex = code[++codeIndex];
          numValue = bcModule.consts[constIndex];
          frame.oprandStack.push(numValue);
          opCode = code[++codeIndex];
          continue;
        case OpCode.sldc: // 从常量池加载字符串
          constIndex = code[++codeIndex];
          strValue = bcModule.consts[constIndex];
          frame.oprandStack.push(strValue);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iload:
          frame.oprandStack.push(frame.localVars[code[++codeIndex]]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iload_0:
          frame.oprandStack.push(frame.localVars[0]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iload_1:
          frame.oprandStack.push(frame.localVars[1]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iload_2:
          frame.oprandStack.push(frame.localVars[2]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iload_3:
          frame.oprandStack.push(frame.localVars[3]);
          opCode = code[++codeIndex];
          continue;
        case OpCode.istore:
          frame.localVars[code[++codeIndex]] = frame.oprandStack.pop();
          opCode = code[++codeIndex];
          continue;
        case OpCode.istore_0:
          frame.localVars[0] = frame.oprandStack.pop();
          opCode = code[++codeIndex];
          continue;
        case OpCode.istore_1:
          frame.localVars[1] = frame.oprandStack.pop();
          opCode = code[++codeIndex];
          continue;
        case OpCode.istore_2:
          frame.localVars[2] = frame.oprandStack.pop();
          opCode = code[++codeIndex];
          continue;
        case OpCode.istore_3:
          frame.localVars[3] = frame.oprandStack.pop();
          opCode = code[++codeIndex];
          continue;
        case OpCode.iadd:
        case OpCode.sadd:
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          frame.oprandStack.push(vleft + vright);
          opCode = code[++codeIndex];
          continue;
        case OpCode.isub:
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          frame.oprandStack.push(vleft - vright);
          opCode = code[++codeIndex];
          continue;
        case OpCode.imul:
          frame.oprandStack.push(frame.oprandStack.pop() * frame.oprandStack.pop());
          opCode = code[++codeIndex];
          continue;
        case OpCode.idiv:
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          frame.oprandStack.push(vleft / vright);
          opCode = code[++codeIndex];
          continue;
        case OpCode.iinc:
          let varIndex = code[++codeIndex];
          let offset = code[++codeIndex];
          frame.localVars[varIndex] = frame.localVars[varIndex] + offset;
          opCode = code[++codeIndex];
          continue;
        case OpCode.ireturn:
        case OpCode.return:
          // 确定返回值
          let retValue = undefined;
          if (opCode == OpCode.ireturn) {
            retValue = frame.oprandStack.pop();
          }

          // 弹出栈桢，返回到上一级函数，继续执行
          this.callStack.pop();
          if (this.callStack.length == 0) {
            // 主程序返回，结束运行
            return 0;
          } else {
            // 返回到上一级调用者
            frame = this.callStack[this.callStack.length - 1];
            // 设置返回值到上一级栈桢
            //  frame.retValue = retValue;
            if (opCode == OpCode.ireturn) {
              frame.oprandStack.push(retValue);
            }
            // 设置新的code、codeIndex和oPCode
            if (frame.funtionSym.byteCode != null) {
              // 切换到调用者的代码
              code = frame.funtionSym.byteCode;
              // 设置指令指针为返回地址，也就是调用该函数的下一条指令
              codeIndex = frame.returnIndex;
              opCode = code[codeIndex];
              continue;
            } else {
              console.log('Can not find code for ' + frame.funtionSym.name);
              return -1;
            }
          }
          continue;
        case OpCode.invokestatic:
          // 从常量池找到被调用的函数
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          let functionSym = bcModule.consts[(byte1 << 8) | byte2] as FunctionSymbol;

          // 对于内置函数特殊处理
          if (functionSym.name == 'println') {
            // 取出一个参数
            let param = frame.oprandStack.pop();
            opCode = code[++codeIndex];
            console.log(param); // 打印显示
          } else if (functionSym.name == 'tick') {
            opCode = code[++codeIndex];
            let date = new Date();
            let value = Date.UTC(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              date.getHours(),
              date.getMinutes(),
              date.getSeconds(),
              date.getMilliseconds(),
            );
            frame.oprandStack.push(value);
          } else if (functionSym.name == 'integer_to_string') {
            opCode = code[++codeIndex];
            numValue = frame.oprandStack.pop();
            frame.oprandStack.push(numValue.toString());
          } else {
            // 设置返回值地址，为函数调用的下一条指令
            frame.returnIndex = codeIndex + 1;

            // 创建新的栈桢
            let lastFrame = frame;
            frame = new StackFrame(functionSym);
            this.callStack.push(frame);

            // 传递参数
            let paramCount = (functionSym.theType as FunctionType).paramTypes.length;
            for (let i = paramCount - 1; i >= 0; i--) {
              frame.localVars[i] = lastFrame.oprandStack.pop();
            }

            // 设置新的code、codeIndex和oPCode
            if (frame.funtionSym.byteCode != null) {
              // 切换到被调用函数的代码
              code = frame.funtionSym.byteCode;
              // 代码指针归零
              codeIndex = 0;
              opCode = code[codeIndex];
              continue;
            } else {
              console.log('Can not find code for ' + frame.funtionSym.name);
              return -1;
            }
          }
          continue;
        case OpCode.ifeq:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          if (frame.oprandStack.pop() == 0) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.ifne:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          if (frame.oprandStack.pop() != 0) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.if_icmplt:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          if (vleft < vright) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.if_icmpge:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          if (vleft >= vright) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.if_icmpgt:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          if (vleft > vright) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.if_icmple:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          vright = frame.oprandStack.pop();
          vleft = frame.oprandStack.pop();
          if (vleft <= vright) {
            codeIndex = (byte1 << 8) | byte2;
            opCode = code[codeIndex];
          } else {
            opCode = code[++codeIndex];
          }
          continue;
        case OpCode.goto:
          byte1 = code[++codeIndex];
          byte2 = code[++codeIndex];
          codeIndex = (byte1 << 8) | byte2;
          opCode = code[codeIndex];
          continue;

        default:
          console.log('Unknown op code: ' + opCode?.toString(16));
          return -2;
      }
    }
  }
}

class StackFrame {
  // 对应的函数，用来找到代码
  funtionSym: FunctionSymbol;

  // 返回地址
  returnIndex: number = 0;

  // 本地变量
  localVars: number[];

  // 操作数栈
  oprandStack: any[] = [];

  constructor(funtionSym: FunctionSymbol) {
    this.funtionSym = funtionSym;
    this.localVars = new Array(funtionSym.vars.length);
  }
}

// // // // // // // // // // // // // // // // // // // // // // // // // // // // // //
// 生成字节码

/**
 * 从bcModule生成字节码
 */
export class BCModuleWriter {
  private types: Type[] = []; // 保存该模块所涉及的类型

  /**
   * 从bcModule生成字节码
   * @param bcModule
   */
  write(bcModule: BCModule): number[] {
    let bc2: number[] = [];
    this.types = []; // 重置状态变量

    // 写入常量
    let numConsts = 0;
    for (let c of bcModule.consts) {
      if (typeof c == 'number') {
        bc2.push(1); // 代表接下来是一个number；
        bc2.push(c);
        numConsts++;
      } else if (typeof c == 'string') {
        bc2.push(2); // 代表接下来是一个string；
        this.writeString(bc2, c);
        numConsts++;
      } else if (typeof c == 'object') {
        let functionSym = c as FunctionSymbol;
        if (!built_ins.has(functionSym.name)) {
          // 不用写入系统函数
          bc2.push(3); // 代表接下来是一个FunctionSymbol.
          bc2 = bc2.concat(this.writeFunctionSymbol(functionSym));
          numConsts++;
        }
      } else {
        console.log('Unsupported const in BCModuleWriter.');
        console.log(c);
      }
    }

    // 写入类型
    let bc1: number[] = [];
    this.writeString(bc1, 'types');
    bc1.push(this.types.length);
    for (let t of this.types) {
      if (Type.isFunctionType(t)) {
        bc1 = bc1.concat(this.writeFunctionType(t as FunctionType));
      } else if (Type.isSimpleType(t)) {
        bc1 = bc1.concat(this.writeSimpleType(t as SimpleType));
      } else if (Type.isUnionType(t)) {
        bc1 = bc1.concat(this.writeUnionType(t as UnionType));
      } else {
        console.log('Unsupported type in BCModuleWriter');
        console.log(t);
      }
    }

    this.writeString(bc1, 'consts');
    bc1.push(numConsts);

    return bc1.concat(bc2);
  }

  private writeVarSymbol(sym: VarSymbol): number[] {
    let bc: number[] = [];

    // 写入变量名称
    this.writeString(bc, sym.name);

    // 写入类型名称
    this.writeString(bc, sym.theType.name);
    if (!SysTypes.isSysType(sym.theType) && this.types.indexOf(sym.theType) == -1) {
      this.types.push(sym.theType);
    }

    return bc;
  }

  writeFunctionSymbol(sym: FunctionSymbol): number[] {
    let bc: number[] = [];

    // 写入函数名称
    this.writeString(bc, sym.name);

    // 写入类型名称
    this.writeString(bc, sym.theType.name);
    if (!SysTypes.isSysType(sym.theType) && this.types.indexOf(sym.theType) == -1) {
      this.types.push(sym.theType);
    }

    // 写入操作数栈最大的大小
    bc.push(sym.opStackSize);

    // 写入本地变量个数
    bc.push(sym.vars.length);

    // 逐一写入变量
    // TODO：其实具体变量的信息不是必需的。
    for (let v of sym.vars) {
      bc = bc.concat(this.writeVarSymbol(v));
    }

    // 写入函数函数体的字节码
    if (sym.byteCode == null) {
      // 内置函数
      bc.push(0);
    } else {
      // 自定义函数
      bc.push((sym.byteCode as number[]).length);
      bc = bc.concat(sym.byteCode as number[]);
    }

    return bc;
  }

  writeSimpleType(t: SimpleType): number[] {
    let bc: number[] = [];
    if (SysTypes.isSysType(t)) {
      // 内置类型不用添加
      return bc;
    }

    bc.push(1); // 代表SimpleType

    // 写入类型名称
    this.writeString(bc, t.name);

    // 写入父类型的数量
    bc.push(t.upperTypes.length);
    for (let ut of t.upperTypes) {
      this.writeString(bc, ut.name);
      if (!SysTypes.isSysType(ut) && this.types.indexOf(ut) == -1) {
        this.types.push(ut);
      }
    }

    return bc;
  }

  writeFunctionType(t: FunctionType): number[] {
    let bc: number[] = [];

    bc.push(2); // 代表FunctionType

    // 写入类型名称
    this.writeString(bc, t.name);

    // 写入返回值名称
    this.writeString(bc, t.returnType.name);

    // 写入参数数量
    bc.push(t.paramTypes.length);

    // 写入参数的类型名称
    for (let pt of t.paramTypes) {
      this.writeString(bc, pt.name);
      if (this.types.indexOf(pt) == -1) {
        this.types.push(pt);
      }
    }

    return bc;
  }

  writeUnionType(t: UnionType): number[] {
    let bc: number[] = [];

    bc.push(3); // 代表UnionType

    // 写入类型名称
    this.writeString(bc, t.name);

    // 写入联合的各类型名称
    for (let ut of t.types) {
      this.writeString(bc, ut.name);
      if (this.types.indexOf(ut) == -1) {
        this.types.push(ut);
      }
    }

    return bc;
  }

  /**
   * 把字符串添加的字节码数组中
   * @param bc
   * @param str
   */
  private writeString(bc: number[], str: string) {
    // 写入字符串的长度
    bc.push(str.length);
    for (let i = 0; i < str.length; i++) {
      bc.push(str.charCodeAt(i));
    }
  }
}

/**
 * 从字节码生成BCModule
 */
export class BCModuleReader {
  // 读取字节码时的下标
  private index: number = 0;

  // 解析出来的所有类型
  private types: Map<string, Type> = new Map();

  private typeInfos: Map<string, any> = new Map();

  /**
   * 从字节码生成BCModule
   * @param bc
   */
  read(bc: number[]): BCModule {
    // 重置状态变量
    this.index = 0;
    this.types.clear();

    let bcModule = new BCModule();

    // 1.读取类型
    // 1.1加入系统内置类型
    this.addSystemTypes();

    // 1.2从字节码中读取类型
    let str = this.readString(bc);
    assert(str == 'types', "从字节码中读取的字符串不是'types'");
    let numTypes = bc[this.index++];
    for (let i = 0; i < numTypes; i++) {
      let typeKind = bc[this.index++];
      switch (typeKind) {
        case 1:
          this.readSimpleType(bc);
          break;
        case 2:
          this.readFunctionType(bc);
          break;
        case 3:
          this.readUnionType(bc);
          break;
        default:
          console.log('Unsupported type kind: ' + typeKind);
      }
    }
    this.buildTypes();

    // 2.读取常量
    str = this.readString(bc);
    assert(str == 'consts', "从字节码中读取的字符串不是'consts'");
    let numConsts = bc[this.index++];
    for (let i = 0; i < numConsts; i++) {
      let constType = bc[this.index++];
      if (constType == 1) {
        bcModule.consts.push(bc[this.index++]);
      } else if (constType == 2) {
        let str = this.readString(bc);
        bcModule.consts.push(str);
      } else if (constType == 3) {
        let functionSym = this.readFunctionSymbol(bc);
        bcModule.consts.push(functionSym);
        if (functionSym.name == 'main') {
          bcModule._main = functionSym;
        }
      } else {
        console.log('Unsupported const type: ' + constType);
      }
    }

    return bcModule;
  }

  private readString(bc: number[]): string {
    let len = bc[this.index++];
    let str = '';
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(bc[this.index++]);
    }
    return str;
  }

  private readSimpleType(bc: number[]) {
    let typeName = this.readString(bc);
    let numUpperTypes = bc[this.index++];
    let upperTypes: string[] = [];
    for (let i = 0; i < numUpperTypes; i++) {
      upperTypes.push(this.readString(bc));
    }

    let t = new SimpleType(typeName, []);
    this.types.set(typeName, t);
    this.typeInfos.set(typeName, upperTypes);
  }

  private readFunctionType(bc: number[]) {
    let typeName = this.readString(bc);
    let returnType = this.readString(bc);
    let numParams = bc[this.index++];
    let paramTypes: string[] = [];
    for (let i = 0; i < numParams; i++) {
      paramTypes.push(this.readString(bc));
    }

    let t = new FunctionType(SysTypes.Any, [], typeName);
    this.types.set(typeName, t);
    this.typeInfos.set(typeName, { returnType: returnType, paramTypes: paramTypes });
  }

  private readUnionType(bc: number[]) {
    let typeName = this.readString(bc);
    let numTypes = bc[this.index++];
    let unionTypes: string[] = [];
    for (let i = 0; i < numTypes; i++) {
      unionTypes.push(this.readString(bc));
    }

    let t = new UnionType([], typeName);
    this.types.set(typeName, t);
    this.typeInfos.set(typeName, unionTypes);
  }

  private addSystemTypes() {
    this.types.set('any', SysTypes.Any);
    this.types.set('number', SysTypes.Number);
    this.types.set('string', SysTypes.String);
    this.types.set('integer', SysTypes.Integer);
    this.types.set('decimal', SysTypes.Decimal);
    this.types.set('boolean', SysTypes.Boolean);
    this.types.set('null', SysTypes.Null);
    this.types.set('undefined', SysTypes.Undefined);
    this.types.set('void', SysTypes.Void);
  }

  /**
   * 生成类型，并建立类型之间正确的引用关系
   */
  private buildTypes() {
    for (let typeName of this.typeInfos.keys()) {
      let t = this.types.get(typeName) as Type;
      if (Type.isSimpleType(t)) {
        let simpleType = t as SimpleType;
        let upperTypes = this.typeInfos.get(typeName) as string[];
        for (let utName of upperTypes) {
          let ut = this.types.get(utName) as Type;
          simpleType.upperTypes.push(ut);
        }
      } else if (Type.isFunctionType(t)) {
        let funtionType = t as FunctionType;
        let returnType = this.typeInfos.get(typeName).returnType as string;
        let paramTypes = this.typeInfos.get(typeName).paramTypes as string[];
        funtionType.returnType = this.types.get(returnType) as Type;
        for (let utName of paramTypes) {
          let ut = this.types.get(utName) as Type;
          funtionType.paramTypes.push(ut);
        }
      } else if (Type.isUnionType(t)) {
        let unionType = t as UnionType;
        let types = this.typeInfos.get(typeName) as string[];
        for (let utName of types) {
          let ut = this.types.get(utName) as Type;
          unionType.types.push(ut);
        }
      } else {
        console.log('Unsupported type in BCModuleReader.');
        console.log(t);
      }
    }

    this.typeInfos.clear();
  }

  /**
   * 从字节码中读取FunctionSymbol
   * @param bc 字节码
   */
  private readFunctionSymbol(bc: number[]): FunctionSymbol {
    // 函数名称
    let functionName = this.readString(bc);

    // 读取类型名称
    let typeName = this.readString(bc);
    let functionType = this.types.get(typeName) as FunctionType;

    // 操作数栈的大小
    let opStackSize = bc[this.index++];

    // 变量个数
    let numVars = bc[this.index++];

    // 读取变量
    let vars: VarSymbol[] = [];
    for (let i: number = 0; i < numVars; i++) {
      vars.push(this.readVarSymbol(bc));
    }

    // 读取函数体的字节码
    let numByteCodes = bc[this.index++];
    let byteCodes: number[] | null;
    if (numByteCodes == 0) {
      // 系统函数
      byteCodes = null;
    } else {
      byteCodes = bc.slice(this.index, this.index + numByteCodes);
      this.index += numByteCodes;
    }

    // 创建函数符号
    let functionSym = new FunctionSymbol(functionName, functionType);
    functionSym.vars = vars;
    functionSym.opStackSize = opStackSize;
    functionSym.byteCode = byteCodes;

    return functionSym;
  }

  /**
   * 从字节码中读取VarSymbol
   * @param bc
   */
  private readVarSymbol(bc: number[]): VarSymbol {
    // 变量名称
    let varName = this.readString(bc);

    // 类型名称
    let typeName = this.readString(bc);
    let varType = this.types.get(typeName) as Type;

    return new VarSymbol(varName, varType);
  }
}
