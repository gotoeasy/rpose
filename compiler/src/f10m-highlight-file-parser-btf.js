const bus = require('@gotoeasy/bus');

bus.on('BTF内容解析', function(){

    return function(text){
        let LF = text.indexOf('\r\n') >=0 ? '\r\n' : '\n';
        let lines = text.split(LF);

        let tokens = [];
        parse(tokens, lines);

        tokens.forEach(token => {
            if ( token.type === 'BlockText' ) {
                token.value = token.value.join(LF);
            }
        });

        return tokens;
    };

}());


function parse(tokens, lines) {

    let sLine,oName,comment,blockStart = false;
    for ( let i=0; i<lines.length; i++ ) {
        sLine = lines[i];

        if ( isBlockStart(sLine) ) {
            oName = getBlockName(sLine);
            comment = sLine.substring(oName.len + 2);
            tokens.push( {type: 'BlockName', name: oName.name, comment: comment} );         // 名称不含中括号
            blockStart = true;
        } else if ( isBlockEnd(sLine) ) {
            tokens.push( {type: 'Comment', value: sLine} );
            blockStart = false;
        } else if ( isDocumentEnd(sLine) ) {
            tokens.push( {type: 'Comment', value: sLine} );
            blockStart = false;
        } else {
            if ( blockStart ) {
                // text line
                if ( tokens[tokens.length-1].type !== 'BlockText' ) {
                    tokens.push( {type: 'BlockText', name: tokens[tokens.length-1].name, value: []} );
                }
                let oBlockText = tokens[tokens.length-1];
                oBlockText.value.push( sLine );
            } else {
                // ignore line
                tokens.push( {type: 'Comment', value: sLine} );
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
            return {name, len};
        }
    }

    name = sLine.substring(1, sLine.lastIndexOf(']')).toLowerCase();
    len = name.length;
    return {name, len};
}
