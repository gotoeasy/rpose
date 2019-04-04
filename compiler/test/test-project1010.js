const test = require('ava');
const compiler = require('../index');
const File = require('@gotoeasy/file');


test('样式类名测试', async t => {

    let opts = {};
    opts.cwd =  File.resolve(__dirname, '../test-projects/project1010');
    opts.clean = true;
    opts.release = false;
    opts.debug = false;
    opts.nocache = false;
    opts.build = true;
    
    await compiler.build(opts);

	t.is(1, 1);

});
