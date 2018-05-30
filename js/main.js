const electron = require("electron");
const { ipcRenderer } = electron;
const remote = electron.remote;
const mainProcess = remote.require("./index");
const syncing = false;
const messageDiv = document.getElementById("message");

document.addEventListener(
  "DOMContentLoaded",
  () => {
    let settings = mainProcess.getSettings();
    document.getElementById("lastSynced").innerHTML = settings.lastSync
      ? settings.lastSync
      : "";
    document.getElementById("lastDownload").innerHTML = settings.lastDownload
      ? settings.lastDownload
      : "";
  },
  false
);


ipcRenderer.on("error", (e, error) => {
  document.querySelector("#syncLoader").classList.add("none");
  document.querySelector("#downloadLoader").classList.add("none");
  messageDiv.classList.add('alert-danger');
  messageDiv.classList.remove("none");
  messageDiv.innerHTML = error.msg;

  setTimeout(() => {
    messageDiv.classList.add("none");
    messageDiv.classList.remove('alert-danger');
    messageDiv.innerHTML = "";
  }, 4000);
});

ipcRenderer.on("success", (e, message) => {
  messageDiv.classList.add('alert-success');
  messageDiv.classList.remove("none");
  messageDiv.innerHTML = message.msg;

  setTimeout(() => {
    messageDiv.classList.add("none");
    messageDiv.classList.remove('alert-success');
    messageDiv.innerHTML = "";
  }, 4000);
});



// Sync Database
let sync = document.querySelector("#sync");
sync.addEventListener("click", () => {
  document.querySelector("#syncLoader").classList.remove("none");
  document.querySelector("#syncCheck").classList.add("none");
  mainProcess.syncDB();
});

ipcRenderer.on("syncStatus", (e, status) => {
  document.querySelector("#syncLoader").classList.add("none");
  document.querySelector("#syncCheck").classList.remove("none");
  document.querySelector("#lastSynced").innerHTML = new Date().toUTCString();
  document.querySelector("#dbIcon").src = '../img/dwnld.svg'
});

// Download remote folder
ipcRenderer.on("downloadStart", (e, status) => {
  document.querySelector("#downloadLoader").classList.remove("none");
  document.querySelector("#downloadCheck").classList.add("none");
});

ipcRenderer.on("downloadStatus", (e, status) => {
  document.querySelector("#downloadLoader").classList.add("none");
  document.querySelector("#downloadCheck").classList.remove("none");
  document.querySelector("#lastDownload").innerHTML = new Date().toUTCString();
});


ipcRenderer.on("dwnldComplete", (e, status) => {
  document.querySelector("#dbIcon").src = '../img/sync.svg'
});

ipcRenderer.on("log", (e, log) => {
  console.log(log.msg);
});
