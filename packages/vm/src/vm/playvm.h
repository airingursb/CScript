//一些全局的预定义，放在这里

#ifndef PLAYSCRIPT_PLAYVM
#define PLAYSCRIPT_PLAYVM

//是否使用Arena内存管理机制
#define USE_ARENA

//Arena中，每个内存块的大小
#define ARENA_BLOCK_SIZE 4096

//系统内置类型的数量
#define SYS_TYPES 9

//系统内置函数的数量
#define SYS_FUNS 3

#define VM_NUMBER int  //栈机运算的数据类型
// #define VM_NUMBER long  //栈机运算的数据类型

#endif
