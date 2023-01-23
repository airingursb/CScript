/**
 * 编译过程中的错误信息
 *
 * 当前特性：
 * 1. 树状的符号表
 * 2. 简单的引用消解：没有考虑声明的先后顺序，也没有考虑闭包
 * 3. 简单的作用域
 */

import { Position } from './scanner';

export class CompilerError {
  msg: string;
  isWarning: boolean; //如果是警告级，设为true。否则为错误级。
  beginPos: Position; //在源代码中的第一个Token的位置
  // endPos:Position;   //在源代码中的最后一个Token的位置

  constructor(msg: string, beginPos: Position, /* endPos:Position, */ isWarning = false) {
    this.msg = msg;
    this.beginPos = beginPos;
    // this.endPos = endPos;
    this.isWarning = isWarning;
  }
}
