let indexedColorMap   = new Array();
let indexedStateMap   = new Array();
let currentActiveTab  = null;
let pendingApplyColor = null;

/* Config and storage */

var configData = {
  enableBorder      : false,
  enableGradient    : false,
  enableAccent      : true,
  enableTabLine     : true,
  enableToolbarOverride : true
}

function checkStoredSettings(item) {
  if (!item.configData) {
    browser.storage.local.set({configData});
  } else {
    configData = item.configData;
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

var gettingItem = browser.storage.local.get();
gettingItem.then(checkStoredSettings, onError);

/* This is more aggressive override..*/
let isFirstRun = true;

function shouldSkipUrl(url){
  let shouldSkip = false;
  if(url === "about:newtab" || url === "about:blank") {
    if(isFirstRun) {
      isFirstRun = false;
      shouldSkip = false;
    } else {
      shouldSkip = true;
    }
  }
  return shouldSkip;
}

function updateActiveTab_pageloaded(tabId, changeInfo) {
      function updateTab(tabs) {
        if (tabs[0]) {
          var tabURLkey = tabs[0].url;
          if(shouldSkipUrl(tabURLkey)) {
            return;
          }

          if(pendingApplyColor) {
            indexedStateMap[tabURLkey] = 3;
            pendingApplyColor = null;
          }

          if(indexedStateMap[tabURLkey] != 3 && changeInfo.status == 'complete') {
            currentActiveTab = tabURLkey;
            var capturing = browser.tabs.captureVisibleTab();
            capturing.then(onCaptured, onError);
          }
        }
      }
      var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
      gettingActiveTab.then(updateTab);
}
function updateTab(tabs) {
    if (tabs[0]) {
      var tabURLkey = tabs[0].url;
      if(shouldSkipUrl(tabURLkey)) {
        return;
      }
      if(pendingApplyColor) {
        indexedStateMap[tabURLkey] = 3;
        pendingApplyColor = null;
      }

      if(tabURLkey in indexedColorMap) {
        let colorObject = indexedColorMap[tabURLkey];

        let color = {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
        };

        let themeProposal = util_themePackage(color);
        themeProposal.colors = colorObject;
        util_custom_update(themeProposal);

      } else {
        currentActiveTab = tabURLkey;
        var capturing = browser.tabs.captureVisibleTab();
        capturing.then(onCaptured, onError);
      }
    }
}

function updateActiveTab() {
    var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
    gettingActiveTab.then(updateTab);
}

// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/captureVisibleTab
function onCaptured(imageUri) {
  let canvas = document.createElement('canvas');
  canvas.width  = 100;
  canvas.height = 100;
  canvasContext = canvas.getContext('2d');
  //canvasContext.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
  let image = document.createElement('img');

  image.onload = function() {
    canvasContext.drawImage(image, 0,0);
    canvasData = canvasContext.getImageData(0, 0, 100, 10).data;
    canvasIndex = 710*4;

    let color = {
        r     : canvasData[canvasIndex],
         g    : canvasData[canvasIndex + 1],
          b   : canvasData[canvasIndex + 2],
        alpha : canvasData[canvasIndex + 3]
    };

    let themeProposal = util_themePackage(color);

    if(currentActiveTab) {
      indexedColorMap[currentActiveTab] = themeProposal.colors;
    }

    util_custom_update(themeProposal);
  }
  image.src=imageUri;
}

function onError(error) {
  console.log(`Error: ${error}`);
}

/*
   Utils
*/

function util_custom_update(themeProposal) {
  let themeProposal_copy = JSON.parse(JSON.stringify(themeProposal));
  if(configData.enableBorder) {
    delete themeProposal_copy.colors.toolbar_bottom_separator;
  }
  if(!configData.enableGradient) {
    delete themeProposal_copy.images;
    delete themeProposal_copy.properties;
  }
  if(!configData.enableAccent) {
    delete themeProposal_copy.colors.accentcolor;
  }
  if(!configData.enableToolbarOverride) {
    delete themeProposal_copy.colors.toolbar;
  }
  if(!configData.enableTabLine) {
    delete themeProposal_copy.colors.tab_line;
  }

  browser.theme.update(themeProposal_copy);
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function util_hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function util_themePackage(color) {

  // http://stackoverflow.com/a/3943023/112731
  let textC = (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) > 186 ? 0 : 255;
  let adjust = -25;

  const backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
  const dimmedBackgroundColor = `rgba(${color.r + adjust}, ${color.g + adjust}, ${color.b + adjust}, 1)`;
  const textColor = `rgb(${textC}, ${textC}, ${textC})`;
  const transparentTextColor = `rgba(${textC}, ${textC}, ${textC}, 0.25)`;
  let colorObject = {
    bookmark_text: textColor,
    button_background_active: dimmedBackgroundColor,
    button_background_hover: backgroundColor,
    frame_inactive: backgroundColor,
    frame: dimmedBackgroundColor,
    icons_attention: textColor,
    icons: textColor,
    ntp_background: backgroundColor,
    ntp_text: textColor,
    popup_border: transparentTextColor,
    popup_highlight_text: dimmedBackgroundColor,
    popup_highlight: textColor,
    popup_text: textColor,
    popup: backgroundColor,
    sidebar_border: backgroundColor,
    sidebar_highlight_text: dimmedBackgroundColor,
    sidebar_highlight: textColor,
    sidebar_text: textColor,
    sidebar: backgroundColor,
    tab_background_separator: backgroundColor,
    tab_background_text: textColor,
    tab_line: transparentTextColor,
    tab_loading: textColor,
    tab_selected: backgroundColor,
    tab_text: textColor,
    toolbar_bottom_separator: backgroundColor,
    toolbar_field_border_focus: transparentTextColor,
    toolbar_field_border: backgroundColor,
    toolbar_field_focus: backgroundColor,
    toolbar_field_highlight_text: textColor,
    toolbar_field_highlight: transparentTextColor,
    toolbar_field_separator: "rgba(255, 255, 255, 0)",
    toolbar_field_text_focus: textColor,
    toolbar_field_text: textColor,
    toolbar_field: backgroundColor,
    toolbar_top_separator: transparentTextColor,
    toolbar_vertical_separator: backgroundColor,
    toolbar: backgroundColor
  };


  let themeProposal = {
    colors : colorObject,
    images : {
      additional_backgrounds : [ "background.svg"]
    },
    properties: {
      additional_backgrounds_alignment : [ "top" ],
      additional_backgrounds_tiling    : [ "repeat"  ]
    }

  }

  return themeProposal;
}

/*
  Main exec functions

*/

browser.tabs.onUpdated.addListener(updateActiveTab_pageloaded);
browser.tabs.onActivated.addListener(updateActiveTab);
browser.windows.onFocusChanged.addListener(updateActiveTab);

updateActiveTab();
