// ---------------------------
// DOM挂载
// ---------------------------
function mount(dom, selector, context){
	dom && (context || document).querySelector(selector || 'body').appendChild(dom);
}
