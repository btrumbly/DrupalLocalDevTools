const electron = require("electron");
const { ipcRenderer } = electron;
const remote = electron.remote;
const mainProcess = remote.require("./index");

// on load look for settings and fill them in
document.addEventListener(
  "DOMContentLoaded",
  () => {
    let settings = mainProcess.getSettings();
    document.getElementById("host").value = settings.host ? settings.host : "";
    document.getElementById("port").value = settings.port ? settings.port : "";
    document.getElementById("username").value = settings.username
      ? settings.username
      : "";
    document.getElementById("password").value = settings.password
      ? settings.password
      : "";
    document.getElementById("database").value = settings.database
      ? settings.database
      : "";
    document.getElementById("location").value = settings.location
      ? settings.location
      : "";
    document.getElementById("sftpHost").value = settings.sftpHost
      ? settings.sftpHost
      : "";
    document.getElementById("sftpUsername").value = settings.sftpUsername
      ? settings.sftpUsername
      : "";
    document.getElementById("sftpSSH").value = settings.sftpSSH
      ? settings.sftpSSH
      : "";
    document.getElementById("sftPath").value = settings.sftPath
      ? settings.sftPath
      : "";
    document.getElementById("lHost").value = settings.lHost
      ? settings.lHost
      : "";
    document.getElementById("lPort").value = settings.lPort
      ? settings.lPort
      : "";
    document.getElementById("lUsername").value = settings.lUsername
      ? settings.lUsername
      : "";
    document.getElementById("lPassword").value = settings.lPassword
      ? settings.lPassword
      : "";
    document.getElementById("dPath").value = settings.dPath
      ? settings.dPath
      : "";
    document.getElementById("mampPath").value = settings.mampPath
      ? settings.mampPath
      : "";
  },
  false
);

// listen for submit
const form = document.querySelector("form");
form.addEventListener("submit", saveSettings);

// save settings
function saveSettings(e) {
  e.preventDefault();
  const settings = {
    host: document.querySelector("#host").value,
    port: document.querySelector("#port").value,
    username: document.querySelector("#username").value,
    password: document.querySelector("#password").value,
    database: document.querySelector("#database").value,
    location: document.querySelector("#location").value,
    sftpHost: document.querySelector("#sftpHost").value,
    sftpUsername: document.querySelector("#sftpUsername").value,
    sftpSSH: document.querySelector("#sftpSSH").value,
    sftPath: document.querySelector("#sftPath").value,
    lHost: document.querySelector("#lHost").value,
    lPort: document.querySelector("#lPort").value,
    lUsername: document.querySelector("#lUsername").value,
    lPassword: document.querySelector("#lPassword").value,
    dPath: document.querySelector("#dPath").value,
    mampPath: document.querySelector("#mampPath").value
  };
  ipcRenderer.send("settings:save", settings);
}

// listen for path for local drupal
let drupalPath = document.querySelector("#location");
drupalPath.addEventListener("click", () => {
  mainProcess.selectDirectory("drupalPath", "location");
});

let dbPath = document.querySelector("#dPath");
dbPath.addEventListener("click", () => {
  mainProcess.selectDirectory("dPath", "dPath");
});

let mampPath = document.querySelector("#mampPath");
mampPath.addEventListener("click", () => {
  mainProcess.selectDirectory("mampPath", "mampPath");
});

ipcRenderer.on("drupalPath", (e, path) => {
  document.getElementById("location").value = path.msg;
});

ipcRenderer.on("mampPath", (e, path) => {
  document.getElementById("mampPath").value = path.msg;
});

ipcRenderer.on("dPath", (e, path) => {
  document.getElementById("dPath").value = path.msg;
});

ipcRenderer.on("sftpSSH", (e, path) => {
  document.getElementById("sftpSSH").value = path.msg;
});

document.getElementById("cancel").addEventListener("click", () => {
  mainProcess.closeSettings();
});
