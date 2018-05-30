const electron = require("electron");
const { ipcRenderer } = electron;
const remote = electron.remote;
const mainProcess = remote.require("./index");

let returnKey = document.getElementById('password');
returnKey.addEventListener("keyup", function(event) {
  // Number 13 is the "Enter" key on the keyboard
  if (event.keyCode === 13) {
    // Trigger the button element with a click
    startDownload();
  }
});

function startDownload() {
  let password = document.getElementById("password").value;
  mainProcess.downloadFiles(password);
}

