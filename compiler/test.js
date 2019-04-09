const test = require('ava');
const compiler = require('./index');
const File = require('@gotoeasy/file');

test('测试项目编译后的组件源码是否符合预期', async t => {

    let opts = {};
    opts.cwd =  File.resolve(__dirname, 'test-project');
    opts.clean = true;
    opts.release = false;
    opts.debug = false;
    opts.nocache = true;
    opts.build = true;
    
    await compiler.build(opts);

    let rs = diff(opts);
    t.is( rs, true );
    rs && File.remove(opts.cwd + '/build');

});

function diff(opts){

    let dir1 = opts.cwd + '/build/temp';
    let dir2 = opts.cwd + '/expect/temp';
    
    let map = new Map();
    let files = File.files(dir1, '**.*');
    files.forEach(file => {
        map.set(file.substring(dir1.length+1), File.read(file));
    })
    files = File.files(dir2, '**.*');
    if ( map.size !== files.length ) {                      // 文件数量比较
        console.log('file count unmatch:',dir1, dir2);
        return false;
    }

    for ( let i=0,file,name,text; file=files[i++]; ) {
        name = file.substring(dir2.length+1);
        text = File.read(file);
        if ( map.get(name) !== text ) {                     // 文件内容比较
            console.log('file content unmatch:', name);
            return false;
        }
    }
    return true;
}
