// Author: Faizan Kalam

(function () {
  "use strict";


  var OPENAI_API_KEY = ""; // add open ai key here

  // A shortcut to select HTML elements from the page
  function $(sel) { return document.querySelector(sel); }

  // Handles getting the user's text and showing the AI response
  function sendMessage() {
    var input = $("#chef-input");
    var root = $("#messages-root");
    var text = input.value.trim();
    
    // Don't do anything if the box is empty
    if (!text) return;

    // Create and show the user's message bubble
    var userWrap = document.createElement("div");
    userWrap.className = "user-msg-container";
    userWrap.innerHTML = '<div class="container6">' + text + '</div>';
    root.appendChild(userWrap);
    
    // Clear the input box after sending
    input.value = "";

    // Wait 600ms to simulate the AI "thinking"
    setTimeout(function() {
        var aiWrap = document.createElement("div");
        var msg = !OPENAI_API_KEY ? "Add API Key in app.js" : "Thinking...";
        
        // Show the AI message bubble
        aiWrap.innerHTML = '<div class="container10">' + msg + '</div>';
        root.appendChild(aiWrap);
        
        // Auto-scroll to the bottom of the chat
        root.scrollTop = root.scrollHeight;
    }, 600);

    // Initial scroll when user sends their message
    root.scrollTop = root.scrollHeight;
  }

  // --- Setup & Event Listeners ---
  function init() {
    // 1. Language Dropdown Logic
    const langToggle = $('#lang-toggle');
    const langOptions = $('#lang-options');
    
    // Toggle menu visibility when clicking the button
    langToggle.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      langOptions.classList.toggle('dropdown-show'); 
    });

    // Update the button text when a language is selected
    langOptions.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => { 
        langToggle.querySelector('span').innerText = li.innerText; 
        langOptions.classList.remove('dropdown-show'); 
      });
    });

    // 2. Chat Input Listeners
    // Send message on button click
    $("#chef-send").addEventListener("click", sendMessage);
    
    // Send message when 'Enter' is pressed (but not Shift+Enter)
    $("#chef-input").addEventListener("keydown", (e) => { 
      if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
      } 
    });

    // Close the language menu if clicking anywhere else on the screen
    window.addEventListener('click', () => langOptions.classList.remove('dropdown-show'));
  }

  // Start the script once the HTML page is fully loaded
  document.addEventListener("DOMContentLoaded", init);
})();