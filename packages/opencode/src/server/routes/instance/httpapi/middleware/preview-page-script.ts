export const previewPageScript = `(function(){
  if(window.__ocPrev)return;window.__ocPrev=true;
  var origin=window.location.origin;
  function send(msg){try{parent.postMessage(msg,origin)}catch(e){}}
  function hook(level,fn){
    return function(){
      send({type:"opencode-preview-console",level:level,text:Array.prototype.map.call(arguments,String).join(" ").slice(0,500),source:"console."+level});
      return fn.apply(console,arguments);
    };
  }
  console.log=hook("log",console.log);
  console.info=hook("log",console.info);
  console.debug=hook("log",console.debug);
  console.warn=hook("warn",console.warn);
  console.error=hook("error",console.error);
  window.open=function(url){
    if(typeof url==="string"&&url&&url!=="about:blank"){
      try{location.assign(url)}catch(e){}
    }
    return window;
  };
  window.addEventListener("error",function(e){
    var t=e.target;
    if(t&&t!==window&&t.tagName&&(t.tagName==="IMG"||t.tagName==="SCRIPT"||t.tagName==="LINK"||t.tagName==="VIDEO"||t.tagName==="AUDIO")){
      send({type:"opencode-preview-console",level:"error",text:("Failed resource: "+(t.src||t.href||t.tagName)).slice(0,500),source:"network"});
      return;
    }
    send({type:"opencode-preview-console",level:"error",text:(e.message||"Error").slice(0,500),source:"window.onerror"});
  },true);
  window.addEventListener("unhandledrejection",function(e){
    var reason=e.reason&&e.reason.message?e.reason.message:String(e.reason||"rejected");
    send({type:"opencode-preview-console",level:"error",text:reason.slice(0,500),source:"promise"});
  });
  var picking=false,overlay,last;
  function keepInFrame(el){
    if(!el)return;
    var t=el.target;
    if(!t||t==="_self"||t==="_parent"||t==="_top")return false;
    el.target="_self";
    return true;
  }
  document.addEventListener("click",function(e){
    if(picking)return;
    var a=e.target&&e.target.closest?e.target.closest("a"):null;
    if(!keepInFrame(a)||!a.href)return;
    e.preventDefault();
    try{location.assign(a.href)}catch(err){}
  },true);
  document.addEventListener("submit",function(e){
    keepInFrame(e.target);
  },true);
  function describe(el){
    var tag=el.tagName.toLowerCase();
    var id=el.id?"#"+el.id:"";
    var cls="";
    if(el.className&&typeof el.className==="string"){
      var parts=el.className.trim().split(/\\s+/).filter(Boolean).slice(0,3);
      if(parts.length)cls="."+parts.join(".");
    }
    var text=(el.innerText||"").trim().replace(/\\s+/g," ").slice(0,80);
    return tag+id+cls+(text?' "'+text+'"':"");
  }
  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement("div");
    overlay.setAttribute("data-oc-pick","");
    overlay.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #f9825c;background:rgba(249,130,92,.15);display:none";
    document.documentElement.appendChild(overlay);
    return overlay;
  }
  function highlight(el){
    last=el;
    var r=el.getBoundingClientRect();
    var box=ensureOverlay();
    box.style.display="block";
    box.style.left=r.left+"px";
    box.style.top=r.top+"px";
    box.style.width=r.width+"px";
    box.style.height=r.height+"px";
  }
  function stopPick(){
    picking=false;
    document.documentElement.style.cursor="";
    if(overlay)overlay.style.display="none";
  }
  window.addEventListener("mousemove",function(e){
    if(!picking)return;
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||el===overlay)return;
    highlight(el);
  },true);
  window.addEventListener("click",function(e){
    if(!picking)return;
    e.preventDefault();
    e.stopPropagation();
    var el=last||e.target;
    stopPick();
    if(!el||el.nodeType!==1)return;
    send({type:"opencode-preview-pick",picked:true,summary:describe(el)});
  },true);
  window.addEventListener("keydown",function(e){
    if(!picking||e.key!=="Escape")return;
    e.preventDefault();
    stopPick();
    send({type:"opencode-preview-pick",picked:false});
  },true);
  window.addEventListener("message",function(e){
    if(e.origin!==origin)return;
    var data=e.data;
    if(!data||data.type!=="opencode-preview-pick")return;
    picking=!!data.enabled;
    document.documentElement.style.cursor=picking?"crosshair":"";
    if(!picking&&overlay)overlay.style.display="none";
  });
})()`
