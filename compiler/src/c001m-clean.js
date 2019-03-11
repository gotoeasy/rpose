const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');

const MODULE = '[' + __filename.substring(__filename.replace(/\\/g, '/').lastIndexOf('/')+1, __filename.length-3) + ']';

bus.on('clean', function(){

	return () => {
		try{
			let env = bus.at('编译环境');
console.info(MODULE, env.clean);
			if ( env.clean ) {
				File.remove(env.path.build);
				console.info(MODULE, 'clean:', env.path.build);
			}
		}catch(e){
			throw Err.cat(MODULE + ' clean failed', e);
		}
	}

}());
