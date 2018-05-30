const electron = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");
const mysqlDump = require("mysqldump");
const sftpClient = require("ssh2-sftp-client");
const os = require("os");
const cmd = require("node-cmd");

const { app, BrowserWindow, Menu, ipcMain, dialog } = electron;

let mainWindow;
let settingWindow;
let passwordWindow;
let settingFile = {};
let drupalSetting = {};
let sshKey;
let folders = [];
let appPath;

let sftp = new sftpClient();

process.env.NODE_ENV = "production";

function loadSettings() {
  appPath = app.getAppPath();

  // load user settings
  fs.readFile(path.normalize(`${appPath}/.ddtsettings`), (err, data) => {
    if (err || typeof data !== "object") {
      return;
    }
    settingFile = JSON.parse(data);
  });

  // load drupal settings
  fs.readFile(path.normalize(`${appPath}/.dsphp`), (err, data) => {
    if (err || typeof data !== "object") {
      return;
    }
    drupalSetting = JSON.parse(data);
  });

}

// On app ready launched the main window.
app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 520,
    resizable: false
  });
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/mainWindow.html"),
      protocol: "file:",
      slashes: true
    })
  );
  mainWindow.on("closed", () => {
    app.quit();
  });

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(mainMenu);

  loadSettings();
});

// Opens the settings window
exports.openSettings = () => {
  settingWindow = new BrowserWindow({
    title: "Settings",
    width: 1000,
    height: 630,
    resizable: false,
    frame: false,
    parent: mainWindow
  });
  settingWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/settings.html"),
      protocol: "file:",
      slashes: true
    })
  );
  settingWindow.on("closed", () => {
    settingWindow = null;
  });
};

// Listen for saved settings
ipcMain.on("settings:save", (e, items) => {
  saveSettings(items);
  settingWindow.close();
});

exports.selectDirectory = (name, settingName) => {
  dialog.showOpenDialog(
    settingWindow,
    {
      properties: ["openDirectory"]
    },
    function callback(filename) {
      if (!filename) return;
      settingFile[settingName] = filename[0];
      settingWindow.webContents.send(name, { msg: filename[0] });
    }
  );
};

exports.getSettings = () => {
  return settingFile;
};

exports.syncDB = () => {
  if (
    !settingFile.host ||
    !settingFile.username ||
    !settingFile.password ||
    !settingFile.database ||
    !settingFile.dPath ||
    !settingFile.lHost ||
    !settingFile.lPort ||
    !settingFile.lUsername ||
    !settingFile.mampPath ||
    !settingFile.lPassword
  ) {
    mainWindow.webContents.send("error", {
      msg: `Please check your settings! Missing Information.`
    });
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
    return;
  }
  let dumpPath = `${settingFile.dPath}/${settingFile.database}.sql`;
  mysqlDump(
    {
      host: settingFile.host,
      user: settingFile.username,
      password: settingFile.password,
      database: settingFile.database,
      port: settingFile.port,
      dest: settingFile.dPath,
      getDump: true
    },
    function(error, results) {
      if (error) {
        if (process.platform == "darwin") {
          app.dock.bounce('informational');
        }
        return mainWindow.webContents.send("error", {
          msg: "Connection error"
        });
      }

      fs.writeFile(dumpPath, results, (err) => {
        if (err) {
          mainWindow.webContents.send("log", { msg: err});
          if (process.platform == "darwin") {
            app.dock.bounce('informational');
          }
          return mainWindow.webContents.send("error", {
            msg: "Error writing SQL dump to file!"
          });
        }
        mainWindow.webContents.send("success", {
          msg: "Download Complete. Importing into local database."
        });
        mainWindow.webContents.send("dwnldComplete", {
          status: true
        });
        if (process.platform == "darwin") {
          app.dock.bounce('informational');
        }
        createDB();
      });
    }
  );
};

async function createDB() {
  let mampPath;
  let cleanup;
  let createCommand;

  if (process.platform == "darwin") {
    mampPath = path.normalize(`${settingFile.mampPath}/library/bin/`);
    cleanup = await cleanDB(mampPath);
    createCommand = `${mampPath}mysql -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} -e "create database ${settingFile.database}"`;  
  } else {
    mampPath = path.normalize(`${settingFile.mampPath}/bin/mysql/bin/`);
    cleanup = await cleanDB(mampPath);
    createCommand = `${mampPath}mysql.exe -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} -e "create database ${settingFile.database}"`;  
  }

  if (cleanup) {
    cmd.get(createCommand, (err, data, stderr) => {
      if (err) {
        mainWindow.webContents.send("log", { msg: err});
      }
      importDump(mampPath);
    });  
  } else {
    mainWindow.webContents.send("error", {
      msg: "Error dropping old database."
    });
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
  }
}

function cleanDB(mampPath) {
  return new Promise((resolve, reject) => {
    let clean;
    if (process.platform == "darwin") {
      clean = `${mampPath}mysql -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} -e "drop database ${settingFile.database}"`;
    } else {
      clean = `${mampPath}mysql.exe -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} -e "drop database ${settingFile.database}"`;
    }
    cmd.get(clean, (err, data, stderr) => {
        resolve(true);
    });
  })
}

function importDump(mampPath) {
  let importCommand;
  let dumpPath = path.normalize(`${settingFile.dPath}/${settingFile.database}.sql`);
  
  if (process.platform == "darwin") {
    importCommand = `${mampPath}mysql -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} ${settingFile.database} < ${dumpPath}`;
  } else {
    importCommand = `${mampPath}mysql.exe -h ${settingFile.lHost} -u${settingFile.lUsername} -p${settingFile.lPassword} ${settingFile.database} < ${dumpPath}`;
  }

  cmd.get(importCommand, (err, data, stderr) => {
    mainWindow.webContents.send("log", { msg: stderr});
    if (!err) {
      mainWindow.webContents.send("syncStatus", { msg: true });
      if (process.platform == "darwin") {
        app.dock.bounce('informational');
      }
      settingFile.lastSync = new Date().toUTCString();
      updateSettings();
    } else {
      mainWindow.webContents.send("log", { msg: err});
      mainWindow.webContents.send("log", { msg: stderr});
      mainWindow.webContents.send("error", { msg: "Error importing dump into mysql server."});
    }
  });
}

exports.startSFTP = () => {
  if (
    !settingFile.sftpSSH ||
    !settingFile.location ||
    !settingFile.sftpHost ||
    !settingFile.sftpUsername
  ) {
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
    mainWindow.webContents.send("error", {
      msg: `Please check your settings! Missing Information.`
    });
    return;
  }

  fs.readFile(settingFile.sftpSSH, (err, ssh) => {
    if (err) {
      mainWindow.webContents.send("error", {
        msg: `no such file or directory, open ${err.path}`
      });
      if (process.platform == "darwin") {
        app.dock.bounce('informational');
      }
      return;
    }

    sshKey = ssh.toString();
    if (sshKey.includes("Proc-Type")) {
      openPasswordPrompt();
      return;
    }

    downloadFiles();
  });
};

exports.downloadFiles = password => {
  try {
    let params = {
      host: settingFile.sftpHost,
      username: settingFile.sftpUsername,
      privateKey: sshKey,
      keepaliveInterval: 2000
    };

    if (typeof password === "string" && password.length !== 0) {
      passwordWindow.close();
      mainWindow.webContents.send("downloadStart", { msg: true });
      params.passphrase = password;
    }

    sftp
      .connect(params)
      .then(() => {
        writeFiles();
      })
      .catch(err => {
        if (process.platform == "darwin") {
          app.dock.bounce('informational');
        }
        mainWindow.webContents.send("error", {
          msg: "Error connecting remote server! Check your password and settings."
        });
      });
  } catch (error) {
    mainWindow.webContents.send("error", { msg: "Error downloading Files!" });
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
  }
};

async function writeFiles() {
  let remoteFilePath = settingFile.sftPath;
  if (!remoteFilePath) {
    mainWindow.webContents.send("error", {
      msg: "Error, No SFTP Path in settings"
    });
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
  }
  let data = await sftp.list(remoteFilePath);

  if (!data) {
    mainWindow.webContents.send("error", {
      msg: "Error Getting files from server."
    });
    if (process.platform == "darwin") {
      app.dock.bounce('informational');
    }
  }

  for (let i = 0; i < data.length; i++) {
    // Check to see if it is a folder or a file - Away to be reclusive.
    if (data[i].name.includes(".")) {
      const remoteFilename = path.normalize(
        `${remoteFilePath}/${data[i].name}`
      );
      const localFilename = path.normalize(
        `${settingFile.location}/${data[i].name}`
      );

      let write = await streamData(remoteFilename, localFilename);
    } else {
      let nfs = {
        remote: path.normalize(`${remoteFilePath}/${data[i].name}`),
        local: path.normalize(`${settingFile.location}/${data[i].name}/`)
      };
      folders.push(nfs);
    }
  }
  if (folders.length > 0) {
    for (let i = 0; i < folders.length; i++) {
      let nf = await makeFolder(folders[i].local);
      let fd = await sftp.list(folders[i].remote);

      for (let l = 0; l < fd.length; l++) {
        if (fd[l].name.includes(".")) {
          const rf = path.normalize(`${folders[i].remote}/${fd[l].name}`);
          const lf = path.normalize(`${folders[i].local}/${fd[l].name}`);

          let w = await streamData(rf, lf);
        } else {
          let sf = {
            remote: path.normalize(`${folders[i].remote}/${fd[l].name}`),
            local: path.normalize(`${folders[i].local}/${fd[l].name}/`)
          };
          folders.push(sf);
        }
      }
    }
  }

  mainWindow.webContents.send("downloadStatus", { msg: true });
  settingFile.lastDownload = new Date().toUTCString();
  if (process.platform == "darwin") {
    app.dock.bounce('informational');
  }  
  updateSettings();
}

function streamData(remote, file) {
  return new Promise((resolve, reject) => {
    try {
      sftp.get(remote, true, null).then(data => {
        const writable = fs.createWriteStream(file);
        data.pipe(writable);
        data.on("end", () => {
          resolve(true);
        });
        data.on("error", err => {
          if (process.platform == "darwin") {
            app.dock.bounce('informational');
          }
          mainWindow.webContents.send("error", { msg: "Streaming data Error" });
          reject(false);
        });
      });
    } catch (error) {
      reject(false);
      if (process.platform == "darwin") {
        app.dock.bounce('informational');
      }
      mainWindow.webContents.send("error", {
        msg: "Error writing files to disk"
      });
    }
  });
}

function makeFolder(name) {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(name)) {
        resolve(true);
        return;
      }
      fs.mkdir(name, err => {
        if (err) {
          if (process.platform == "darwin") {
            app.dock.bounce('informational');
          }
          mainWindow.webContents.send("error", {
            msg: "Error creating directory"
          });
          reject(false);
        }
        resolve(true);
      });
    } catch (error) {
      if (process.platform == "darwin") {
        app.dock.bounce('informational');
      }
      mainWindow.webContents.send("error", { msg: "Error creating directory" });
    }
  });
}

exports.closePassword = () => {
  passwordWindow.close();
};

exports.closeSettings = () => {
  settingWindow.close();
};

exports.closeDrupalSettings = () => {
  drupalSettingsNew.close();
};

function openPasswordPrompt() {
  passwordWindow = new BrowserWindow({
    width: 280,
    height: 160,
    frame: false,
    parent: mainWindow,
    resizable: false,
  });
  passwordWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/password.html"),
      protocol: "file:",
      slashes: true
    })
  );
  passwordWindow.on("closed", () => {
    passwordWindow = null;
  });
}

function updateSettings() {
  fs.writeFile(
    path.normalize(`${appPath}/.ddtsettings`),
    JSON.stringify(settingFile),
    err => {
      if (err)
        mainWindow.webContents.send("error", {
          msg: "Error updating settings on disk"
        });
    }
  );
}

function saveSettings(settings) {
  fs.writeFile(
    path.normalize(`${appPath}/.ddtsettings`),
    JSON.stringify(settings),
    err => {
      if (err)
        mainWindow.webContents.send("error", {
          msg: "Error saving settings to disk"
        });
    }
  );
  settingFile = settings;
}

function menuOpenSettings() {
  openSettings();
}

exports.getDrupalSettings = () => {
  return drupalSetting;
}

exports.newDrupalSettings = (settings) => {
  drupalSettingsNew.close();
  let savePath = path.normalize(settingFile.location.slice(0, (settingFile.location.length -5)));

  fs.readFile(path.normalize(`${appPath}/drupalFiles/settings.php`), (err, data) => {
    if (err) {
      mainWindow.webContents.send("error", { msg: 'Error with reading settings.php file.' });
      return;
    }

    let sf = data.toString();
    let d = sf.replace("--database--", settings.database);
    let u = d.replace("--username--", settings.username);
    let pw = u.replace("--password--", settings.password);
    let p = pw.replace("--port--", settings.port ? settings.port : '');
    let h = p.replace("--host--", settings.host ? settings.host : '');
    let finalFile = h.replace("--baseip--", `${settings.baseURL}:${settings.lhPort}`);

    fs.writeFile(path.normalize(`${savePath}settings.php`), finalFile, (err) => {
      if (err) {
        mainWindow.webContents.send("log", { msg: err});
        mainWindow.webContents.send("error", { msg: 'Error saving settings.php file.' });
        return;
      }
      drupalSetting = settings;
      updateDrupalSettings();
    });  
  });
}

exports.getIPs = () => {
  let interfaces = os.networkInterfaces();
  let ips = {};

  if (process.platform == "darwin") {
    for (const key in interfaces) {
      if (!interfaces[key][0].address.includes("fe") && !key.includes('un')) {
        ips[key] = interfaces[key][0].address;
      }
    }  
  } else {
    for (const key in interfaces) {
      if (!interfaces[key][1].address.includes("fe") && !key.includes('un')) {
        ips[key] = interfaces[key][1].address;
      }
    }
  }
  return ips;
}


function openDrupalSettingsNew() {
  drupalSettingsNew = new BrowserWindow({
    frame: false,
    parent: mainWindow,
    width: 775,
    height: 560,
    resizable: false,
  });
  drupalSettingsNew.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/drupalSettings.html"),
      protocol: "file:",
      slashes: true
    })
  );
  drupalSettingsNew.on("closed", () => {
    drupalSettingsNew = null;
  });
}

function updateDrupalSettings() {
  fs.writeFile(
    path.normalize(`${appPath}/.dsphp`),
    JSON.stringify(drupalSetting),
    err => {
      if (err)
        mainWindow.webContents.send("error", {
          msg: "Error updating Drupal settings on disk"
        });
    }
  );
}

function openGitHelp() {
  githelpWindow = new BrowserWindow({
    parent: mainWindow,
    width: 775,
    height: 775,
  });
  githelpWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "html/gitHelp.html"),
      protocol: "file:",
      slashes: true
    })
  );
  githelpWindow.on("closed", () => {
    drupalSettingsNew = null;
  });

}

function switchToDevelopment() {
  mainMenuTemplate.push({
    label: "Developer Tools",
    submenu: [
      {
        label: "Toggle Dev Tools",
        accelerator: process.platform == "darwin" ? "Command+I" : "Ctrl+I",
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: "reload"
      }
    ]
  });
  app.reload();
}
 

const mainMenuTemplate = [
  {
    label: "File",
    submenu: [
      {
        label: "Settings",
        accelerator: process.platform == "darwin" ? "Command+S" : "Ctrl+S",
        click() {
          menuOpenSettings();
        }
      },
      {
        label: "Development Mode",
        accelerator: process.platform == "darwin" ? "Command+Q" : "Ctrl+Q",
        click() {
          switchToDevelopment();
        }
      },
      {
        label: "Quit",
        accelerator: process.platform == "darwin" ? "Command+Q" : "Ctrl+Q",
        click() {
          app.quit();
        }
      }
    ]
  },
  {
    label: "Edit",
    submenu: [
      {
        label: "Cut",
        accelerator: process.platform == "darwin" ? "Command+X" : "Ctrl+X",
        selector: "cut:"
      },
      {
        label: "Copy",
        accelerator: process.platform == "darwin" ? "Command+C" : "Ctrl+C",
        selector: "copy:"
      },
      {
        label: "Paste",
        accelerator: process.platform == "darwin" ? "Command+V" : "Ctrl+V",
        selector: "paste:"
      },
      {
        label: "Select All",
        accelerator: process.platform == "darwin" ? "Command+A" : "Ctrl+A",
        selector: "selectAll:"
      }
    ]
  },
  {
    label: "Drupal",
    submenu: [
      {
        label: "Update Settings.php",
        accelerator: process.platform == "darwin" ? "Command+D" : "Ctrl+D",
        click() {
          openDrupalSettingsNew();
        }
      },
    ]
  },
  {
    label: "Git",
    submenu: [
      {
        label: "Git Reference",
        accelerator: process.platform == "darwin" ? "Command+G" : "Ctrl+G",
        click() {
          openGitHelp();
        }
      },
    ]
  }
];

if (process.platform === "darwin") {
  mainMenuTemplate.unshift({});
}

if (process.env.NODE_ENV !== "production") {
  mainMenuTemplate.push({
    label: "Developer Tools",
    submenu: [
      {
        label: "Toggle Dev Tools",
        accelerator: process.platform == "darwin" ? "Command+I" : "Ctrl+I",
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: "reload"
      }
    ]
  });
}
