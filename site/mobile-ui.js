"use strict";
// Mobile-only presentation controls: preserve the existing market selectors as
// the single source of truth for chart and contract retrieval.
(function(){
  const $=id=>document.getElementById(id);
  const select=$("interval"),buttons=[...document.querySelectorAll(".timeframe-button")];
  const modeButton=$("mode-toggle"),modeField=$("mode-field"),source=$("source");
  const nav=document.querySelector(".mobile-jump-nav");
  if(!select||buttons.length!==2||!modeButton||!modeField||!source||!nav)return;
  function sync(){
    const current=select.value;
    for(const button of buttons){
      const active=button.dataset.interval===current;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    }
    const practice=source.value==="demo";
    modeButton.textContent=practice?"Practice mode · Change":"Data options";
    modeButton.classList.toggle("is-practice",practice);
  }
  for(const button of buttons){
    button.addEventListener("click",()=>{
      if(button.dataset.interval!==select.value){
        select.value=button.dataset.interval;
        // Existing app.js and polymarket.js listeners stay authoritative.
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
      sync();
    });
  }
  select.addEventListener("change",sync);
  source.addEventListener("change",sync);
  modeButton.addEventListener("click",()=>{
    const isOpen=modeButton.getAttribute("aria-expanded")==="true";
    modeButton.setAttribute("aria-expanded",isOpen?"false":"true");
    modeField.classList.toggle("is-expanded",!isOpen);
  });
  function markSection(){
    const selected=location.hash||"#poly-panel";
    for(const link of nav.querySelectorAll("a")){
      const active=link.getAttribute("href")===selected;
      link.classList.toggle("is-active",active);
      if(active)link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange",markSection);
  window.addEventListener("pageshow",()=>{sync();markSection();});
  sync();markSection();
})();