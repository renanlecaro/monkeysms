const { generateKeyPairSync } = require("crypto");
const child_process = require("child_process");

const hooksSigning = generateKeyPairSync("rsa", {
  modulusLength: 2048, // the length of your key in bits
  publicKeyEncoding: {
    type: "spki", // recommended to be 'spki' by the Node.js docs
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8", // recommended to be 'pkcs8' by the Node.js docs
    format: "pem",
  },
});

const vapid = JSON.parse(
  child_process.execSync("npx web-push generate-vapid-keys --json").toString()
);

const settingsJson = JSON.stringify({
  public: {
    push_public_key: vapid.publicKey,
    hooks_public_key: hooksSigning.publicKey,
  },
  push_private_key: vapid.privateKey,
  hooks_private_key: hooksSigning.privateKey,
}).slice(1, -1);

console.log("Add this to the settings.json file:", settingsJson);
