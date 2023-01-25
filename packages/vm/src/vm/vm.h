#ifndef PLAYSCRIPT_VM
#define PLAYSCRIPT_VM

#include "symbol.h"
#include "playvm.h"

////////////////////////////////////////////////////////
//指令及其编码
typedef enum _OpCode{
    iconst_0 = 0x03,
    iconst_1 = 0x04,
    iconst_2 = 0x05,
    iconst_3 = 0x06,
    iconst_4 = 0x07,
    iconst_5 = 0x08,
    bipush   = 0x10,  //8位整数入栈
    sipush   = 0x11,  //16位整数入栈
    ldc      = 0x12,  //从常量池加载，load const
    iload    = 0x15,  //本地变量入栈
    iload_0  = 0x1a,
    iload_1  = 0x1b,
    iload_2  = 0x1c,
    iload_3  = 0x1d,
    istore   = 0x36,
    istore_0 = 0x3b,
    istore_1 = 0x3c,
    istore_2 = 0x3d,
    istore_3 = 0x3e,
    iadd     = 0x60,
    isub     = 0x64,
    imul     = 0x68,
    idiv     = 0x6c,
    iinc     = 0x84,
    lcmp     = 0x94,
    ifeq     = 0x99,
    ifne     = 0x9a,
    iflt     = 0x9b,
    ifge     = 0x9c,
    ifgt     = 0x9d,
    ifle     = 0x9e,
    if_icmpeq= 0x9f,
    if_icmpne= 0xa0,
    if_icmplt= 0xa1,
    if_icmpge= 0xa2,
    if_icmpgt= 0xa3,
    if_icmple= 0xa4,
    _goto    = 0xa7,
    ireturn  = 0xac,
    _return  = 0xb1,
    invokestatic= 0xb8, //调用函数

    //自行扩展的操作码
    sadd     = 0x61,    //字符串连接
    sldc     = 0x13,    //把字符串常量入栈
}OpCode;

/////////////////////////////////////////////////////////
//栈机运行时的数据结构

/**
 * 操作数栈
 * 当栈为空的时候，top = -1;
 * */
typedef struct _OprandStack{
    VM_NUMBER * data; //数组
    int top;       //栈顶的索引值
}OprandStack;

typedef struct _StackFrame{
    //指向代码的指针
    unsigned char* byteCode;

    //返回地址
    int returnIndex;

    //本地变量数组
    VM_NUMBER* localVars;  

    //操作数栈
    OprandStack* oprandStack;

    //指向前一个栈桢的链接
    struct _StackFrame* prev;
}StackFrame;

StackFrame * createStackFrame(FunctionSymbol* functionSym);
void deleteStackFrame(StackFrame* frame);

void pushToOpStack(StackFrame* frame, VM_NUMBER value);
VM_NUMBER popFromOpStack(StackFrame* frame);

/////////////////////////////////////////////////////////
//代表一个BCModule的数据结构

typedef enum _ConstKind{NumberC, StringC, FunctionC} ConstKind;

typedef struct _Const{
    ConstKind kind;
}Const;

typedef struct _NumberConst{
    Const c;
    int value;
}NumberConst;

typedef struct _StringConst{
    Const c;
    char* value;
}StringConst;

typedef struct _FunctionConst{
    Const c;
    FunctionSymbol * functionSym;
}FunctionConst;

//模块
//代表一个可运行的程序
typedef struct _BCModule{
    int numConsts;
    Const ** consts;          //常量，目前包括整数和函数
    FunctionSymbol * _main;   //主函数入口
    int numTypes;
    Type ** types;
}BCModule;

#endif