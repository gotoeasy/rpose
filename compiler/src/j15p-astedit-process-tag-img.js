const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');
const postobject = require('@gotoeasy/postobject');
const fs = require('fs');

bus.on('编译插件', function(){
    
    // 针对img标签做特殊处理
    //   -- 复制图片资源并哈希化
    //   -- 图片路径加上替换用模板，便于不同目录页面使用时替换为正确的相对目录
    //   -- 上下文中保存是否包含img标签的标记，便于判断是否需替换目录
    return postobject.plugin(/**/__filename/**/, function(root, context){

        root.walk( 'Tag', (node, object) => {

            if ( !/^img$/i.test(object.value) ) return;
            context.result.hasImg = true;

            // 查找Attributes
            let attrsNode;
            for ( let i=0,nd; nd=node.nodes[i++]; ) {
                if ( nd.type === 'Attributes' ) {
                    attrsNode = nd;
                    break;
                }
            }
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return;    // 没有相关属性节点，跳过

            // 查找目标属性节点
            let srcAttrNode;
            for ( let i=0,nd; nd=attrsNode.nodes[i++]; ) {
                if ( /^src$/i.test(nd.object.name) ) {
                    srcAttrNode = nd;
                    break;
                }
            }
            if ( !srcAttrNode ) return;                                                 // 没有相关属性节点，跳过

            // 复制文件
            let imgname = hashImageName(context.input.file, srcAttrNode.object.value);
            if ( !imgname ) {
                throw new Err('image file not found', {file: context.input.file, text: context.input.text, start: srcAttrNode.object.loc.start.pos, end: srcAttrNode.object.loc.end.pos});
            }

            // 修改成替换用目录，文件名用哈希
            srcAttrNode.object.value = '%imagepath%' + imgname;

        }, {readonly:true});

    });

}());



function hashImageName(srcFile, imgFile){
    let file;
    if ( File.exists(imgFile) ) {
        file = imgFile;
    }else{
        file = File.resolve(srcFile, imgFile);
        if ( !File.exists(file) ) {
            return false;
        }
    }

    let name = hash({file}) + File.extname(file); // 去除目录，文件名哈希化，后缀名不变

    let oCache = bus.at('缓存');
    // 复制文件
    let distDir = oCache.path + '/resources';                                     // 统一目录，资源都复制到 %缓存目录%/resources
    let distFile = distDir + '/' + name;
    if ( !File.exists(distFile) ) {
        !File.existsDir(distDir) && File.mkdir(distDir);
        fs.copyFileSync(file, distFile);
    }

    return name;
}
