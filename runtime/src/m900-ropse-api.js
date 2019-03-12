// ---------------------------
// API
// ---------------------------
var api = {};

api.$$ = $$; // 常用DOM操作

api.registerComponents = registerComponents;
api.newComponentProxy = newComponentProxy;

api.createDom = createDom;
api.escapeHtml = escapeHtml;

api.mount = mount;

api.extend = extend;
api.assign = assign;


api.on = BUS.on;
api.off = BUS.off;
api.once = BUS.once;
api.at = BUS.at;

api.router = Router;

// 仅支持浏览器
window.rpose = api;

