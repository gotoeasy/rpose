const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        root.walk( /^(Text|EscapeExpression|UnescapeExpression)$/, (node, object) => {
            // 合并连续的文本节点
            let ary = [node];
            let nAfter = node.after();
            while ( nAfter && (nAfter.type === 'Text' || nAfter.type === 'EscapeExpression' || nAfter.type === 'UnescapeExpression') ) {
                ary.push(nAfter);
                nAfter = nAfter.after();
            }

            if ( ary.length < 2 ) return;

            // TODO 有必要考虑转义吗？
            let aryRs = [], tmp;
            ary.forEach(nd => {
                if ( nd.type === 'Text' ) {
                    aryRs.push('"' + lineString(nd.object.value) + '"');
                }else if ( nd.type === 'EscapeExpression' ) {
                    tmp = nd.object.value.trim();
                    tmp = tmp.substring(1, tmp.length-1);
                    aryRs.push('(' + tmp + ')');
                }else if ( nd.type === 'UnescapeExpression' ) {
                    tmp = nd.object.value.trim();
                    tmp = tmp.substring(2, tmp.length-1);
                    aryRs.push('(' + tmp + ')');
                }
            });

            let value = '{' + aryRs.join(' + ') + '}';
            let start = ary[0].object.loc.start;
            let end = ary[ary.length-1].object.loc.end;
            let loc = {start, end};
            let tNode = this.createNode({type: 'UnescapeExpression', value, loc});
            node.before(tNode);
            ary.forEach(nd => nd.remove());
        });

    });

}());


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
//    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}

