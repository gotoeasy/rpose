// ---------------------------
// 全局常量
// ---------------------------
const IS_IE = window == document && document != window;

/*
checked             (input type=checkbox/radio)
selected            (option)
disabled            (input, textarea, button, select, option, optgroup)
readonly            (input type=text/password, textarea)
multiple            (select,input)
ismap     isMap     (img, input type=image)

defer async draggable              (script)
declare             (object; never used)
noresize  noResize  (frame)
nowrap    noWrap    (td, th; deprecated)
noshade   noShade   (hr; deprecated)
compact             (ul, ol, dl, menu, dir; deprecated)

autofocus

autocomplete autoplay loop muted preload  required open translate
*/
// 布尔型属性，不常用部分需要时再添加
const BOOL_PROPS = ['autofocus', 'hidden', 'readonly', 'disabled', 'checked', 'selected', 'multiple', 'translate', 'draggable', 'noresize'];

// 一个特殊的state属性名，用于设定虚拟子节点数组
const $SLOT = '$SLOT';