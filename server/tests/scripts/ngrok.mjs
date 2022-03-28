// gets the current ngork address and updates relevant dev files

import fetch from "node-fetch";
import fs from "fs";

function sleep(ms = 500) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  let worked = false;
  while (!worked) {
    try {
      const response = await fetch("http://localhost:4040/api/tunnels");
      const data = await response.json();
      const tunnel = data.tunnels.find((t) => t.proto == "https");
      let url = tunnel && tunnel.public_url;
      if (url) {
        const androidConfigFile =
          "../android/app/src/main/java/me/lecaro/monkeysms/devurl.kt";
        const fileContent = `// this file is auto generated, last run ${new Date().toLocaleString()} 
package me.lecaro.monkeysms
val devURL="${url}"
`;
        fs.writeFileSync(androidConfigFile, fileContent);
        worked = true;
        console.info("ngrok url is : " + url);
      }
    } catch (e) {
      console.info("no ngrok url, retrying..", e);
    }
    await sleep(500);
  }
})();
