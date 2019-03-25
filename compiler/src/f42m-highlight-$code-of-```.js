const bus = require('@gotoeasy/bus');
const refractor = require('refractor')
const rehype = require('rehype')

// --------------------------------------------
// 自定义 inilike 高亮规则，分隔符为等号、冒号
// --------------------------------------------
inilike.displayName = 'inilike'
inilike.aliases = []
function inilike(Prism) {
  Prism.languages.inilike = {
    constant: /^[ \t]*[^\s=:]+?(?=[ \t]*[=:])/m,
    'attr-value': { pattern: /(=|:).*/, inside: { punctuation: /^(=|:)/  }  }
  }
}
refractor.register(inilike)
// --------------------------------------------



bus.on('highlight', function (codefile, oClass={}){

    return function (code='', lang='clike') {

        // 取语法高亮组件文件的绝对地址，用于哈希语法高亮的样式类
        if ( !codefile ) {
            let oPkg = bus.at('模块组件信息', '@rpose/buildin');
            oPkg.files.forEach(f => f.endsWith('```.rpose') && (codefile = f));
            oClass['token'] = bus.at('哈希样式类名', codefile, 'token');
            oClass['comment'] = bus.at('哈希样式类名', codefile, 'comment');
            oClass['selector'] = bus.at('哈希样式类名', codefile, 'selector');
        }

        // 特殊处理btf、rpose格式代码
        if ( /^(btf|rpose)$/i.test(lang) ) {
            let html = highlightBtfLike(code);
            return '<ol><li>' + html.split(/\r?\n/).join('</li><li>') + '</li></ol>';
        }

        // 转换改为 <ol><li> 形式显示
        !refractor.registered(lang) && (lang = 'clike');                                                   // 不支持的语言，默认按 clike 处理
        let html = highlight(code, lang);
        return '<ol><li>' + html.split(/\r?\n/).join('</li><li>') + '</li></ol>';
    }


    function highlightBtfLike(code){

        let html = [];
        let tokens = bus.at('BTF内容解析', code);
        tokens.forEach(token => {
            if ( token.type === 'BlockName' ) {
                html.push( btfBlockName('[' + token.name + ']') + btfComment(token.comment) );
            }else if ( token.type === 'BlockText' ) {
                let lang = token.name;
                if ( !refractor.registered(lang) ) {
                    if ( /^(actions|methods|options|state)$/i.test(lang) ) {
                        lang = 'js';
                    }else if (/^view$/i.test(lang)){
                        lang = 'markup';
                    }else{
                        lang = 'inilike';
                    }
                }
                html.push( highlight(token.value, lang) );
            }else if ( token.type === 'Comment' ) {
                html.push( btfComment(token.value) );
            }else {
                throw new Error('unknow type');
            }
        });
        return html.join('\n')
    }

    function btfComment(code){
        return code.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(\S+.*)/g, `<span class="${oClass['token']} ${oClass['comment']}">$1</span>`);    // 注释
    }
    function btfBlockName(code){
        return code.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(.*)/g, `<span class="${oClass['token']} ${oClass['selector']}">$1</span>`);   // 块名
    }

    function highlight(code, lang){
        let nodes = refractor.highlight(code, lang)
        renameClassName(nodes);                                                                   // 修改类名
        return rehype().stringify({type: 'root', children: nodes}).toString();
    }

    function renameClassName(nodes){
        nodes && nodes.forEach(node => {
            if ( node.properties && node.properties.className ) {
                let classes = [];
                node.properties.className.forEach( cls => {
                    !oClass[cls] && (oClass[cls] = bus.at('哈希样式类名', codefile, cls));  // 缓存
                    classes.push( oClass[cls] );
                });
                node.properties.className = classes;
            }
            renameClassName(node.children);
        });
    }




}());
