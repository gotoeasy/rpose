const bus = require('@gotoeasy/bus');

const SOF = '\u0000'; // HTML解析：开始符
const EOF = '\uffff'; // HTML解析：结束符


// ------------ 字符阅读器 ------------
class CharReader{
	constructor(src) {
		this.ary = src.split('');
		this.maxLength = this.ary.length;
		this.pos = 0;
	}

	skip(len){
		if ( len > 0 ) {
			this.pos = this.pos + len;
			if ( this.pos > this.maxLength ) {
				this.pos = this.maxLength;
			}
		}
		return this.pos;
	}

	skipBlank(){
		// 跳过任何空白
		let rs = '';
		while ( /\s/.test(this.getCurrentChar()) && !this.eof() ) {
			rs += this.readChar();
		}
		return rs;
	}

//	setPos(pos){
//		this.pos = pos;
//	}

	getPos(){
		return this.pos;
	}

	eof(){
		return this.pos >= this.maxLength;
	}

	readChar(){
		let rs = this.getCurrentChar();
		(this.pos < this.maxLength) && (this.pos += 1);
		return rs;
	}

	getPrevChar(){
		return this.pos == 0 ? SOF : this.ary[this.pos-1];
	}
	getCurrentChar(){
		return this.pos >= this.maxLength ? EOF : this.ary[this.pos];
	}
	getNextChar(len = 1){
		let idx = len < 1 ? 1 : len;
		return (this.pos + idx) >= this.maxLength ? EOF : this.ary[this.pos+idx];
	}
	getChar(idx=0){
		return idx < 0 ? SOF : (idx >= this.maxLength ? EOF : this.ary[idx]);
	}

	getPrevString(len){
		return this.getString(this.pos-len, this.pos);
	}
	getString(start, end){
		let min = start<0 ? 0 : (start>=this.maxLength ? (this.maxLength-1) : start);
		let max = end<0 ? 0 : (end>this.maxLength ? this.maxLength : end);

		let rs = '';
		for(let i=min; i<max; i++){
			rs += this.ary[i];
		}
		return rs;
	}
	getNextString(len){
		return this.getString(this.pos, this.pos+len);
	}

}



module.exports = bus.on('字符阅读器', function(srcView){
    return new CharReader(srcView);
});

