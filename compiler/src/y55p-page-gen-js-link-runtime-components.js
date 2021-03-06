const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const fs = require('fs');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;


        let srcRuntime = bus.at('RPOSE运行时代码');
        let srcStmt = getSrcRegisterComponents(allreferences, context.result.oTaglibs);
        let srcComponents = getSrcComponents(allreferences, context.result.oTaglibs);

        if ( context.result.allstandardtags.includes('img') ) {
            let oCache = bus.at('缓存');
            // 替换图片相对路径，图片不存在则复制
            let resourcePath = oCache.path + '/resources';
            let imgPath = bus.at('页面图片相对路径', context.input.file);
            srcComponents = srcComponents.replace(/%imagepath%([0-9a-zA-Z]+\.[0-9a-zA-Z]+)/g, function(match, filename){
                let from = resourcePath + '/' + filename;
                let to = env.path.build_dist + '/' + (env.path.build_dist_images ? (env.path.build_dist_images + '/') : '') + filename;
                File.existsFile(from) && !File.existsFile(to) && File.mkdir(to) > fs.copyFileSync(from, to);
                return imgPath + filename;
            });
        }

        if ( srcComponents.indexOf('%svgsymbolpath%') > 0 ) {
            // 替换图标相对路径
            let imgPath = bus.at('页面图片相对路径', context.input.file);
            srcComponents = srcComponents.replace(/%svgsymbolpath%/g, imgPath);
        }

        let tagpkg = context.result.tagpkg;

        let src = `
                ${srcRuntime}

                (function($$){

                    ${srcComponents}

                    // 组件注册
                    ${srcStmt}

                    // 组件挂载
                    rpose.mount( rpose.newComponentProxy('${tagpkg}').render(), '${context.doc.mount}' );
                })(rpose.$$);
            `;

        context.result.pageJs = src;

    });

}());



// 组件注册语句
function getSrcRegisterComponents(allreferences, oTaglibs){
    try{
        let obj = {};
        for ( let i=0,tagpkg,key,file; tagpkg=allreferences[i++]; ) {
            key = "'" + tagpkg + "'";

            file = bus.at('标签源文件', tagpkg, oTaglibs);
            if ( !File.exists(file) ) {
                throw new Err('component not found (tag = ' + tagpkg + ')');
            }

            obj[key] = bus.at('组件类名', file);
        }

        return `rpose.registerComponents(${JSON.stringify(obj).replace(/"/g,'')});`;
    }catch(e){
        throw Err.cat('gen register stmt failed', allreferences, e);
    }
}

// 本页面关联的全部组件源码
function getSrcComponents(allreferences, oTaglibs){
    try{
        let ary = [];
        for ( let i=0,tagpkg,context; tagpkg=allreferences[i++]; ) {
            let tagSrcFile = bus.at('标签源文件', tagpkg, oTaglibs);
            context = bus.at('组件编译缓存', tagSrcFile);
            if ( !context ) {
                context = bus.at('编译组件', tagSrcFile);
            }
            ary.push( context.result.componentJs );
        }
        return ary.join('\n');
    }catch(e){
        throw Err.cat('get component src failed', allreferences, e);
    }
}
