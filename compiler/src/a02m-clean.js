const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');

bus.on('clean', function(){

    return () => {
        try{
            let env = bus.at('编译环境');
            if ( env.clean ) {
                File.remove(env.path.build);
                console.info('clean:', env.path.build);
            }

            File.mkdir(env.path.build_dist);
        }catch(e){
            throw Err.cat(' clean failed', e);
        }
    }

}());
