(function(){
  function initCardEffects(){
    if(matchMedia("(hover:none)").matches) return;
    document.addEventListener("mousemove", function(e){
      document.querySelectorAll(".card").forEach(function(card){
        var r = card.getBoundingClientRect();
        if(e.clientX < r.left-80 || e.clientX > r.right+80 ||
           e.clientY < r.top-80  || e.clientY > r.bottom+80) return;
        var px = ((e.clientX - r.left) / r.width)  * 100;
        var py = ((e.clientY - r.top)  / r.height) * 100;
        card.style.setProperty("--mouse-x", px + "%");
        card.style.setProperty("--mouse-y", py + "%");
      });
    }, { passive:true });

    document.querySelectorAll(".card").forEach(function(card){
      var MAX = 6, tx=0, ty=0, cx=0, cy=0, raf=null;
      card.addEventListener("mousemove", function(e){
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width  - 0.5;
        var py = (e.clientY - r.top)  / r.height - 0.5;
        tx = -py * MAX; ty = px * MAX;
        if(!raf) raf = requestAnimationFrame(loop);
      });
      card.addEventListener("mouseleave", function(){
        tx = 0; ty = 0; card.classList.add("tilt-off");
        if(!raf) raf = requestAnimationFrame(loop);
        setTimeout(function(){ card.classList.remove("tilt-off"); }, 560);
      });
      function loop(){
        cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15;
        card.style.setProperty("--rx", cx.toFixed(2) + "deg");
        card.style.setProperty("--ry", cy.toFixed(2) + "deg");
        raf = (Math.abs(tx-cx) > 0.05 || Math.abs(ty-cy) > 0.05)
          ? requestAnimationFrame(loop) : null;
      }
    });
  }

  function initMagnetic(){
    if(!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    document.querySelectorAll(".btn-accent").forEach(function(el){
      var inner = document.createElement("span");
      inner.style.cssText = "display:inline-flex;align-items:center;justify-content:center;gap:inherit;will-change:transform;transition:transform .8s cubic-bezier(.2,.7,.2,1)";
      while(el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
      var tx=0, ty=0, cx=0, cy=0, raf=null;
      el.addEventListener("mousemove", function(e){
        var r = el.getBoundingClientRect();
        tx = ((e.clientX - r.left) - r.width/2)  * 0.28;
        ty = ((e.clientY - r.top)  - r.height/2) * 0.28;
        if(!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener("mouseleave", function(){ tx=0; ty=0; if(!raf) raf = requestAnimationFrame(loop); });
      function loop(){
        cx += (tx-cx)*0.2; cy += (ty-cy)*0.2;
        inner.style.transform = "translate3d("+cx.toFixed(1)+"px,"+cy.toFixed(1)+"px,0)";
        raf = (Math.abs(tx-cx)>0.1 || Math.abs(ty-cy)>0.1) ? requestAnimationFrame(loop) : null;
      }
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ initCardEffects(); initMagnetic(); });
  } else {
    initCardEffects(); initMagnetic();
  }
})();
