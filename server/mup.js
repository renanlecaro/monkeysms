module.exports = {
  servers: {
    one: {
      host: "188.166.160.106",
      username: "root",
      pem: "~/.ssh/id_rsa",
    },
  },

  app: {
    name: "monkeysmsprod",
    path: ".",

    servers: {
      one: {},
    },

    deployCheckWaitTime: 300,
    buildOptions: {
      serverOnly: true,
    },

    env: {
      ROOT_URL: "https://monkeysms.com",
    },

    docker: {
      // abernix/meteord:node-12-base works with Meteor 1.9 - 1.10
      // If you are using a different version of Meteor,
      // refer to the docs for the correct image to use.
      image: "zodern/meteor",
    },

    // Show progress bar while uploading bundle to server
    // You might need to disable it on CI servers
    enableUploadProgressBar: true,
  },

  mongo: {
    version: "4.4.4",
    servers: {
      one: {},
    },
  },

  proxy: {
    domains: "monkeysms.com",
  },
};
