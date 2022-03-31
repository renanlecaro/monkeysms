# MonkeySMS 

![MonkeySMS logo](./server/public/logo.svg)

This repo contains the code for https://monkeysms.com/, an open source SAAS that lets you send and read SMS messages from 
your android phone, or anywhere else.

# How to run locally (linux/mac)

(this setup has not been tested yet, if you encounter problems running the app locally, please raise an issue)

A few secrets and API keys are needed to make this system work. They are not public. 
If you want to run this app on your own infra, you'll need to set those.

- server/settings.json : fill it based on server/settings.example.json. You'll need some google login credentials (the 
  same ones as used in the android client), Firebase credentials (to notify android clients) and some public/private key
  pair for the web notifications.

- android/app/google-services.json : this is exported from the firebase project, and needed to build the android app



You will need both your phone and computer to be connected to the internet 
when developing locally because we're using ngrok.

Run the server 
- `git clone git@github.com:renanlecaro/monkeysms.git`
- `cd monkeysms`
- `cd server`
- `curl https://install.meteor.com/ | sh`
- `npm install`
- `npm start`
- Open [http://localhost:3033](http://localhost:3033) in your web browser

Build the app (after starting the server)

- install android studio
- open the "android" folder
- sync the project
- connect a phone
- click build in android


# Project structure

## Android project

The "android" folder contains the kotlin source code of the android app, used to generate the apk

##  Meteor app

The "server" folder contains the source code of the web app running at https://monkeysms.com . 

This app is responsible for the marketing of the project, web UI and API

##  API usage example

The "api_use_example" folder contains a minimal node app that makes use of the MonkeySMS API.
It lets the user log in, install the MonkeySMS app, and then send a message remotely from their phone.
There's also a readme there documenting the usage of our API

# Automatic deployment of the server app

If you create a fork of the project and want the auto deploy of "main" to work, set the following secrets for the GitHub action : 
- secrets.SETTINGS_DOT_JSON : Content of your local settings.json file 
- secrets.SSH_KEY : Private RSA key used to deploy the meteor app to the server. The corresponding pub key needs to be added to your server's authorized_keys  
- secrets.KNOWN_HOSTS : Used to deploy the meteor app to the server, result of running `ssh-keyscan -H  188.166.160.106` where the IP address is changed for your own DigitalOcean droplet