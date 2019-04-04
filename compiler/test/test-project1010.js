const test = require('ava');
const compiler = require('../index');
const File = require('@gotoeasy/file');


test('样式类名测试', async t => {
	
    let opts = {};
    opts.clean = true;
    opts.release = true;
    opts.debug = false;
    opts.nocache = true;
    opts.cwd = File.resolve(__dirname, 'project1010');
    opts.build = true;
    
    await compiler.build(opts);

	t.is(1, 1);

});
