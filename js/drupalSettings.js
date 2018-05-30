const electron = require("electron");
const { ipcRenderer } = electron;
const remote = electron.remote;
const mainProcess = remote.require("./index");

// on load look for settings and fill them in
document.addEventListener(
  "DOMContentLoaded",
  () => {
    let baseURL = document.getElementById('baseURL');
    let getIPs = mainProcess.getIPs();

    for (const key in getIPs) {
        let opt = getIPs[key];
        let o = document.createElement('option');
        o.textContent = key + ' - ' + opt;
        o.value = opt;
        baseURL.appendChild(o);
    }  
    
    let settings = mainProcess.getDrupalSettings();
    document.getElementById("host").value = settings.host ? settings.host : "";
    document.getElementById("port").value = settings.port ? settings.port : "";
    document.getElementById("username").value = settings.username ? settings.username : "";
    document.getElementById("password").value = settings.password ? settings.password : "";
    document.getElementById("database").value = settings.database ? settings.database : "";
    document.getElementById("lhPort").value = settings.lhPort ? settings.lhPort : "";
    let baseIP = document.getElementById("baseURL");
    if (!settings.baseURL) {
      baseIP.selectedIndex = 0;
    } else {
      baseIP.value = settings.baseURL;
    }
  },
  false
);

// listen for submit
const form = document.querySelector("form");
form.addEventListener("submit", newDrupalSettingFile);

// save settings
function newDrupalSettingFile(e) {
  e.preventDefault();
  const settings = {
    host: document.querySelector("#host").value,
    port: document.querySelector("#port").value,
    username: document.querySelector("#username").value,
    password: document.querySelector("#password").value,
    database: document.querySelector("#database").value,
    baseURL: document.querySelector("#baseURL").value,
    lhPort: document.querySelector("#lhPort").value
  };
  mainProcess.newDrupalSettings(settings);
}

document.getElementById("cancel").addEventListener("click", () => {
  mainProcess.closeDrupalSettings();
});

ipcRenderer.on("log", (e, log) => {
  console.log(log.msg);
});