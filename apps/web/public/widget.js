(function () {
  var script = document.currentScript;
  if (!script) return;
  var agent = script.getAttribute("data-agent");
  if (!agent) return;
  var origin = new URL(script.src).origin;
  var color = script.getAttribute("data-color") || "#635bff";
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var open = false;

  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/" + encodeURIComponent(agent);
  frame.title = "Chat";
  frame.setAttribute("allow", "clipboard-write");
  frame.style.cssText =
    "position:fixed;bottom:92px;" + side + ":20px;width:380px;max-width:calc(100vw - 40px);" +
    "height:600px;max-height:calc(100vh - 120px);border:0;border-radius:16px;z-index:2147483000;" +
    "box-shadow:0 18px 48px rgba(15,23,42,.24);display:none;background:transparent;";

  var button = document.createElement("button");
  button.setAttribute("aria-label", "Chat");
  button.style.cssText =
    "position:fixed;bottom:20px;" + side + ":20px;width:56px;height:56px;border:0;border-radius:50%;" +
    "cursor:pointer;z-index:2147483000;background:" + color + ";color:#fff;display:flex;" +
    "align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(15,23,42,.28);";
  button.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  function setOpen(next) {
    open = next;
    frame.style.display = open ? "block" : "none";
  }
  button.addEventListener("click", function () { setOpen(!open); });
  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !event.data) return;
    if (event.data.type === "ol-widget" && event.data.action === "close") setOpen(false);
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
