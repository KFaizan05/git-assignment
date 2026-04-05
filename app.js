(function () {
  "use strict";

  var OPENAI_API_KEY = ""; // add your sk-... key here

  function $(sel) { return document.querySelector(sel); }

  function sendMessage() {
    var input = $("#chef-input");
    var root = $("#messages-root");
    var text = input.value.trim();
    if (!text) return;

    var userWrap = document.createElement("div");
    userWrap.className = "user-msg-container";
    userWrap.innerHTML = '<div class="container6">' + text + '</div>';
    root.appendChild(userWrap);
    input.value = "";

    setTimeout(function() {
        var aiWrap = document.createElement("div");
        var msg = !OPENAI_API_KEY ? "Add API Key in app.js" : "Thinking...";
        aiWrap.innerHTML = '<div class="container10">' + msg + '</div>';
        root.appendChild(aiWrap);
        root.scrollTop = root.scrollHeight;
    }, 600);
    root.scrollTop = root.scrollHeight;
  }

  function init() {
    const langToggle = $('#lang-toggle');
    const langOptions = $('#lang-options');
    langToggle.addEventListener('click', (e) => { e.stopPropagation(); langOptions.classList.toggle('dropdown-show'); });
    langOptions.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => { langToggle.querySelector('span').innerText = li.innerText; langOptions.classList.remove('dropdown-show'); });
    });

    $("#chef-send").addEventListener("click", sendMessage);
    $("#chef-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    window.addEventListener('click', () => langOptions.classList.remove('dropdown-show'));
  }
  document.addEventListener("DOMContentLoaded", init);
})();