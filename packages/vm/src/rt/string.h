#ifndef STRING_H
#define STRING_H

#include "object.h"
#include <string.h>

typedef struct _PlayString{
    Object object;
    size_t length;       //字符串的长度。
    //以0结尾的字符串，以便复用C语言的一些功能。实际占用内存是length+1。
    //我们不需要保存这个指针，只需要在PlayString的基础上增加一个偏移量就行。
    char* data;     
}PlayString;

PlayString* string_create_by_length(size_t length);

PlayString* string_create_by_str(const char* str);

void string_destroy(PlayString* str);

int string_length(PlayString * str);

PlayString* string_concat(PlayString* str1, PlayString* str2);

#endif

