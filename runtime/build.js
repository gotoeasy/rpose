const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');

let src = File.concat( File.resolve(__dirname, 'src') );	// 把src目录中的js文件排序后合并
src = csjs.formatJs(src, true);                             // 删除注释

let file = File.resolve(__dirname, 'runtime.js');
File.write(file, src);

console.log('file: runtime.js');
