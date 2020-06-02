// NOTE: The purpose of this appears to be to intercept certain events in the
// browser window and pump message events back to the app.  In particular it
// registers onload and onscroll event handlers so we can track when pages are
// loaded, and when they are scrolled (and how far down they are scrolled)
const injectionJS = `(${String(function() {
  var start = Date.now();
  var scrollCounter = 0;
  var maxScrollReached = 0;
  window.addEventListener('load', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      appTag: 'renewal',
      event: 'load',
      timestamp: Date.now(),
      contentSizeX: document.documentElement.scrollWidth,
      contentSizeY: document.documentElement.scrollHeight
    }));
  });

  window.addEventListener('scroll', function() {
    scrollCounter++;
    var ts = new Date();
    var elapsed = ts - start;
    maxScrollReached = (window.scrollY > maxScrollReached) ? window.scrollY : maxScrollReached;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      appTag: 'renewal',
      event: 'scroll',
      elapsed: elapsed,
      timestamp: ts,
      positionX: window.scrollX,
      positionY: window.scrollY,
      maxScrollReached: maxScrollReached
    }));
  });
})})();`;

export default injectionJS;
