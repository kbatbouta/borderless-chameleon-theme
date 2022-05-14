// 
// -----------------------------
var node = null, colorStr = null;
node = document.querySelector('meta[name="theme-color"]');
// check if we were able to find the node.
if (node) {
    colorStr = node.getAttribute("content");
}
// -----------------------------
// we have to have this line so we can passback the result to background.js.
colorStr;