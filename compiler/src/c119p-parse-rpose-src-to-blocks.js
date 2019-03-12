const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
    return postobject.plugin(__filename, function(root, context){

        let input = context.input;
        let result = context.result;

        root.walk( (node, object) => {

            // 保存输入
            input.file = object.file
            input.text = object.text;

            result.tagpkg = bus.at('标签全名', object.file);

            // 解析源码块
            let blocks = bus.at('RPOSE源文件解析', object.text);

            // 转换为树节点并替换
            let newNode = this.createNode(blocks);
            node.replaceWith(...newNode.nodes);     // 一个Block一个节点

            return false;
        });

    });

}());



// ---------------------------------------------------
// RPOSE源文件解析
// ---------------------------------------------------
bus.on('RPOSE源文件解析', function(){

    return function(text, keepLoc=true){
        let LF = text.indexOf('\r\n') >=0 ? '\r\n' : '\n';
        let lines = text.split(LF);
        let lineCounts = lines.map(v => v.length + LF.length);

        let nodes = [];
        parse(nodes, lines, lineCounts, LF);

        nodes.forEach(block => {
            if ( block.buf.length ) {
                let type = 'RposeBlockText';
                let value = block.buf.join(LF);
                let line = block.name.loc.start.line + 1;
                let column = 1;
                let pos = sumLineCount(lineCounts, line-1);
                let start = {line, column, pos};

                line = block.name.loc.start.line + block.buf.length;
                column = block.buf[block.buf.length-1].length + 1;
                pos = sumLineCount(lineCounts, line-1) + column;

                if ( column === 1 && block.buf.length > 1 ) {
                    line--;
                    column = block.buf[block.buf.length-2].length + 1;
                }
                end = {line, column, pos};

                block.text = { type, value, loc:{start, end} }
            }
            delete block.buf;
            if ( keepLoc === false ) {
                delete block.name.loc;
                block.comment !== undefined && delete block.comment.loc;
                block.text !== undefined && delete block.text.loc;
            }
        });
        return {nodes};
    };

}());


function parse(blocks, lines, lineCounts, lf) {

    let sLine,block,oName,name,comment,value,blockStart = false;
    for ( let i=0; i<lines.length; i++ ) {
        sLine = lines[i];

        if ( isBlockStart(sLine) ) {
            block = {type: 'RposeBlock'};
            oName = getBlockName(sLine);
            comment = sLine.substring(oName.len + 2);      // 块注释
            
            let line = i+1;
            let column = 1;
            let pos = sumLineCount(lineCounts, line-1);
            let start = {line, column, pos};
            column = oName.len+3;
            pos += column - 1;
            end = {line, column, pos};

            block.name = {type: 'RposeBlockName', value: oName.name, loc:{start, end} };            // 位置包含中括号
            if ( comment ) {
                column = oName.len+3;
                start = {line, column, pos};
                column = sLine.length + 1;
                pos = sumLineCount(lineCounts, line-1) + column - 1;
                end = {line, column, pos};
                block.comment = {type: 'RposeBlockComment', value: comment, loc:{start, end} };     // 注释
            }
            block.buf = [];

            blocks.push(block);
            blockStart = true;

        } else if ( isBlockEnd(sLine) ) {
            blockStart = false;
        } else if ( isDocumentEnd(sLine) ) {
            return;
        } else {
            if ( blockStart ) {
                // text line
                let buf = blocks[blocks.length-1].buf;
                if ( sLine.charAt(0) === '\\' && (/^\\+\[.*\]/.test(sLine) || /^\\+\---------/.test(sLine) || /^\\+\=========/.test(sLine)) ) {
                    buf.push( sLine.substring(1) );    // 去除转义字符，拼接当前Block内容
                }else{
                    buf.push( sLine );
                }
            } else {
                // ignore line
            }
        }

    }

}

function isBlockStart(sLine) {
    return sLine.startsWith('[') && sLine.indexOf(']') > 0;
}

function isBlockEnd(sLine) {
    return sLine.startsWith('---------');
}

function isDocumentEnd(sLine) {
    return sLine.startsWith('=========');
}

function getBlockName(sLine) {
    let name, len;
    for ( let i=1; i<sLine.length; i++) {
        if ( sLine.charAt(i-1) !== '\\' && sLine.charAt(i) === ']' ) {
            name = sLine.substring(1, i).toLowerCase();
            len = name.length;
            name = name.replace(/\\\]/g, ']');             // 名称部分转义 [\]] => ]; 
            return {name, len};
        }
    }

    name = sLine.substring(1, sLine.lastIndexOf(']')).toLowerCase();
    len = name.length;
    name = name.replace(/\\\]/g, ']'); // 最后一个]忽略转义 [\] => \; [\]\] => ]\
    return {name, len};
}

function sumLineCount(lineCounts, lineNo){
    let rs = 0;
    for ( let i=0; i<lineNo; i++ ) {
        rs += lineCounts[i];
    }
    return rs;
}

