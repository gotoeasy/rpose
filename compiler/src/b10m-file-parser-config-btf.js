const bus = require('@gotoeasy/bus');

// ---------------------------------------------------
// 项目配置文件解析
// ---------------------------------------------------
bus.on('项目配置文件解析', function(){

    return function(text, keepLoc=true){
        let lines = text.split('\n');                                               // 行内容包含换行符
        let lineCounts = [];                                                        // 行长度包含换行符
        for ( let i=0,max=lines.length; i<max; i++ ) {
            lines[i] += '\n';                                                       // 行内容包含换行符
            lineCounts[i] = lines[i].length;                                        // 行长度包含换行符
        }

        let nodes = [];
        parse(nodes, lines, lineCounts);

        nodes.forEach(block => {
            if ( block.buf.length ) {
                let type = 'ProjectBtfBlockText';
                let lastLine = block.buf.pop();

                // 值
                block.buf.push(lastLine.replace(/\r?\n$/, ''));                     // 删除最后一行回车换行符
                let value = block.buf.join('');                                     // 无损拼接

                // 开始位置
                let start = {pos: sumLineCount(lineCounts, block.name.loc.start.line+1)}; // 块内容开始位置（即块名行为止合计长度）

                // 结束位置
                let line = block.name.loc.start.line + block.buf.length;            // 结束行
                let column = block.buf[block.buf.length-1].length;                  // 结束列
                let pos = sumLineCount(lineCounts, line) + column;                  // 结束位置
                let end = {line, column, pos};

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


function parse(blocks, lines, lineCounts) {

    let sLine,block,oName,comment,blockStart = false;
    for ( let i=0; i<lines.length; i++ ) {
        sLine = lines[i];

        if ( isBlockStart(sLine) ) {
            // 当前是块名行 [nnn]
            block = {type: 'ProjectBtfBlock'};
            oName = getBlockName(sLine);                                        // oName.len包含转义字符长度
            comment = sLine.substring(oName.len + 2).replace(/\r?\n$/, '');     // 块注释，忽略换行符
            
            let line = i;                                                       // 行号，下标从0开始
            let column = 0;                                                     // 列号，下标从0开始(计中括号)
            let pos = sumLineCount(lineCounts, line);
            let start = {line, column, pos};                                    // 起始位置信息
            column = oName.len + 2;
            pos += column;
            let end = {line, column, pos};                                      // 结束位置信息

            block.name = {type: 'ProjectBtfBlockName', value: oName.name, loc:{start, end} };            // 位置包含中括号
            if ( comment ) {
                start = Object.assign({}, end);                                 // 注释的开始位置=块名的结束位置
                column = start.column + comment.length;
                pos = start.pos + comment.length;
                end = {line, column, pos};
                block.comment = {type: 'ProjectBtfBlockComment', value: comment, loc:{start, end} };     // 注释(不计换行符)
            }
            block.buf = [];

            blocks.push(block);
            blockStart = true;

        } else if ( isBlockEnd(sLine) ) {
            // 当前是块结束行 ---------
            blockStart = false;
        } else if ( isDocumentEnd(sLine) ) {
            // 当前是文档结束行 =========
            return;
        } else {
            if ( blockStart ) {
                // 当前是块内容行
                let buf = blocks[blocks.length-1].buf;
                if ( sLine.charAt(0) === '\\' && (/^\\+\[.*\]/.test(sLine) || /^\\+---------/.test(sLine) || /^\\+=========/.test(sLine)) ) {
                    buf.push( sLine.substring(1) );                             // 去除转义字符，拼接当前Block内容
                }else{
                    buf.push( sLine );
                }
            } else {
                // 当前是注释行(比如，块结束行之后，块开始行之前)
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
            name = name.replace(/\\\]/g, ']');              // 名称部分转义 [\]] => ]; 
            return {name, len};                             // len包含转义字符长度
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

