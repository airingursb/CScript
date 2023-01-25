/**
 * 对象的内存布局
 * 
 * */

#ifndef OBJECT_H
#define OBJECT_H

typedef struct _Object{
    unsigned int flags;   //与并发、垃圾收集有关的标志位
}Object;

#endif