if [ $1 = '--ast' ] ; then
  node packages/ast-interpreter/dist/index.js $2
fi

if [ $1 = '--ts-vm' ] ; then
  node packages/ts-vm/dist/index.js $2
fi
