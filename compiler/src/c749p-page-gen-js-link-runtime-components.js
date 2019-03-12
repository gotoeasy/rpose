const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;


        let srcRuntime = bus.at('RPOSE运行时代码');
        let srcStmt = getSrcRegisterComponents(allreferences);
        let srcComponents = getSrcComponents(allreferences);
        let tagpkg = context.result.tagpkg;

        let src = `
                ${srcRuntime}

                (function($$){
                    // 组件注册
                    ${srcStmt}

                    ${srcComponents}

                    // 组件挂载
                    rpose.mount( rpose.newComponentProxy('${tagpkg}').render(), '${context.doc.mount}' );
                })(rpose.$$);
            `;

        context.result.pageJs = src;

        if ( !env.release ) {
            let file = env.path.build_temp + '/' + bus.at('组件目标文件名', context.input.file) + '.js';
            File.write(file, csjs.formatJs(src) );
        }
    });

}());



// 组件注册语句
function getSrcRegisterComponents(allreferences){
    try{
        let obj = {};
        for ( let i=0,tagpkg,key,file; tagpkg=allreferences[i++]; ) {
            key = "'" + tagpkg + "'";

            file = bus.at('标签源文件', tagpkg);
            if ( !File.exists(file) ) {
                throw new Err('component not found (tag = ' + tagpkg + ')');
            }

            obj[key] = bus.at('组件类名', file);
        }

        return `rpose.registerComponents(${JSON.stringify(obj).replace(/"/g,'')});`;
    }catch(e){
        throw Err.cat(MODULE + 'gen register stmt failed', allreferences, e);
    }
}

// 本页面关联的全部组件源码
function getSrcComponents(allreferences){
    try{
        let ary = [];
        for ( let i=0,tagpkg,context; tagpkg=allreferences[i++]; ) {
            context = bus.at('编译组件', tagpkg);
            ary.push( context.result.componentJs );
        }
        return ary.join('\n');
    }catch(e){
        throw Err.cat(MODULE + 'get component src failed', allreferences, e);
    }
}
