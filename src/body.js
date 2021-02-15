const themeColor = document.querySelector('meta[name=theme-color]');
var metaData = {
  kind  : 'theme-color',
  value :  themeColor ? themeColor.getAttribute('content') : null,
}

browser.runtime.sendMessage(metaData);
