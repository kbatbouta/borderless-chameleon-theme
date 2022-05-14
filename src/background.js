/* consts */

const regexpRGBA = /(?<red>[0-9]+(\.[0-9]+)?)\s*,\s*(?<green>[0-9]+(\.[0-9]+)?)\s*,\s*(?<blue>[0-9]+(\.[0-9]+)?)(\s*,\s*(?<alpha>[0-9]+(\.[0-9]+)?))?/mg;

/* variables */

let indexedColorMap   = new Array();
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

function captureColor(tabs) {
  if (tabs[0]) {
    var tabURLKey = tabs[0].url;
    var tabId = tabs[0].id;
    // console.log(`[IMPORTANT] capturing color for ${tabURLKey}`);

    function executed(results) {
      if (results[0]) {
        try{
          // console.log(`Error: got result back and it is ${results[0]}`);
          var color = util_parseColor(results[0]);
          if (color != null) {
            let theme = util_themePackage(color);
            indexedColorMap[tabURLKey] = {
              theme : theme,
              color : color,
              time : Date.now()
            };
            util_custom_update(theme);
            return;
          }
        } catch(er) {
          console.log(`Error: ${er}`);
          // will fallback to image capture on parsing errors.
        }
      }
      // As a fallback we capture a screen shot of the page and work with that.
      // (Legacy approach)      
      currentActiveTab = tabURLKey;
      browser.tabs.captureVisibleTab().then(onImageCapture, onError);       
    }

    // we first try to use the meta color-schema color that is provided by the page devs.    
    browser.tabs.executeScript(tabId, {
      file: "/content-script.js"    
    }).then(executed);
  }
}

function updateActiveTab_pageloaded(tabId, changeInfo) {
      function fulfilled(tabs) {                
        if (tabs[0] && changeInfo.status == 'complete') {
          updateTab(tabs);
        }        
      }
      var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
      gettingActiveTab.then(fulfilled);
}

function updateTab(tabs) {
    if (tabs[0]) {
      var tabURLkey = tabs[0].url;
      // check if we need to skip this page (new age or blank pages)
      if(shouldSkipUrl(tabURLkey)) {
        return;
      }      

      if(tabURLkey in indexedColorMap) {
        let data = indexedColorMap[tabURLkey];

        // we apply the theme regardless of its age for a more interactive experience.
        util_custom_update(data.theme);

        if(Date.now() - data.time < 1800000) {
          // this theme is still fresh.
          util_custom_update(data.theme);
          // console.log(`loaded from cache for ${tabURLkey}`);
          return;                    
        }
        // we recapture the theme every once in a while.
        delete indexedColorMap[tabURLkey];
      }
      captureColor(tabs);      
    }
}

function updateActiveTab() {
    var gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
    gettingActiveTab.then(updateTab);
}

// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/captureVisibleTab
function onImageCapture(imageUri) {
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
      indexedColorMap[currentActiveTab] = {
        theme : themeProposal,
        color : color,
        time : Date.now()
      };
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

function util_parseColor(str){
  var s = str.trim();
  if (s.startsWith("#")) {
    return util_hexToRgb(str);
  } else if(s.startsWith("rgb")){   
    // this is able to parse rgba colors as well. 
    var match = regexpRGBA.exec(str);
    if (match) {
      return {
        r : parseFloat(match.groups.red),
        g : parseFloat(match.groups.green),
        b : parseFloat(match.groups.blue),
        alpha : match.groups.alpha ? parseFloat(match.groups.alpha) : 1.0,
      };
    }
  }
  return null; 
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function util_hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        alpha: result[4] ? parseInt(result[4], 16) : 1.0
    } : null;
}

// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function util_hslToRgb(color) {
  var h = color.h;
  var s = color.s;
  var l = color.l;
  var r, g, b;
  var alpha = color.alpha;   
  if(s == 0){
      r = g = b = l;
  }else{
    var hue2rgb = function hue2rgb(p, q, t){
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }  
  return {
    r : r * 255,
    g : g * 255, 
    b : b * 255,
    alpha : alpha
  }
}

// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function util_rgbToHsl(color){
  var r = color.r / 255;
  var g = color.g / 255;
  var b = color.b / 255;  
  var alpha = color.alpha;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if(max == min){
    h = s = 0; // achromatic
  }else{
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max){
      case r: h = (g - b) / d + (g < b ? 6 : 0); 
      break;
      case g: h = (b - r) / d + 2; 
      break;
      case b: h = (r - g) / d + 4; 
      break;
    }
    h /= 6;
  }
  return {
    h : h,
    s : s, 
    l : l,
    alpha : alpha
  }
}

function util_adjustColor(color) {
  // convert the input rgb color to hsl.
  let colorHsl = util_rgbToHsl(color);
  // return the new color in rgb.
  return util_hslToRgb(colorHsl);
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
    frame: backgroundColor,
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
    tab_line: dimmedBackgroundColor,
    tab_loading: textColor,
    tab_selected: transparentTextColor,
    tab_text: textColor,
    toolbar_bottom_separator: backgroundColor,
    toolbar_field_border_focus: transparentTextColor,
    toolbar_field_border: backgroundColor,
    toolbar_field_focus: backgroundColor,
    toolbar_field_highlight_text: textColor,
    toolbar_field_highlight: transparentTextColor,
    toolbar_field_text_focus: textColor,
    toolbar_field_text: textColor,
    toolbar_field: backgroundColor,
    toolbar_top_separator: backgroundColor,
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
