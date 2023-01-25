playvm : rt_objs
	@echo "生成c语言版本的虚拟机vm..."
	gcc -o $@ src/vm/*.c src/rt/*.o
	rm -rf dist && mkdir dist
	mv playvm dist/playvm

rt_objs :
	@echo "编译运行时库..."
	cd src/rt && gcc -c -O2 *.c

.PHONY : clean
clean :
	@echo "删除rt/*.o vm..."
	@-rm -fr src/rt/*.o vm

